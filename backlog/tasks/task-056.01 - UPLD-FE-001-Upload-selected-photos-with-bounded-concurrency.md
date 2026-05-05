---
id: TASK-056.01
title: UPLD-FE-001 Upload selected photos with bounded concurrency
status: Done
assignee:
  - maksim
created_date: '2026-04-28 06:35'
updated_date: '2026-04-28 07:36'
labels:
  - frontend
  - performance
  - photos
dependencies: []
parent_task_id: TASK-056
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Today both upload entry points (`app/routes/app-library.tsx` `uploadSelectedFiles` around line 1571 and `app/routes/app-album-detail.tsx` around line 596) iterate the selected files in a sequential `for…of` loop and `await uploadPhoto(file)` one at a time. When a user drops 30+ photos, each request waits for the previous response, even though the backend and the network could serve several in parallel.

Switch the upload loop to a bounded-concurrency worker pool so several uploads are in flight at once, while keeping a configurable upper limit so we do not flood the backend connection pool or the user's uplink. Progress reporting (`uploadProgress`, `createUploadProgress`) and per-file error collection (`failedUploads`) must keep working — the user still needs to see how many files have been processed and which ones failed. The "currently uploading file name" UX may change semantics (one of N), update the i18n string if needed.

Concurrency limit should live in one place (constant or config) and default to a conservative value (suggested: 3). Behavior when one upload fails must remain the same as today: collect the error, continue with the rest, surface the aggregated message at the end. Aborting the whole batch on the first failure is explicitly not desired.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When a user uploads N files (N > concurrency limit) from the library page or the create-album dialog, up to the concurrency limit are in flight simultaneously and the rest are queued
- [x] #2 Concurrency limit is defined as a single named constant and is easy to tune; default value is documented in the code
- [x] #3 Per-file failure does not abort the batch: failed file names and errors are still collected and shown, successful files are still added to the library/album
- [x] #4 Upload progress UI continues to show total/completed counts and remains monotonic (completed never decreases); the 'current file name' string still reads sensibly when multiple uploads run in parallel
- [x] #5 Existing Vitest suites for `app-library.tsx` and `app-album-detail.tsx` pass; new tests cover: parallel dispatch up to the limit, ordering of completed counter increments, and partial-failure handling
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Approach

Replace the three sequential upload loops with a small bounded-concurrency helper. No backend changes; no new bulk endpoint (decided to keep per-file requests for simpler error handling, dedup race protection, and resumability).

## Files

- **New:** `frontend/app/lib/concurrency.ts` — exposes `PHOTO_UPLOAD_CONCURRENCY = 3` and `runWithConcurrency<T, R>(items, limit, worker)`. Returns results in input order as `{ ok: true, value } | { ok: false, error }` so callers can preserve ordering and aggregate failures without aborting the batch.
- **New:** `frontend/app/lib/concurrency.test.ts` — unit tests for the helper.
- **Edit:** `frontend/app/routes/app-library.tsx` — `uploadSelectedFiles` (~1571) and `handleCreateAlbumUploads` (~1697).
- **Edit:** `frontend/app/routes/app-album-detail.tsx` — `handleUploadFiles` (~568); both `uploadPhoto` and `addPhotoToAlbum` run inside the worker.
- **Edit:** `frontend/app/routes/app-library.test.tsx` and `app-album-detail.test.tsx` — add tests for parallel dispatch up to the limit, monotonic completed counter, and partial-failure handling.

## Progress UX

- `completed` increments inside each worker's `finally` (atomic, monotonic).
- `currentFileName` is the most recently started in-flight file: track an in-flight stack inside each handler; on settle remove the file and fall back to the previous top. UI strings stay unchanged.

## Validation

`npm run check` and `npm test` from `frontend/`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added `frontend/app/lib/concurrency.ts` exposing `PHOTO_UPLOAD_CONCURRENCY = 3`, the generic `runWithConcurrency<T, R>(items, limit, worker, hooks)` worker pool (results returned in input order as `{ ok, value | error }`), and a small `createUploadBatchTracker(files, emit)` helper that tracks an in-flight stack of File objects so progress UI shows the most recently started file name and the completed counter is monotonic.

Refactored three upload loops to use the helper:
- `app/routes/app-library.tsx` `uploadSelectedFiles` (~1564) — library batch input
- `app/routes/app-library.tsx` `handleCreateAlbumUploads` (~1676) — create-album dialog; `uploadedPhotos` is rebuilt from the ordered results so the prepended order in the photos list stays deterministic
- `app/routes/app-album-detail.tsx` `handleUploadFiles` (~568) — both `uploadPhoto` and `addPhotoToAlbum` execute inside a single worker so the per-file album-add also benefits from parallelism

Per-file failure is collected as before; the batch is never aborted on a single error. UI strings were left unchanged because the existing `currentFileName` semantics still hold (display the most recent in-flight file).

Tests:
- `frontend/app/lib/concurrency.test.ts` — 7 unit tests covering the dispatch limit, input-order results, partial failures, hook invocation, empty input, and limit validation
- `frontend/app/routes/app-library.test.tsx` — added "dispatches uploads in parallel up to the concurrency limit and reports partial failures": uses 5 deferred uploads, verifies exactly 3 are in flight, queueing dynamics on each settle, and rejects one upload mid-batch
- `frontend/app/routes/app-album-detail.test.tsx` — analogous test for the album add-photos panel, asserting `addPhotoToAlbum` is called only for successful uploads

Validation: `npm run check` (format/lint/stylelint/design-guard/typecheck) and `npm run test` (147 tests) green; `npm run build` succeeds.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Changes

### New
- `frontend/app/lib/concurrency.ts` — bounded-concurrency worker pool plus an in-flight tracker for batch upload progress.
- `frontend/app/lib/concurrency.test.ts` — 7 unit tests.

### Edited
- `frontend/app/routes/app-library.tsx` — `uploadSelectedFiles` and `handleCreateAlbumUploads` now dispatch up to `PHOTO_UPLOAD_CONCURRENCY` (3) uploads in parallel; results are reordered by input index so the photos list stays deterministic.
- `frontend/app/routes/app-album-detail.tsx` — `handleUploadFiles` runs `uploadPhoto` + `addPhotoToAlbum` inside the worker pool so both calls parallelize.
- `frontend/app/routes/app-library.test.tsx` and `app-album-detail.test.tsx` — new tests for parallel dispatch limit and partial-failure handling.

## Behavior

- Concurrency is capped at a single named constant (`PHOTO_UPLOAD_CONCURRENCY = 3`) — easy to tune in one place.
- Per-file failure collects the error and continues the batch; success message and aggregated failure message work as before.
- Progress UI is monotonic: `completed` only increments inside each worker's settle, and `currentFileName` follows the most recently started in-flight file.
- No backend changes; per-file `POST /api/v1/photos` keeps the existing dedup race protection.

## Validation

- `npm run check` — clean
- `npm run test` — 147 tests passing
- `npm run build` — clean
<!-- SECTION:FINAL_SUMMARY:END -->
