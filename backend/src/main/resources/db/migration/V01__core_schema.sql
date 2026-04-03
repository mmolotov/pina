-- Enable pgvector extension (for future ML embeddings)
CREATE
EXTENSION IF NOT EXISTS vector;

-- Users
CREATE TABLE users
(
    id         UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    email      VARCHAR(255) UNIQUE,
    name       VARCHAR(255)             NOT NULL,
    avatar_url VARCHAR(1024),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Personal libraries
CREATE TABLE personal_libraries
(
    id         UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    owner_id   UUID                     NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_personal_libraries_owner ON personal_libraries (owner_id);

-- Photos
CREATE TABLE photos
(
    id                  UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    uploader_id         UUID                     NOT NULL REFERENCES users (id),
    personal_library_id UUID                     NOT NULL REFERENCES personal_libraries (id) ON DELETE CASCADE,
    content_hash        VARCHAR(64)              NOT NULL,
    original_filename   VARCHAR(512),
    mime_type           VARCHAR(64)              NOT NULL,
    width               INTEGER,
    height              INTEGER,
    size_bytes          BIGINT                   NOT NULL,
    exif_data           JSONB,
    taken_at            TIMESTAMP WITH TIME ZONE,
    latitude            DOUBLE PRECISION,
    longitude           DOUBLE PRECISION,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT chk_photo_geo_pair CHECK (
        (latitude IS NULL AND longitude IS NULL) OR
        (latitude IS NOT NULL AND longitude IS NOT NULL)
    )
);

CREATE INDEX idx_photos_uploader ON photos (uploader_id);
CREATE INDEX idx_photos_personal_library ON photos (personal_library_id);
CREATE UNIQUE INDEX idx_photos_uploader_content_hash ON photos (uploader_id, content_hash);
CREATE INDEX idx_photos_taken_at ON photos (taken_at);
CREATE INDEX idx_photos_geo ON photos (latitude, longitude) WHERE latitude IS NOT NULL;

-- Photo variants (original, compressed, thumbnails)
CREATE TABLE photo_variants
(
    id           UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    photo_id     UUID                     NOT NULL REFERENCES photos (id) ON DELETE CASCADE,
    variant_type VARCHAR(20)              NOT NULL, -- ORIGINAL, COMPRESSED, THUMB_SM, THUMB_MD, THUMB_LG
    storage_path VARCHAR(1024)            NOT NULL,
    format       VARCHAR(10)              NOT NULL, -- jpeg, webp, avif, png, etc.
    quality      INTEGER,
    width        INTEGER                  NOT NULL,
    height       INTEGER                  NOT NULL,
    size_bytes   BIGINT                   NOT NULL,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_photo_variants_photo ON photo_variants (photo_id);
CREATE UNIQUE INDEX idx_photo_variants_unique ON photo_variants (photo_id, variant_type);

-- Albums
CREATE TABLE albums
(
    id                  UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    name                VARCHAR(255)             NOT NULL,
    description         TEXT,
    owner_id            UUID                     NOT NULL REFERENCES users (id),
    personal_library_id UUID                     NOT NULL REFERENCES personal_libraries (id) ON DELETE CASCADE,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_albums_owner ON albums (owner_id);
CREATE INDEX idx_albums_personal_library ON albums (personal_library_id);

-- Album-Photo junction
CREATE TABLE album_photos
(
    album_id UUID                     NOT NULL REFERENCES albums (id) ON DELETE CASCADE,
    photo_id UUID                     NOT NULL REFERENCES photos (id) ON DELETE CASCADE,
    added_by UUID                     NOT NULL REFERENCES users (id),
    added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    PRIMARY KEY (album_id, photo_id)
);

CREATE INDEX idx_album_photos_photo ON album_photos (photo_id);

-- Auto-update updated_at on every UPDATE
CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS
$$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_albums_updated_at
    BEFORE UPDATE ON albums
    FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Linked accounts (auth providers: LOCAL, GOOGLE, TELEGRAM)
CREATE TABLE linked_accounts
(
    id                  UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    user_id             UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    provider            VARCHAR(20)              NOT NULL,
    provider_account_id VARCHAR(255)             NOT NULL,
    credentials         TEXT,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_linked_accounts_provider_account ON linked_accounts (provider, provider_account_id);
CREATE INDEX idx_linked_accounts_user ON linked_accounts (user_id);

-- Spaces (collaborative groups with hierarchy)
CREATE TABLE spaces
(
    id              UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    name            VARCHAR(255)             NOT NULL,
    description     TEXT,
    avatar_url      VARCHAR(1024),
    visibility      VARCHAR(10)              NOT NULL DEFAULT 'PRIVATE',
    parent_id       UUID                              REFERENCES spaces (id) ON DELETE CASCADE,
    depth           INTEGER                  NOT NULL DEFAULT 0,
    inherit_members BOOLEAN                  NOT NULL DEFAULT true,
    creator_id      UUID                     NOT NULL REFERENCES users (id),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT chk_spaces_depth CHECK (depth >= 0 AND depth <= 5)
);

CREATE INDEX idx_spaces_parent ON spaces (parent_id);
CREATE INDEX idx_spaces_creator ON spaces (creator_id);
CREATE INDEX idx_spaces_visibility ON spaces (visibility);

CREATE TRIGGER trg_spaces_updated_at
    BEFORE UPDATE ON spaces
    FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Space memberships (roles: OWNER, ADMIN, MEMBER, VIEWER)
CREATE TABLE space_memberships
(
    space_id  UUID                     NOT NULL REFERENCES spaces (id) ON DELETE CASCADE,
    user_id   UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role      VARCHAR(10)              NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    PRIMARY KEY (space_id, user_id)
);

CREATE INDEX idx_space_memberships_user ON space_memberships (user_id);

-- Invite links for joining Spaces
CREATE TABLE invite_links
(
    id           UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    space_id     UUID                     NOT NULL REFERENCES spaces (id) ON DELETE CASCADE,
    code         VARCHAR(32)              NOT NULL UNIQUE,
    default_role VARCHAR(10)              NOT NULL DEFAULT 'MEMBER',
    expiration   TIMESTAMP WITH TIME ZONE,
    usage_limit  INTEGER,
    usage_count  INTEGER                  NOT NULL DEFAULT 0,
    auto_approve BOOLEAN                  NOT NULL DEFAULT true,
    active       BOOLEAN                  NOT NULL DEFAULT true,
    created_by   UUID                     NOT NULL REFERENCES users (id),
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_invite_links_space ON invite_links (space_id);

-- Favorites (per-user bookmarks for photos, albums, videos)
CREATE TABLE favorites
(
    id          UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    user_id     UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    target_type VARCHAR(10)              NOT NULL,
    target_id   UUID                     NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_favorites_user_target ON favorites (user_id, target_type, target_id);
CREATE INDEX idx_favorites_user ON favorites (user_id);
CREATE INDEX idx_favorites_target ON favorites (target_type, target_id);

-- Refresh tokens
CREATE TABLE refresh_tokens
(
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked    BOOLEAN     NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens (token_hash);

-- Albums: support both Personal Library and Space ownership
ALTER TABLE albums ALTER COLUMN personal_library_id DROP NOT NULL;

ALTER TABLE albums ADD COLUMN space_id UUID REFERENCES spaces (id) ON DELETE CASCADE;

ALTER TABLE albums ADD CONSTRAINT chk_album_ownership
    CHECK (
        (personal_library_id IS NOT NULL AND space_id IS NULL) OR
        (personal_library_id IS NULL AND space_id IS NOT NULL)
    );

CREATE INDEX idx_albums_space ON albums (space_id);

-- Browser sessions (cookie-backed auth)
CREATE TABLE browser_sessions
(
    id              UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    user_id         UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    session_hash    VARCHAR(64)              NOT NULL UNIQUE,
    csrf_token_hash VARCHAR(64)              NOT NULL,
    session_type    VARCHAR(32)              NOT NULL,
    user_agent_hash VARCHAR(64),
    ip_hash         VARCHAR(64),
    expires_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at      TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_browser_sessions_user_id ON browser_sessions (user_id);
CREATE INDEX idx_browser_sessions_expires_at ON browser_sessions (expires_at);
CREATE INDEX idx_browser_sessions_revoked_at ON browser_sessions (revoked_at);
