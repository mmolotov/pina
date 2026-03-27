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
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_photos_uploader ON photos (uploader_id);
CREATE INDEX idx_photos_personal_library ON photos (personal_library_id);
CREATE UNIQUE INDEX idx_photos_content_hash ON photos (content_hash);
CREATE INDEX idx_photos_taken_at ON photos (taken_at);

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
