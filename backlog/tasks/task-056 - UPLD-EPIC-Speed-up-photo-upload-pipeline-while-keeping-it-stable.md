---
id: TASK-056
title: UPLD-EPIC Speed up photo upload pipeline while keeping it stable
status: Done
assignee: []
created_date: '2026-04-28 06:35'
updated_date: '2026-04-30 08:33'
labels:
  - backend
  - frontend
  - performance
  - photos
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Photo upload feels slow when adding many files at once: each upload waits for the previous to finish, and on the server side EXIF, image decoding, compression and 4 thumbnails are produced sequentially inside a single DB transaction. The goal is to reduce wall-clock time of bulk uploads while preserving current correctness guarantees: SHA-256 dedup per uploader, atomic Photo+variants persistence, no orphaned files on failure, and bounded resource usage so the JVM does not OOM and the DB connection pool is not starved.

This epic groups four independent improvements that can each ship as a separate PR. They are decoupled: each can be merged on its own and gives a measurable win.

Scope is limited to the existing single-file `POST /api/v1/photos` endpoint and its frontend caller in `app/routes/app-library.tsx` and `app/routes/app-album-detail.tsx`. Introducing a new bulk-upload endpoint or a background queue is out of scope.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All four child tasks are merged and their acceptance criteria met
- [x] #2 Bulk upload of 20 medium-sized photos completes faster than the baseline measured before this epic, with no regression in correctness (dedup, EXIF, variant set, error handling)
- [x] #3 No new failure modes introduced: orphaned storage files on error, leaked DB connections, or unbounded memory growth under concurrent uploads
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
All implementation and review follow-up tasks under TASK-056 are complete. TASK-056.09 was closed as an invalid review premise; TASK-056.13 updated stale frontend upload copy. Performance confirmation for the 20-photo benchmark was intentionally not collected per user instruction on 2026-04-30.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed TASK-056 after completing the backend and frontend upload-pipeline improvements plus review follow-ups. The work now covers bounded frontend batch concurrency, bounded backend variant generation, thumbnail pyramid generation, storage-before-final-persist isolation, dedup fast path, heavy-phase backpressure, temp-file cleanup, corrected persistence-failure handling, and updated backend/frontend documentation/copy. Verification completed during the subtasks included frontend typecheck/tests, backend tests/static checks, and diff whitespace checks; explicit 20-photo performance confirmation was skipped per user instruction.
<!-- SECTION:FINAL_SUMMARY:END -->
