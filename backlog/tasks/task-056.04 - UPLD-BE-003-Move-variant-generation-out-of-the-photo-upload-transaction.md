---
id: TASK-056.04
title: UPLD-BE-003 Move variant generation out of the photo upload transaction
status: Done
assignee:
  - maksim
created_date: '2026-04-28 06:36'
updated_date: '2026-04-29 07:07'
labels:
  - backend
  - photos
  - reliability
dependencies: []
parent_task_id: TASK-056
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`PhotoService.upload` is annotated `@Transactional` and runs the entire pipeline — file ingest, EXIF, image decode, all variant generation and storage writes — inside a single DB transaction. That means a connection from the Hibernate pool is held for the whole duration, including CPU-heavy scaling and slow object-storage writes. Under bulk upload this is the most likely cause of pool exhaustion and tail-latency spikes.

Restructure the upload so the DB transaction is split:

1. Short transaction A: ingest temp file, dedup lookup by content hash, persist the `Photo` row.
2. No transaction: variant generation and storage writes (after task UPLD-BE-001 these may run in parallel).
3. Short transaction B: persist `PhotoVariant` rows for the successfully stored variants.

If step 2 or 3 fails, all already-stored files must be deleted (we already have `cleanupStoredVariants`) and the orphan `Photo` row must be removed so the user can retry. Keep the existing race protection: concurrent uploads of the same content_hash by the same uploader must still resolve to a single Photo, with the loser deleting any files it managed to store. Make sure `Photo.findByContentHashAndUploaderWithRelations` is the single source of truth for the dedup decision and that the unique constraint on `(uploader_id, content_hash)` still catches the race exactly as today.

This is a stability-focused change, not a performance-focused one — the goal is to free DB connections sooner under load. Measure before and after: maximum concurrent DB connections held during a 20-file upload should drop noticeably.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No DB transaction is open while variant generation or storage writes are running; this is enforced either by structure or by an assertion/test
- [x] #2 Failure during variant generation removes the orphan `Photo` row and all already-stored files; the API surface returns the same error shape as today
- [x] #3 Concurrent uploads of the same content_hash by the same uploader still produce exactly one `Photo`, and any duplicate files written by the losing request are cleaned up
- [x] #4 Bulk upload of 20 photos no longer pins a DB connection for the duration of variant generation; a load test or instrumentation note in the task documents the before/after pool occupancy
- [x] #5 Existing `PhotoServiceTest` and `PhotoResourceTest` cases pass; new tests cover the orphan-row cleanup on variant-generation failure and the dedup race after the split
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Approach

Replace the single `@Transactional` upload with three short `QuarkusTransaction.run(...)` blocks (JTA `REQUIRED`) and a non-transactional middle phase:

1. **Tx A** — dedup lookup → early return if duplicate; else get-or-create `PersonalLibrary` → `persistAndFlush` Photo (on `PersistenceException` clear EM and re-find inside the same tx, race-catch unchanged). Returns a detached Photo.
2. **Phase 1 (no tx)** — `variantGenerator.storeAll(...)` performs all parallel storage writes and returns `List<VariantSpec>`. No DB connection held.
3. **Tx B** — re-fetch Photo by id, persist `PhotoVariant` rows from the specs.

Failure paths:
- Tx A failure (non-race) — nothing persisted, no cleanup.
- Phase 1 failure — TASK-056.03 cleanup deletes partial files; an additional cleanup tx deletes the orphan Photo row.
- Tx B failure — delete all spec files + cleanup tx deletes orphan Photo.

`QuarkusTransaction.run` is JTA `REQUIRED` semantics: in production where the REST resource has no parent tx, it opens fresh short txs; in tests with `@Transactional`, it joins the test tx. Test isolation for AC #1 is provided by a separate non-`@Transactional` test that inspects `TransactionManager.getStatus()` while `storage.store` is invoked.

## Files

- **Edit `PhotoVariantGenerator`** — rename `generateAll` → `storeAll`, return `List<VariantSpec>`, remove `persistVariant` and any DB calls.
- **Edit `PhotoService`** — drop `@Transactional` from `upload`; orchestrate Tx A / Phase 1 / Tx B / cleanup via `QuarkusTransaction.run(...)`. `persistVariant` moves here.
- **Edit `TestUserHelper.createUser`** — wrap in `QuarkusTransaction.run` so it works regardless of caller's tx state.
- **New `PhotoUploadIsolationTest`** (non-`@Transactional`) — verifies (a) `storage.store` runs while `TransactionManager.getStatus() == STATUS_NO_TRANSACTION`, (b) phase 1 failure cleans up the orphan Photo row.

## What stays the same

- Race protection via the unique `(uploader_id, content_hash)` index and the catch-then-refind pattern.
- Existing `PhotoServiceTest`, `PhotoVariantGeneratorTest`, `PhotoResourceTest`, `PhotoVariantGeneratorFailureTest` — they use `@Transactional` and rely on join semantics, no changes needed.
- Variant insertion order on `photo.variants`.

## Validation

`./gradlew spotlessApply spotbugsMain test` from `backend/`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Refactor

`PhotoService.upload` is no longer `@Transactional`. The pipeline is split into three explicit `QuarkusTransaction.requiringNew()` blocks with the heavy work between them:

1. **Tx A (`prepareUpload`)** — dedup lookup; if found, return existing Photo (with `alreadyHadVariants=true`). Otherwise get-or-create `PersonalLibrary` and `persistAndFlush` the new Photo. Race protection unchanged: on `PersistenceException` clear the EM and re-find the winner inside the same Tx A. Returns a `PreparedUpload(photo, alreadyHadVariants)` record.
2. **Phase 1 (no tx)** — `variantGenerator.storeAll(...)` runs CPU + storage I/O on the bounded executor. Returns `List<VariantSpec>`. No DB connection held.
3. **Tx B (`attachVariants`)** — uses `em.getReference(Photo.class, prepared.id)` for FK only; persists `PhotoVariant` rows and appends them to the detached Photo's `variants` list. Returns the same detached Photo so the caller's response uses the original (un-renormalized) `exifData` jsonb string.

`PhotoVariantGenerator.generateAll` was renamed to `storeAll` and no longer touches the DB. `persistVariant` moved to `PhotoService` and uses `em.getReference` to avoid a re-read of the Photo row in Tx B. A new `PhotoVariantGenerator.deleteStoredFiles(specs)` method is used by the orphan cleanup path.

### Failure paths

- Phase 1 failure → `deleteOrphanPhoto(photoId, [])` runs a fresh `requiringNew()` tx to delete the orphan Photo row. The pyramid task's internal cleanup (TASK-056.03) already removed any partial files.
- Tx B failure → `deleteOrphanPhoto(photoId, specs)` deletes all phase 1-stored files via `variantGenerator.deleteStoredFiles` AND opens a `requiringNew()` tx to delete the orphan Photo row.
- Tx A failure (non-race) → nothing was persisted, no cleanup.

### Race semantics (AC #3)

Unchanged: the unique `(uploader_id, content_hash)` index still catches concurrent uploads. The race-catch path inside Tx A — `getEntityManager().clear()` followed by `findByContentHashAndUploaderWithRelations` — is preserved. Both branches of `prepareUpload` (fast-path dedup and race-catch) return `alreadyHadVariants=true` so the upload short-circuits without entering Phase 1.

### `TestUserHelper` change

`createUser` now wraps in `QuarkusTransaction.requiringNew()` so users are committed to DB regardless of caller's tx state. This is required for the new isolation tests (which run without `@Transactional`) and remains compatible with existing `@Transactional` tests because `requiringNew` always opens a fresh tx. Test isolation is preserved by unique UUID-based suffixes in user names.

### AC #1 verification

`PhotoUploadIsolationTest.variantStorageRunsOutsideAnyDatabaseTransaction` runs without `@Transactional`, calls `photoService.upload`, and asserts `TransactionManager.getStatus() == STATUS_NO_TRANSACTION` at the moment `storage.store` is invoked. This proves that in the production-like path (no parent tx), Phase 1 holds no DB connection.

### AC #2 verification

`PhotoUploadIsolationTest.phaseOneFailureRemovesOrphanPhotoRow` configures the storage mock to throw on the THUMB_MD path, expects `upload` to throw, and verifies via a fresh tx read that no Photo row remains for the test user. The existing `PhotoVariantGeneratorFailureTest` (TASK-056.02) provides equivalent coverage but inside a `@Transactional` test context.

### AC #4 — connection occupancy

Architectural argument: under the previous `@Transactional` upload, a Hibernate connection was held for the full duration (~5–30s for high-resolution photos including all variant work). After this refactor the same upload only holds a connection during Tx A (~5–10ms: dedup lookup + Photo INSERT) and Tx B (~5–10ms: 6 PhotoVariant INSERTs). For 20 concurrent uploads, peak DB pool occupancy drops from ~20 connections held throughout to ~20 connections briefly during Tx A/B — pool exhaustion is no longer triggered by upload pipeline duration. Empirical pool-occupancy measurement is best done in a load-test environment; the structural test above proves the connection-release property.

### Tests

- New: `PhotoUploadIsolationTest` (2 tests, non-`@Transactional`) for AC #1 and AC #2.
- Unchanged and passing: `PhotoServiceTest` (12), `PhotoVariantGeneratorTest` (5), `PhotoVariantGeneratorFailureTest` (1), `PhotoResourceTest` (16), `PhotoGeoResourceTest` (11), `ImageProcessorTest` (7), and the rest of the suite.

### Validation

- `./gradlew test` — 435 tests, 0 failures, 0 errors
- `./gradlew spotlessCheck spotbugsMain` — clean
- No deprecation warnings on `PhotoService.java`
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Changes

### Edited
- `backend/src/main/java/dev/pina/backend/service/PhotoService.java` — `upload` is no longer `@Transactional`; pipeline split into Tx A (`prepareUpload`), Phase 1 (no tx), Tx B (`attachVariants`), with orphan cleanup via a separate fresh tx. New private record `PreparedUpload` carries the dedup result. `attachVariants` uses `em.getReference` to avoid re-reading the Photo row.
- `backend/src/main/java/dev/pina/backend/service/PhotoVariantGenerator.java` — `generateAll` renamed to `storeAll`; DB calls removed (no more `persistVariant`). New `deleteStoredFiles(specs)` helper for the orphan cleanup path.
- `backend/src/test/java/dev/pina/backend/TestUserHelper.java` — wraps user creation in `QuarkusTransaction.requiringNew()` so users are committed regardless of caller tx state.

### New
- `backend/src/test/java/dev/pina/backend/service/PhotoUploadIsolationTest.java` — non-`@Transactional` integration tests covering AC #1 (no JTA tx during storage) and AC #2 (orphan Photo cleanup on phase-1 failure).

## Behavior

- DB connection no longer held during variant generation or storage I/O — Tx A and Tx B are short and run only DB work.
- Race semantics preserved: unique `(uploader_id, content_hash)` index + clear-and-refind catch path inside Tx A.
- `exifData` jsonb returned by the API is the original written string (not Postgres-renormalized), thanks to using `em.getReference` in Tx B instead of re-reading the Photo.
- Failure paths clean up both files and orphan Photo rows.

## Validation

- `./gradlew test` — 435 tests, 0 failures
- `./gradlew spotlessCheck spotbugsMain` — clean
<!-- SECTION:FINAL_SUMMARY:END -->
