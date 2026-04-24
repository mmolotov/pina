---
id: TASK-053.21
title: >-
  TASK-53-BE-REVIEW Lock album row when writing cover photo to avoid races with
  delete
status: Done
assignee: []
created_date: '2026-04-24 05:30'
updated_date: '2026-04-24 09:18'
labels:
  - backend
  - data-consistency
  - concurrency
  - review
dependencies: []
references:
  - backend/src/main/java/dev/pina/backend/service/AlbumService.java
  - backend/src/test/java/dev/pina/backend/api/AlbumResourceTest.java
parent_task_id: TASK-053
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`AlbumService.setCoverPhoto` and `AlbumService.clearCoverPhoto` load the album through an unlocked `Album.findByIdOptional(albumId)` and then mutate `coverPhoto`. `AlbumService.delete` was previously hardened with `LockModeType.PESSIMISTIC_WRITE` (commit 5d51856) precisely to avoid concurrent-write/delete races on albums. The new cover endpoints regress that protection: a concurrent `DELETE /albums/{id}` can commit between the cover-write read and flush, causing either a lost update against a re-inserted row or a constraint violation surfaced to the caller.

Acceptance Criteria:
- [x] Cover write paths (set and clear) acquire the same pessimistic lock as `delete` before mutating the album.
- [x] Concurrent set-cover / delete scenarios return clean 404 responses instead of 500s.
- [x] Regression coverage exercises the race in the backend test suite, in line with TASK-052's existing concurrency tests.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Switched `setCoverPhoto` and `clearCoverPhoto` to load the album row through the same `PESSIMISTIC_WRITE` path already used by `delete`.

Added lock-contention tests with a transactional helper bean that holds an album row lock in one thread and verifies the cover write paths block until that lock is released.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Hardened the album cover write paths against concurrent delete races by acquiring a pessimistic write lock before mutating `coverPhoto`. Service-level regression coverage now proves that both set-cover and clear-cover wait on an existing album row lock instead of racing past it.
<!-- SECTION:FINAL_SUMMARY:END -->
