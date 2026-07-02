-- Soft-delete ("Корзина" / Trash) support.
--
-- A NULL deleted_at means the row is live; a non-NULL value is the instant the
-- row entered the trash. Items are retained for a configurable window
-- (pina.trash.retention-days, default 30 days) and then permanently purged by
-- TrashPurgeJob. While in the trash an item still occupies storage — soft-delete
-- never touches variants; only purge deletes them.
--
-- Every normal read hides trashed rows via the Photo/Album entity
-- @SQLRestriction("deleted_at is null"). The trash listing, restore, and purge
-- paths use native SQL so they can still see trashed rows.

ALTER TABLE photos ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE albums ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;

-- Attribution for who trashed a row. Unused in v1 (personal content is
-- owner-scoped) but recorded ahead of Space-content trashing so the column does
-- not need a later backfill. SET NULL keeps trashed rows if the actor is removed.
ALTER TABLE photos ADD COLUMN deleted_by UUID REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE albums ADD COLUMN deleted_by UUID REFERENCES users (id) ON DELETE SET NULL;

-- Partial indexes: only the trash listing and the purge sweep ever filter on
-- deleted_at, and both only care about trashed rows. Indexing just the trashed
-- rows keeps these indexes tiny and leaves the hot path (deleted_at IS NULL)
-- untouched.
CREATE INDEX idx_photos_deleted_at ON photos (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_albums_deleted_at ON albums (deleted_at) WHERE deleted_at IS NOT NULL;
