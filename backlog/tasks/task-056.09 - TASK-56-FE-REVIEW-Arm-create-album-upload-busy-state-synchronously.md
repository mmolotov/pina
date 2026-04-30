---
id: TASK-056.09
title: TASK-56-FE-REVIEW Arm create-album upload busy state synchronously
status: Done
assignee: []
created_date: '2026-04-29 07:16'
updated_date: '2026-04-29 07:37'
labels:
  - frontend
  - review
  - photos
  - ux
dependencies: []
references:
  - frontend/app/routes/app-library.tsx
  - frontend/app/lib/concurrency.ts
documentation:
  - >-
    backlog/tasks/task-056.01 -
    UPLD-FE-001-Upload-selected-photos-with-bounded-concurrency.md
parent_task_id: TASK-056
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Review follow-up for TASK-056. The create-album upload flow no longer sets `createUploadProgress` synchronously before starting the worker pool. The dialog therefore remains closable and its upload controls remain enabled until the first asynchronous `onStart` hook fires, leaving a race where the user can close the dialog or trigger another batch after uploads have already started.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The create-album dialog enters its non-closable uploading state synchronously when a batch starts, before any asynchronous worker callback runs
- [ ] #2 Upload controls cannot start a second batch during the initial scheduling window
- [ ] #3 The progress UI shows an immediate initial snapshot for a started batch instead of remaining `null` until the first worker callback
- [ ] #4 Frontend tests cover the immediate-close or immediate-second-trigger race and verify the dialog stays locked while the batch is active
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Closed as invalid — premise does not hold

The review claims the create-album flow only sets `createUploadProgress` after an "asynchronous `onStart` hook fires". This is incorrect: `runWithConcurrency` calls `tracker.hooks.onStart(...)` synchronously inside `pump()`, before the worker hits its first `await`. JavaScript async-function semantics run the body synchronously up to the first `await` or `return`, so every spawned pump invokes `onStart` (and therefore `setCreateUploadProgress`) within the same synchronous tick that called `runWithConcurrency`.

In `handleCreateAlbumUploads`:

1. `runWithConcurrency(...)` is invoked synchronously.
2. Its for-loop spawns up to `PHOTO_UPLOAD_CONCURRENCY` pumps; each pump runs synchronously to its first `await worker(...)`, which means each calls `hooks.onStart` and therefore `setCreateUploadProgress(snapshot)` first.
3. Only then does `runWithConcurrency` itself reach `await Promise.all(workers)` and suspend, returning a Promise.
4. The handler's own `await runWithConcurrency(...)` suspends. By this point, React has already received every `setCreateUploadProgress` call and will re-render with a non-null `createUploadProgress` before any subsequent UI event handler runs.

Cancel/Close button handlers run as separate browser events, after the upload event handler completes synchronously and React flushes the state update. Their closures therefore see the new `createUploadProgress` and the existing guard in `closeCreateAlbumDialog` rejects the close. There is no observable race window.

Confirmation in `concurrency.test.ts`: the existing "never dispatches more than `limit` workers concurrently" test asserts `inFlight === 3` after only synchronous setup plus two microtask flushes — only possible because each pump's worker prefix already executed synchronously.

No production code change required. Closing without implementing the proposed fix.
<!-- SECTION:FINAL_SUMMARY:END -->
