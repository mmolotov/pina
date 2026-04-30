---
id: TASK-056.10
title: >-
  TASK-56-FE-REVIEW Prevent overlapping photo upload batches from bypassing
  concurrency limits
status: Done
assignee:
  - '@maksim'
created_date: '2026-04-30 06:56'
updated_date: '2026-04-30 07:10'
labels:
  - frontend
  - review
  - photos
  - performance
  - reliability
dependencies: []
references:
  - frontend/app/routes/app-library.tsx
  - frontend/app/routes/app-album-detail.tsx
  - frontend/app/lib/concurrency.ts
documentation:
  - >-
    backlog/tasks/task-056.01 -
    UPLD-FE-001-Upload-selected-photos-with-bounded-concurrency.md
parent_task_id: TASK-056
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Review follow-up for TASK-056. The frontend limits a single upload batch with `PHOTO_UPLOAD_CONCURRENCY = 3`, but several entry points can start another batch while one is already running. In `app-library.tsx`, the header file input is disabled via `uploadingPhoto`, but the library dropzone still calls `uploadSelectedFiles(...)` during an active upload. In `app-album-detail.tsx`, the add-photos file input is never disabled or guarded while `uploadProgress` is non-null. Starting overlapping batches multiplies effective request concurrency beyond the intended limit, interleaves progress state, and can clear busy/progress state when the first batch finishes while later batches are still active.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All library upload entry points, including drag-and-drop, reject or ignore a new batch while a batch is already active.
- [x] #2 Album-detail add-photos upload controls cannot start a second batch while `uploadProgress` is non-null or equivalent upload-busy state is active.
- [x] #3 Finishing one batch cannot clear busy/progress state for another still-running batch.
- [x] #4 Frontend tests cover attempted overlapping uploads from file input/drop paths and verify total dispatched requests stay within the intended per-view limit.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Add explicit in-flight guards to the frontend upload handlers:
   - `app-library.tsx`: make `uploadSelectedFiles` return early when `uploadingPhoto` is already true, and make the drag/drop path respect the same guard so all library upload entry points share one busy state.
   - `app-album-detail.tsx`: introduce an upload-busy guard based on the current progress/in-flight state, disable the file input while active, and return early if a second batch is attempted.

2. Avoid stale React state races where needed with refs:
   - Use a ref-backed flag for upload activity so back-to-back events in the same render window cannot start a second batch before state has re-rendered.
   - Clear the ref only in the matching batch's `finally` path, preventing an older batch from clearing another batch's busy state.

3. Add regression coverage:
   - Library route: attempt a second upload via the dropzone while the first batch is stalled; assert no extra uploads dispatch beyond `PHOTO_UPLOAD_CONCURRENCY`.
   - Album-detail route: attempt a second upload while the first is stalled; assert no extra uploads dispatch and controls remain locked/guarded.

4. Validate with frontend typecheck/tests, and update the task with checked acceptance criteria and final notes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented ref-backed upload batch guards in `app-library.tsx` for the main library upload flow and create-album upload flow. The refs are set before `runWithConcurrency` starts and cleared in the owning batch's `finally`, so stale React state cannot admit a second batch in the same render window.

Implemented the same ref-backed guard in `app-album-detail.tsx` and disabled the add-photos file input while upload progress is active. Programmatic repeated change events are still ignored by the handler guard.

Added regression tests for a library drop attempt during an active batch and an album-detail second file selection during an active batch. Both tests saturate the pool at 3 in-flight uploads and assert no extra `uploadPhoto` call is made for the ignored file.

Validation: `npm run typecheck` passed; `npm test -- --run app-library.test.tsx app-album-detail.test.tsx` passed (34 tests); full `npm test -- --run` passed (40 files, 149 tests); `git diff --check` passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Changes

- Added ref-backed in-flight guards for frontend upload batches so a second batch cannot start before React has re-rendered busy state.
- Guarded the main library upload path, library drag-and-drop path, create-album upload path, and album-detail add-photos upload path.
- Disabled the album-detail file input while upload progress is active, and made create-album drop handling ignore drops during an upload.
- Added regression coverage proving a second drop/selection during an active batch does not dispatch additional uploads beyond the intended concurrency limit.

## Validation

- `npm run typecheck` — passed
- `npm test -- --run app-library.test.tsx app-album-detail.test.tsx` — 34 tests passed
- `npm test -- --run` — 40 files / 149 tests passed
- `git diff --check` — passed

## Notes

The existing `PHOTO_UPLOAD_CONCURRENCY = 3` behavior remains unchanged for a single batch. This task only prevents overlapping batches in the same view from multiplying that limit and corrupting progress state.
<!-- SECTION:FINAL_SUMMARY:END -->
