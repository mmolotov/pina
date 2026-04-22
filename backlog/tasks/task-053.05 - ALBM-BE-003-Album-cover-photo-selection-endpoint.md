---
id: TASK-053.05
title: ALBM-BE-003 Album cover photo selection endpoint
status: To Do
assignee: []
created_date: '2026-04-22 12:15'
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
- [ ] #1 `PUT /albums/{id}/cover` stores the chosen photo id when the caller owns the album and the photo belongs to that album
- [ ] #2 `PUT /albums/{id}/cover` returns 404 for non-owner callers and 400/404 when the photo is not part of the album (per project error conventions)
- [ ] #3 `DELETE /albums/{id}/cover` clears `cover_photo_id` and the list endpoint falls back to auto-resolved cover
- [ ] #4 `AlbumService.removePhoto` clears `cover_photo_id` when the removed photo is the current cover
- [ ] #5 Integration tests cover: set cover, clear cover, remove cover-photo from album (cover cleared), delete underlying photo (cover cleared via FK), unauthorized caller
<!-- AC:END -->
