---
id: TASK-053.26
title: 'TASK-53-BE-REVIEW Expose GET /albums/{id} for single-album fetch'
status: Done
assignee: []
created_date: '2026-04-24 06:44'
updated_date: '2026-04-24 08:55'
labels:
  - backend
  - albums
  - api
  - review
dependencies: []
parent_task_id: TASK-053
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context

TASK-053.15 asks the frontend to stop using `listAlbums()` to locate a single album by id on the album-detail and album-photo-detail routes. The frontend needs a targeted `GET /api/v1/albums/{id}` endpoint that returns the same `AlbumDto` shape produced by `albumService.getSummary(...)` (already used in the list response). The endpoint does not exist today — `AlbumResource` only exposes `GET /albums`, `GET /albums/{id}/photos`, `PUT /albums/{id}`, and `DELETE /albums/{id}`.

## Scope

Add `GET /api/v1/albums/{id}` in `backend/src/main/java/dev/pina/backend/api/AlbumResource.java`:

- Resolve the current user via `userResolver.currentUser()`.
- `albumService.findById(id)` then filter on `album.owner.id.equals(user.id)`.
- Return `Response.ok(AlbumDto.fromSummary(albumService.getSummary(album)))`.
- 404 with `ApiErrors.notFound("Album not found")` otherwise.
- Mirror the authorization check used elsewhere in the resource.

Add an integration test covering: happy path, cross-tenant access → 404, unknown id → 404.

## Why

Unblocks TASK-053.15 (bounded album-detail fetches). Without it the frontend must continue fetching the full album list and filter client-side, which defeats the purpose of the review fix.

## Acceptance criteria

- [x] New `GET /albums/{id}` endpoint returns the same DTO shape as the list endpoint items.
- [x] Cross-user access returns 404, not 403.
- [x] Integration test covers the three cases above.
- [x] No regressions to existing `AlbumResource` endpoints.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added `GET /api/v1/albums/{id}` to `AlbumResource` with the same owner-only visibility model already used by the other personal album endpoints.

Extended `AlbumResourceTest` with happy-path, cross-user, and unknown-id coverage, and verified the change with `./gradlew test --tests 'dev.pina.backend.api.AlbumResourceTest'` plus `./gradlew spotlessCheck`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the single-album fetch endpoint required by the frontend performance review fix. Personal album routes can now resolve one album directly through `GET /albums/{id}` instead of downloading the full album list, and backend integration coverage locks down owner access plus 404 behavior.
<!-- SECTION:FINAL_SUMMARY:END -->
