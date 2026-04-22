-- Album cover photo: explicit user choice; auto-fallback to the newest photo
-- is resolved at read time. ON DELETE SET NULL keeps the album usable if the
-- cover photo is deleted.
ALTER TABLE albums
    ADD COLUMN cover_photo_id UUID REFERENCES photos (id) ON DELETE SET NULL;

CREATE INDEX idx_albums_cover_photo ON albums (cover_photo_id);
