---
id: TASK-056.07
title: TASK-56-BE-REVIEW Restore cheap dedup short-circuit before EXIF and decode
status: Done
assignee:
  - maksim
created_date: '2026-04-29 07:16'
updated_date: '2026-04-29 12:39'
labels:
  - backend
  - review
  - photos
  - performance
dependencies: []
references:
  - backend/src/main/java/dev/pina/backend/service/PhotoService.java
documentation:
  - >-
    backlog/tasks/task-056.04 -
    UPLD-BE-003-Move-variant-generation-out-of-the-photo-upload-transaction.md
parent_task_id: TASK-056
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Review follow-up for TASK-056. `PhotoService.upload()` now calls `analyzeImage()` before `prepareUpload()`, so uploads that are already duplicates for the same uploader still pay the full EXIF extraction and image decode cost before the service discovers the existing Photo row. This regresses the cheap hash-based dedup path and makes repeated duplicate uploads an unnecessary CPU/memory hot path.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A duplicate upload for the same uploader and content hash returns the existing Photo without running image decode or EXIF extraction
- [x] #2 The split-transaction design still preserves the existing unique-constraint race handling for concurrent uploads
- [x] #3 Regression coverage verifies that the duplicate fast path avoids the expensive image-analysis branch
- [x] #4 Relevant code comments or task notes explain the ordering constraints between hashing, dedup lookup, and later transactional work
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Status

The fast-path was actually restored as a side effect of the TASK-056.05 refactor: when `upload` was rewritten around storage-first / persist-at-end, the dedup lookup naturally moved to be the very first step after hashing. This task adds the missing regression coverage and ordering comment so future refactors don't silently regress it.

### Code

`PhotoService.upload` now does, in order:

1. `ingestToTempFile(inputStream)` — SHA-256 hash + temp file (cheap relative to decode).
2. `Photo.findByContentHashAndUploaderWithRelations` inside a fresh read tx — early return on dedup hit.
3. `analyzeImage(...)` — image decode + EXIF (only after dedup miss).
4. Pre-generate UUID, `variantGenerator.storeAll(...)`.
5. Single persist tx (`requiringNew()`).

Added a leading comment in `upload` describing this ordering invariant and why the dedup lookup must run before `analyzeImage`.

### Regression test

`PhotoUploadDedupFastPathTest.duplicateUploadReturnsExistingPhotoWithoutDecodeOrExif`:

1. `@InjectMock` `ImageProcessor` and `ExifExtractor`.
2. Pre-insert a Photo row with a known content hash (`SHA-256` of the test JPEG bytes), bypassing `PhotoService.upload`.
3. Call `photoService.upload(stream(sameBytes), ..., sameUser)`.
4. Assert the returned Photo's id matches the seeded id.
5. `verify(imageProcessor, never()).readImage(...)` and `verify(exifExtractor, never()).extract(...)` for both the `Path` and `InputStream` overloads, proving the fast path skipped the expensive analysis branch.

### Race semantics (AC #2)

Unchanged from TASK-056.05: a brand-new upload that misses the dedup lookup still races at `persistAndFlush` time against any concurrent same-hash same-uploader upload. The unique `(uploader_id, content_hash)` index throws `PersistenceException`, the loser drops its storage files, and a fresh read tx returns the winner.

### Validation

- `./gradlew test` — 437 tests, 0 failures, 0 errors
- `./gradlew spotlessCheck spotbugsMain` — clean
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Changes

### Edited
- `backend/src/main/java/dev/pina/backend/service/PhotoService.java` — added an explanatory comment in `upload` documenting the hash → dedup → decode/EXIF → storage → persist ordering invariant. The fast-path itself was already restored by the TASK-056.05 refactor.

### New
- `backend/src/test/java/dev/pina/backend/service/PhotoUploadDedupFastPathTest.java` — regression test that pre-seeds a Photo row with a known content hash, then asserts that uploading the same bytes returns the existing id and that `ImageProcessor.readImage` / `ExifExtractor.extract` are never called.

## Behavior

- A duplicate upload for the same `(uploader_id, content_hash)` returns the existing Photo without paying image decode or EXIF extraction cost.
- The unique-constraint race protection from TASK-056.05 is unchanged.

## Validation

- `./gradlew test` — 437 tests, 0 failures
- `./gradlew spotlessCheck spotbugsMain` — clean
<!-- SECTION:FINAL_SUMMARY:END -->
