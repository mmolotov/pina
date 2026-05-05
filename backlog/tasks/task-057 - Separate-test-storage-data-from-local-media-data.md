---
id: TASK-057
title: Separate test storage data from local media data
status: Done
assignee:
  - Codex
created_date: '2026-05-05 09:12'
updated_date: '2026-05-05 09:16'
labels:
  - backend
  - testing
dependencies: []
modified_files:
  - backend/build.gradle.kts
  - backend/src/test/resources/application.properties
  - backend/src/test/java/dev/pina/backend/storage/StorageConfigurationTest.java
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ensure automated backend tests write media/storage artifacts to an isolated test data location instead of the local development data directory, and clean those artifacts after test execution so local server media is not mixed with test output.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Backend tests use a test-specific storage/data directory distinct from the default local development data directory.
- [x] #2 Test-generated storage artifacts are removed automatically after test execution.
- [x] #3 The cleanup does not delete real local development media data.
- [x] #4 Relevant backend tests or build verification pass with the new configuration.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Override the local storage base path in the backend test profile so Quarkus tests write to a dedicated directory under `backend/build` instead of `backend/data`.
2. Add a Gradle cleanup task for that test storage directory and wire it into the `test` lifecycle so stale test artifacts are removed before and after tests.
3. Add a focused test/build-script assertion that documents the configured test storage path and guards against accidentally pointing cleanup at the real `data` directory.
4. Run the relevant backend test/build checks and update acceptance criteria based on the results.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented test storage isolation by setting `pina.storage.local.base-path=build/test-data` in backend test resources. Added Gradle `cleanTestStorageData` task that deletes only `layout.buildDirectory.dir("test-data")`; `test` deletes that directory at task start and finalizes with the cleanup task after execution. Added a plain JUnit configuration test so the guard does not require Docker/Testcontainers.

Verification: `./gradlew test --tests dev.pina.backend.storage.StorageConfigurationTest --tests dev.pina.backend.storage.LocalStorageProviderTest` passed. `./gradlew cleanTestStorageData` was also run against a probe file and removed `backend/build/test-data`. A Quarkus-based version of the config test was avoided because Docker/Testcontainers is not running in the local environment.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Summary:
- Backend test resources now override local storage to `build/test-data`, keeping test-generated media out of the real local `data` directory.
- Added Gradle `cleanTestStorageData`, wired as a finalizer for `test`, with a pre-test delete step so stale test storage does not affect later runs.
- Added `StorageConfigurationTest` to guard that test resources do not point local storage at `data`.

Verification:
- `./gradlew spotlessApply`
- `./gradlew test --tests dev.pina.backend.storage.StorageConfigurationTest --tests dev.pina.backend.storage.LocalStorageProviderTest`
- `./gradlew cleanTestStorageData` against a probe file in `backend/build/test-data`
<!-- SECTION:FINAL_SUMMARY:END -->
