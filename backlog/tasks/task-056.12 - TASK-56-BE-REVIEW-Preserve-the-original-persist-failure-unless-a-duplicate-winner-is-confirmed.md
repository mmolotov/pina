---
id: TASK-056.12
title: >-
  TASK-56-BE-REVIEW Preserve the original persist failure unless a duplicate
  winner is confirmed
status: Done
assignee:
  - '@maksim'
created_date: '2026-04-30 06:56'
updated_date: '2026-04-30 07:56'
labels:
  - backend
  - review
  - photos
  - reliability
dependencies: []
references:
  - backend/src/main/java/dev/pina/backend/service/PhotoService.java
documentation:
  - >-
    backlog/tasks/task-056.05 -
    TASK-56-BE-REVIEW-Prevent-duplicate-uploads-from-observing-half-built-photos.md
parent_task_id: TASK-056
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Review follow-up for TASK-056. `PhotoService.runHeavyPhase` catches any `PersistenceException` from the final persist transaction and treats it as the same-uploader duplicate race. If the persist failure is caused by something else, the code deletes stored files and then throws `IllegalStateException("Duplicate hash conflict but photo not found: ...")` when no winner exists, masking the real database failure. The race path should only return an existing photo when a duplicate winner is actually found; otherwise the original persist exception should remain visible for correct diagnostics and incident response.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The duplicate-race handler only returns an existing Photo when a same-uploader same-hash winner is found after the persist failure.
- [x] #2 If no duplicate winner exists, the original `PersistenceException` is rethrown or preserved as the primary cause after storage cleanup.
- [x] #3 Stored files are still cleaned up for both confirmed duplicate losers and non-duplicate persist failures.
- [x] #4 Regression coverage simulates a non-duplicate persist failure and asserts that the surfaced error is not replaced by the misleading duplicate-conflict message.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Update `PhotoService.runHeavyPhase` persistence-failure branch:
   - keep deleting `VariantSpec` storage files immediately after the final persist transaction fails;
   - run the same-uploader same-hash lookup in a fresh transaction;
   - return the winner only when that lookup actually finds a `Photo`;
   - if no winner exists, rethrow the original `PersistenceException` as the primary failure;
   - if the winner lookup itself fails, attach that lookup failure as suppressed and still rethrow the original persist failure.

2. Add regression coverage in `PhotoUploadIsolationTest`:
   - mock `StorageProvider.store(...)` to succeed and record every stored path;
   - upload a valid image with an overlong `originalFilename` so final `Photo` persist fails for a non-duplicate database reason;
   - assert the surfaced failure is not the misleading `Duplicate hash conflict but photo not found` error and preserves the persistence failure;
   - assert every successfully stored path is passed to `storage.delete(...)`.

3. Validate with focused backend test(s), then run backend `./gradlew test`, `spotlessCheck`, and `spotbugsMain` if the focused test passes.

4. Mark acceptance criteria complete and finalize the task with validation notes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated `PhotoService.runHeavyPhase` so the `PersistenceException` branch no longer assumes every persist failure is a duplicate race. It deletes stored files first, then performs a fresh same-uploader same-hash lookup and only returns a winner if one exists.

If the winner lookup does not find a `Photo`, the original `PersistenceException` is rethrown as the primary failure. If the lookup itself fails, that lookup failure is added as suppressed to the original persist failure before rethrowing.

Added `PhotoUploadIsolationTest.nonDuplicatePersistFailurePreservesOriginalFailureAndCleansStoredFiles`, which stores variants successfully, then forces a real non-duplicate DB persist failure through an overlong `originalFilename`. The test asserts the duplicate-conflict fallback is not surfaced, the persistence failure remains primary, stored files are deleted, and no Photo row remains.

Validation: `./gradlew test --tests dev.pina.backend.service.PhotoUploadIsolationTest` passed; `./gradlew test` passed; `./gradlew spotlessCheck spotbugsMain` passed; `git diff --check` passed. The test run logs the intentional Postgres `value too long for type character varying(512)` error from the regression case, but the build is successful.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Changes

- Fixed `PhotoService.runHeavyPhase` so final-persist `PersistenceException` is treated as a duplicate race only when a fresh lookup confirms a same-uploader same-hash winner exists.
- Preserved the original persist failure when no winner exists, with any lookup failure attached as suppressed instead of replacing the root cause.
- Kept stored-file cleanup for both confirmed duplicate losers and non-duplicate persist failures.
- Added regression coverage that forces a non-duplicate DB persist failure via an overlong filename and verifies the duplicate fallback no longer masks the real persistence error.

## Validation

- `./gradlew test --tests dev.pina.backend.service.PhotoUploadIsolationTest` — passed
- `./gradlew test` — passed
- `./gradlew spotlessCheck spotbugsMain` — passed
- `git diff --check` — passed

The regression test intentionally triggers and logs PostgreSQL `value too long for type character varying(512)` during the successful test run.
<!-- SECTION:FINAL_SUMMARY:END -->
