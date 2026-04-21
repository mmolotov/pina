---
id: TASK-052
title: Handle concurrent album-photo removal and album deletion without 500 errors
status: Done
assignee:
  - codex
created_date: '2026-04-21 10:31'
updated_date: '2026-04-21 10:38'
labels:
  - backend
  - bug
  - concurrency
  - albums
dependencies: []
references:
  - >-
    /Users/mama/dev/pina/backend/src/main/java/dev/pina/backend/service/AlbumService.java
  - >-
    /Users/mama/dev/pina/backend/src/main/java/dev/pina/backend/api/AlbumResource.java
documentation:
  - backend/README.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
During manual backend verification, a race was observed when requests that remove an album-photo reference and delete the same album/photo overlap. In the current implementation, `AlbumService.removePhoto()` loads and deletes a managed `AlbumPhoto` entity, while `AlbumService.delete()` bulk-deletes album references for the same album. Under concurrent execution this can surface `OptimisticLockException` / `StaleStateException` for `album_photos` deletion and return HTTP 500 instead of a client-safe outcome.

The backend should treat this as an expected concurrent modification case and return a stable non-500 response such as 204, 404, or existing domain-specific conflict semantics, without leaking an internal server error.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Concurrent deletion flows involving `DELETE /albums/{id}/photos/{photoId}` and album/photo deletion do not return HTTP 500 for already-removed album-photo rows.
- [x] #2 The backend handles stale `album_photos` deletion outcomes as an expected race and maps them to deterministic client-safe API behavior.
- [x] #3 Regression coverage exercises the concurrent removal/deletion path so the optimistic-lock/stale-row failure does not reappear silently.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Change `AlbumService.removePhoto(UUID albumId, UUID photoId, User actingUser, boolean canManageAlbum)` to perform permission validation from a fetched reference but execute the delete in an idempotent row-count-based way so a concurrently removed row returns `NOT_FOUND` instead of surfacing an optimistic-lock failure.
2. Preserve the current REST contract in `AlbumResource`: successful delete remains `204 No Content`, while a missing or already-removed album-photo reference maps to the existing not-found response rather than `500`.
3. Add regression coverage around the stale-row/concurrent-removal path so the service/API no longer leaks `OptimisticLockException` or `StaleStateException` when the row disappears between read and delete.
4. Run focused backend tests for album and search-adjacent behavior plus `spotlessCheck` to confirm the fix is stable and formatted.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Changed `AlbumService.removePhoto(...)` to keep permission validation from the fetched `AlbumPhoto` but perform the actual delete through a bulk row-count query. If the row disappears between read and delete, the service now returns `NOT_FOUND` instead of bubbling an optimistic-lock/stale-row exception.

Added `AlbumServiceTest.removePhotoReturnsNotFoundWhenReferenceDisappearsBeforeDelete()` to cover the stale-row path by deleting the album-photo reference after fetch and verifying the service maps the race to a stable result.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Hardened album-photo removal against concurrent delete races by changing `AlbumService.removePhoto(...)` to validate permissions from the fetched reference and then execute the delete via a row-count-based bulk delete. This keeps the existing API contract intact while turning an already-removed row into `NOT_FOUND` instead of leaking `OptimisticLockException` / `StaleStateException` as HTTP 500.

Added regression coverage in `AlbumServiceTest` for the stale-row path where the `AlbumPhoto` reference disappears after it has been read but before the delete executes. The test verifies the service returns `NOT_FOUND`, which is the deterministic client-safe behavior expected by the REST layer.

Validation performed: `./gradlew test --tests dev.pina.backend.service.AlbumServiceTest --tests dev.pina.backend.api.AlbumResourceTest` and `./gradlew spotlessCheck`.
<!-- SECTION:FINAL_SUMMARY:END -->
