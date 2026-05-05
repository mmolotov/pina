---
id: TASK-056.08
title: >-
  TASK-56-BE-REVIEW Clean up partial thumbnail temp files on pyramid
  construction failure
status: Done
assignee:
  - maksim
created_date: '2026-04-29 07:16'
updated_date: '2026-04-29 12:45'
labels:
  - backend
  - review
  - photos
  - reliability
dependencies: []
references:
  - backend/src/main/java/dev/pina/backend/service/ImageProcessor.java
  - backend/src/main/java/dev/pina/backend/service/ProcessedImage.java
  - backend/src/main/java/dev/pina/backend/service/PhotoVariantGenerator.java
documentation:
  - >-
    backlog/tasks/task-056.03 -
    UPLD-BE-002-Build-thumbnails-as-a-pyramid-from-one-resized-intermediate.md
parent_task_id: TASK-056
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Review follow-up for TASK-056. `ImageProcessor.thumbnailPyramid()` now creates several `ProcessedImage` temp files before returning the pyramid to the caller. If a later resize/write step throws before the method returns, the already-created temp files are never closed, so they leak on the local filesystem. Cleanup must happen inside pyramid construction for all partially built intermediates, not only after the caller receives them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Any failure while building the thumbnail pyramid deletes every temp file created earlier in the same pyramid attempt
- [x] #2 Cleanup does not depend on the caller closing `ProcessedImage` handles that were never returned
- [x] #3 Automated coverage injects a mid-pyramid failure and asserts no temp files remain behind
- [x] #4 The cleanup path preserves the original failure that caused pyramid construction to abort
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Three leak sites to fix

1. `ImageProcessor.writeBuffered` — `createTempFile` succeeds, then a subsequent `Thumbnails.of(...).toOutputStream` throw leaves the temp file behind.
2. `ImageProcessor.compress` — same shape: temp file created, encode may throw.
3. `ImageProcessor.thumbnailPyramid` — the main leak. Four `ProcessedImage` instances are created sequentially; on a mid-step failure, the caller never receives the `ThumbnailPyramid` record and therefore never gets a chance to close the already-built handles.

## Fix

- Wrap `writeBuffered` and `compress` in try/catch that calls `Files.deleteIfExists` on the temp path before rethrowing.
- In `thumbnailPyramid`, track each successfully built `ProcessedImage` in a list; on any `IOException` or `RuntimeException`, close all tracked handles (suppressing close exceptions onto the original) before rethrowing.
- Drop `private` on `writeBuffered` to package-private so the regression test can override it.

## Test

`ImageProcessorPyramidCleanupTest` (pure JUnit, not `@QuarkusTest` so it can subclass `ImageProcessor`):

1. Mock `PhotoConfig` with `RETURNS_DEEP_STUBS`; stub the dimensions/format/quality used by the pyramid.
2. Snapshot `/tmp` for files matching `pina-processed-*`.
3. Use an anonymous subclass of `ImageProcessor` whose `writeBuffered` increments a counter and throws on the third call.
4. Assert `thumbnailPyramid(source)` throws and that the snapshot of `pina-processed-*` files is unchanged afterwards.

## Validation

`./gradlew spotlessApply spotbugsMain test` from `backend/`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Three leak sites fixed in `ImageProcessor`

1. **`writeBuffered`** — wraps the encode-and-write in a try/catch that calls `Files.deleteIfExists(tempFile)` before rethrowing. Failures during `Thumbnails.of(...).toOutputStream(...)` no longer leave the freshly-created temp file behind.
2. **`compress`** — same pattern: `createTempFile` followed by encode is now guarded; an encode failure deletes the temp file and rethrows the original exception.
3. **`thumbnailPyramid`** — every successfully built `ProcessedImage` is appended to a tracking list. On any `IOException` or `RuntimeException` during construction (whether from `Thumbnails.of(...).asBufferedImage()` or `writeBuffered`), all already-built handles are closed (which deletes their temp files via `ProcessedImage.close()`), and the original failure is rethrown. `close()` exceptions are attached as `addSuppressed` so they cannot mask the root cause.

The `writeBuffered` method was demoted from `private` to package-private so the regression test can override it via subclassing.

### Regression test

`ImageProcessorPyramidCleanupTest` is a pure JUnit test (no `@QuarkusTest`) so it can subclass `ImageProcessor`:

1. Mocks `PhotoConfig` with `RETURNS_DEEP_STUBS`; stubs the dimensions and format used by the pyramid.
2. Snapshots `pina-processed-*` files in the system temp dir.
3. Anonymous subclass of `ImageProcessor` overrides `writeBuffered` to throw on the third call (after LG and MD have been written, before SM).
4. Asserts `thumbnailPyramid(source)` rethrows the injected `IOException` unchanged (`assertEquals(injected, thrown)`), proving AC #4 — the original failure is preserved.
5. Re-snapshots the temp dir and asserts no new `pina-processed-*` files remain — proving AC #1, #2, #3.

### Validation

- `./gradlew test` — 438 tests, 0 failures, 0 errors
- `./gradlew spotlessCheck spotbugsMain` — clean
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Changes

### Edited
- `backend/src/main/java/dev/pina/backend/service/ImageProcessor.java` — `writeBuffered`, `compress`, and `thumbnailPyramid` now delete the temp files they created on any failure path. Pyramid construction tracks every successfully built `ProcessedImage` and closes them in a single catch block before rethrowing the original exception. `writeBuffered` is now package-private (was `private`) so the regression test can override it.

### New
- `backend/src/test/java/dev/pina/backend/service/ImageProcessorPyramidCleanupTest.java` — pure JUnit test that injects a deterministic mid-pyramid failure (override of `writeBuffered` throws on the third call) and asserts no `pina-processed-*` temp files leak to disk, while the original `IOException` is propagated unchanged.

## Behavior

- A mid-pyramid failure no longer leaves orphan thumbnail temp files in `/tmp` regardless of which step throws.
- The original failure is preserved: any close-time exceptions during cleanup are attached via `addSuppressed`.
- No change to the success path or to public method signatures (only the access modifier on `writeBuffered`).

## Validation

- `./gradlew test` — 438 tests, 0 failures
- `./gradlew spotlessCheck spotbugsMain` — clean
<!-- SECTION:FINAL_SUMMARY:END -->
