-- Tokenized read-only public share links for albums. The raw token is never
-- stored; only the SHA-256 hash is persisted so that a database leak cannot
-- reveal live tokens. Revocation is a soft flag (revoked_at), expiry is
-- optional (expires_at NULL = no expiry).
CREATE TABLE album_share_links
(
    id         UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    album_id   UUID                     NOT NULL REFERENCES albums (id) ON DELETE CASCADE,
    token_hash VARCHAR(64)              NOT NULL UNIQUE,
    created_by UUID                     NOT NULL REFERENCES users (id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_album_share_links_album ON album_share_links (album_id);
