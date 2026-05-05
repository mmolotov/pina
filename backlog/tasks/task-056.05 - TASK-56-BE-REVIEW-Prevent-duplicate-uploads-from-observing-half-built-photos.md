---
id: TASK-056.05
title: TASK-56-BE-REVIEW Prevent duplicate uploads from observing half-built photos
status: Done
assignee:
  - maksim
created_date: '2026-04-29 07:16'
updated_date: '2026-04-29 07:50'
labels:
  - backend
  - review
  - photos
  - reliability
dependencies: []
references:
  - backend/src/main/java/dev/pina/backend/service/PhotoService.java
  - backend/src/main/java/dev/pina/backend/domain/Photo.java
documentation:
  - >-
    backlog/tasks/task-056 -
    UPLD-EPIC-Speed-up-photo-upload-pipeline-while-keeping-it-stable.md
parent_task_id: TASK-056
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Review follow-up for TASK-056. The split Tx A / phase 1 / Tx B flow now persists the Photo row before variants are attached, and `prepareUpload()` short-circuits any same-hash upload to that row immediately. A concurrent duplicate upload can therefore return success with a Photo that has no variants yet, or even with a Photo that is deleted moments later if the first request fails during phase 1 or Tx B. The dedup path must not expose partially built upload state to callers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Concurrent uploads of the same content hash by the same uploader never return a Photo with an empty or partial variant set
- [x] #2 If the first request fails after the Photo row is inserted, overlapping duplicate requests do not return success for a row that is later deleted
- [x] #3 Dedup/race handling still resolves to a single persisted Photo once the winning upload completes successfully
- [x] #4 Integration coverage exercises the overlap window between Tx A and Tx B and asserts the returned API payload is stable
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Approach — atomic Photo+variants persistence at the end

The split Tx A → Phase 1 → Tx B introduced in TASK-056.04 makes the `Photo` row visible to dedup readers before its variants exist. Replace it with: storage-first, then a single short transaction that persists `Photo` + 6 `PhotoVariant` rows together. The `Photo` row is therefore never visible without its variants, and the bug class is structurally gone.

## New `upload` pipeline

1. **Cheap dedup** — read-only `requiringNew()` lookup; if found, return.
2. **Decode + EXIF** — no tx.
3. **Pre-generate `UUID`** for `photo.id`. Build a transient `Photo` carrying just `id`, `mimeType`, `width`, `height` — enough for `variantGenerator.storeAll` to compute paths and the ORIGINAL spec.
4. **Phase 1** — `variantGenerator.storeAll(...)` writes the six files; no tx, no connection held.
5. **Persist tx** — `requiringNew().call(() -> { ... })`:
   - `personalLibraryService.getOrCreate(uploader)`
   - build a full `Photo` with pre-assigned id, attach uploader / library / all metadata
   - `persistAndFlush()` — throws `PersistenceException` on the `(uploader_id, content_hash)` race
   - persist the six `PhotoVariant` rows
   - return managed photo

## Failure / race paths

- **Phase 1 fails** → no DB write happened; rethrow.
- **Persist tx fails (non-race)** → outer catch calls `variantGenerator.deleteStoredFiles(specs)`, rethrows.
- **Race (`PersistenceException`)** → outer catch deletes the orphan storage files; a fresh read tx `findByContentHashAndUploaderWithRelations` returns the winner. The persist tx already rolled back inside `requiringNew().call(...)` — no rollback-only commit issue.

## Files

- **Edit `PhotoService.java`** — rewrite `upload`, drop `PreparedUpload`, `prepareUpload`, `attachVariants`, `deleteOrphanPhoto`, `em.getReference`-based hack.
- **New test** in `PhotoUploadIsolationTest` (or sibling) — uses a `CountDownLatch`-blocked storage mock to assert that during phase 1 a concurrent dedup reader sees no Photo row, and after success the full photo with variants is visible.

## Risks

- Hibernate must respect pre-assigned `@GeneratedValue(strategy = UUID)` ids. Verified empirically before committing the refactor; if not honored, switch to manual assignment without `@GeneratedValue`.

## What stays

- `findByContentHashAndUploaderWithRelations` lookup unchanged.
- `(uploader_id, content_hash)` unique index is still the sole race arbiter.
- `PhotoVariantGenerator.storeAll` and `deleteStoredFiles` unchanged.
- `PhotoVariantExecutor` unchanged.

## Validation

`./gradlew spotlessApply spotbugsMain test` from `backend/`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Refactor

`PhotoService.upload` no longer persists the `Photo` row before its variants exist. The new pipeline:

1. **Read-only dedup** (`requiringNew()`) — `findByContentHashAndUploaderWithRelations`. Hit → return existing.
2. **Decode + EXIF** (no tx).
3. **Pre-generate `UUID`** for `photo.id` and build a transient `Photo` carrying just the fields `storeAll` reads (id, mimeType, width, height) so storage paths can be computed before any DB write.
4. **Phase 1** — `variantGenerator.storeAll(...)` writes the six storage files; no DB connection held.
5. **Persist tx** (`requiringNew()`) — get-or-create `PersonalLibrary`, build the full Photo with the pre-assigned id, `persistAndFlush()`, then persist the six `PhotoVariant` rows. Returns the managed Photo with variants attached in memory.

The Photo row is therefore visible to dedup readers only after the full upload (Photo + 6 variants) has been persisted. The half-built window from TASK-056.04 is structurally eliminated.

### Race / failure paths

- **Phase 1 failure** — no DB row was ever inserted; just rethrow. Storage cleanup already handled by `PhotoVariantGenerator` for partial pyramid writes; otherwise nothing to clean.
- **Persist tx failure (non-race)** — outer catch calls `variantGenerator.deleteStoredFiles(specs)` to remove the six storage files, then rethrows. The persist tx already rolled back inside `requiringNew().call(...)`.
- **Race (`PersistenceException` on `persistAndFlush`)** — outer catch deletes the orphan storage files, then opens a fresh read tx to fetch the winner via `findByContentHashAndUploaderWithRelations`. The persist tx already rolled back inside `QuarkusTransactionImpl`, so there is no rollback-only commit issue (the bug from the old `@Transactional` race-catch path).

### Domain change: `Photo.id` no longer uses `@GeneratedValue`

Hibernate refuses to call `persist()` on an entity that has both `@GeneratedValue` and a pre-set id (it treats it as detached). Removing `@GeneratedValue(strategy = UUID)` from `Photo.id` makes manual assignment the only strategy. The DB column still has `DEFAULT gen_random_uuid()` from `V01__core_schema.sql`, so any direct SQL inserts continue to work; only application-level inserts must now provide the id.

`FavoriteServiceTest.createPhoto` was updated to assign `photo.id = UUID.randomUUID()`. The production code path (`PhotoService.upload`) is the only other place that builds Photo entities.

### Removed

- `PreparedUpload` record
- `prepareUpload`, `attachVariants`, `deleteOrphanPhoto` methods
- The `em.getReference(Photo.class, ...)` workaround for Tx B's re-read of jsonb (no longer needed because there is no Tx B; the persist tx returns the managed Photo whose `exifData` matches what was just inserted).
- `createPhotoEntity` private helper (folded into `persistPhotoWithVariants`).

### New test

`PhotoUploadIsolationTest.duplicateLookupDuringStorageDoesNotObserveHalfBuiltPhoto` (non-`@Transactional`):

1. `@InjectMock StorageProvider` blocks every `store(...)` call on a `CountDownLatch`.
2. Upload runs on a worker thread; main thread waits until phase 1 has entered storage.
3. Main thread does a fresh-tx `Photo.find("uploader.id", user.id).firstResultOptional()` — asserts empty (no row visible mid-pipeline).
4. Main thread releases the latch; upload completes; the returned Photo has all six variants.
5. Fresh-tx re-read confirms the persisted Photo is now visible with six variants.

This exercises the overlap window covered by AC #4: dedup readers cannot observe a half-built row, and the same-user race resolution still works.

The existing `phaseOneFailureRemovesOrphanPhotoRow` test now reflects the stronger invariant: phase 1 failure means no Photo row was ever persisted, so the assertion of an absent row remains correct (and the bug class it was guarding against in TASK-056.04 no longer exists at all).

### Validation

- `./gradlew test` — 436 tests, 0 failures, 0 errors
- `./gradlew spotlessCheck spotbugsMain` — clean
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Changes

### Edited
- `backend/src/main/java/dev/pina/backend/service/PhotoService.java` — rewrite `upload` so storage I/O runs before any DB write; persist `Photo` + 6 `PhotoVariant` rows in a single short transaction at the end. The half-built window between Tx A and Tx B is eliminated.
- `backend/src/main/java/dev/pina/backend/domain/Photo.java` — drop `@GeneratedValue` from `id`; the application now assigns the UUID manually so storage paths and the persisted row share the same identifier.
- `backend/src/test/java/dev/pina/backend/service/FavoriteServiceTest.java` — assign `photo.id = UUID.randomUUID()` when building Photo entities directly (the only other Photo-creation site outside `PhotoService`).
- `backend/src/test/java/dev/pina/backend/service/PhotoUploadIsolationTest.java` — added `duplicateLookupDuringStorageDoesNotObserveHalfBuiltPhoto`, which uses a `CountDownLatch`-blocked storage mock to prove the dedup query observes nothing mid-pipeline and the full Photo + 6 variants after the upload commits.

## Behavior

- A concurrent duplicate-uploader doing `findByContentHashAndUploaderWithRelations` cannot see a Photo row until the upload has fully succeeded, so it never returns a half-built or about-to-be-deleted row.
- Race protection is unchanged: the `(uploader_id, content_hash)` unique index still arbitrates concurrent inserts; the loser's storage files are cleaned up and the winner is returned via a fresh read tx.
- `PersistenceException` is now caught at the boundary of an already-rolled-back `requiringNew` transaction, so there is no rollback-only commit issue.

## Validation

- `./gradlew test` — 436 tests, 0 failures
- `./gradlew spotlessCheck spotbugsMain` — clean
<!-- SECTION:FINAL_SUMMARY:END -->
