---
id: TASK-053.05
title: ALBM-BE-003 Album cover photo selection endpoint
status: Done
assignee: []
created_date: '2026-04-22 12:15'
updated_date: '2026-04-23 06:31'
labels:
  - backend
  - api
dependencies:
  - TASK-053.01
parent_task_id: TASK-053
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context

ALBM-BE-001 introduces the `albums.cover_photo_id` column and an auto-fallback for un-set covers. This task adds the user-facing endpoint to choose / clear the cover.

## What to build

- `PUT /api/v1/albums/{id}/cover` — body `{ "photoId": "<uuid>" }`. Validates:
  - album exists and caller owns it (same ownership check used elsewhere in `AlbumResource`)
  - photo is already a member of the album (reject otherwise with 400 or 404, whichever matches project conventions)
- `DELETE /api/v1/albums/{id}/cover` — clears the cover (falls back to auto in the list response).
- If a photo is removed from the album or deleted and it is currently the cover, the FK's `ON DELETE SET NULL` handles deletion; also clear `cover_photo_id` inside `AlbumService.removePhoto` so the album doesn't keep a stale cover after membership removal.

## Dependencies

- ALBM-BE-001 (TASK-053.01).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `PUT /albums/{id}/cover` stores the chosen photo id when the caller owns the album and the photo belongs to that album
- [x] #2 `PUT /albums/{id}/cover` returns 404 for non-owner callers and 400/404 when the photo is not part of the album (per project error conventions)
- [x] #3 `DELETE /albums/{id}/cover` clears `cover_photo_id` and the list endpoint falls back to auto-resolved cover
- [x] #4 `AlbumService.removePhoto` clears `cover_photo_id` when the removed photo is the current cover
- [x] #5 Integration tests cover: set cover, clear cover, remove cover-photo from album (cover cleared), delete underlying photo (cover cleared via FK), unauthorized caller
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Added `SetAlbumCoverRequest` DTO with `@NotNull UUID photoId` validation.
- `AlbumService.setCoverPhoto` returns a sealed `SetCoverResult` (`Set(Album)` / `AlbumNotFound` / `PhotoNotInAlbum`), so the resource reuses the mutated in-tx instance for the response — avoids a staleness issue where the resource's pre-loaded album survived the `@Transactional` boundary and overrode the updated field in the subsequent `findById`.
- `AlbumService.clearCoverPhoto` returns `Optional<Album>` following the same pattern.
- `AlbumService.removeFetchedPhotoReference` now issues a JPQL `UPDATE Album SET coverPhoto = null WHERE id = :albumId AND coverPhoto.id = :photoId` before deleting the `AlbumPhoto`, so removal from membership clears the cover (auto-fallback kicks in on the next read).
- `albums.cover_photo_id` uses `ON DELETE SET NULL` (already in V02 migration) so deleting the underlying photo also clears the cover.
- `AlbumResource` exposes `PUT /albums/{id}/cover` and `DELETE /albums/{id}/cover`. Both do an ownership pre-check and then delegate; the PUT pattern-matches on the sealed result; the DELETE uses the returned `Optional<Album>`.
- 6 new integration tests in `AlbumResourceTest`: explicit set, clear with auto-fallback, non-member photo, remove-cover-from-album, delete-cover-photo-via-FK, non-owner 404.
<!-- SECTION:NOTES:END -->
