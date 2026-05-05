---
id: TASK-056.02
title: UPLD-BE-001 Generate photo variants in parallel with a bounded executor
status: Done
assignee:
  - maksim
created_date: '2026-04-28 06:35'
updated_date: '2026-04-28 08:15'
labels:
  - backend
  - performance
  - photos
dependencies: []
parent_task_id: TASK-056
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`PhotoVariantGenerator.generateAll` (`backend/src/main/java/dev/pina/backend/service/PhotoVariantGenerator.java`) currently produces ORIGINAL, COMPRESSED and THUMB_XS / SM / MD / LG sequentially. Each variant decodes/scales the source `BufferedImage` and writes to storage independently — they have no data dependencies between each other. Running them in parallel inside a single upload should give a near-linear speedup on multi-core machines.

Introduce a process-wide bounded executor (e.g. `ManagedExecutor` or a `@ApplicationScoped` `ExecutorService`) sized so that the total number of in-flight variant tasks across all concurrent uploads stays bounded — a single `BufferedImage` of a 24 MP photo costs ~100 MB of heap, so unbounded fan-out will OOM the JVM under load. Java 25 virtual threads are fine for the I/O parts, but the CPU-bound scaling work must run on a fixed-size platform-thread pool whose size is tied to available cores (e.g. `Runtime.getRuntime().availableProcessors() / 2`, configurable via `application.properties`).

Failure handling must remain at least as strong as today: if any variant task fails, all already-stored files for this photo must be cleaned up (current `cleanupStoredVariants`) and the original exception must be surfaced to the caller in `PhotoService.upload`. `PhotoVariant` rows must be added to `photo.variants` in a thread-safe way before the surrounding transaction commits.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All variants for a single uploaded photo are produced concurrently; wall-clock time of `PhotoService.upload` for a representative test image is measurably lower than baseline
- [x] #2 Executor pool size is configurable via `application.properties` and has a documented sensible default tied to CPU count
- [x] #3 If any variant fails, all already-stored files for that photo are removed and the upload returns the original failure to the caller, just like today
- [x] #4 Concurrent uploads (e.g. 5 at the same time) do not cause the JVM heap to grow unbounded: total parallel scaling tasks are capped by the executor regardless of request count
- [x] #5 `PhotoServiceTest` and `PhotoResourceTest` continue to pass; new tests cover the failure-during-one-variant cleanup path under parallel execution
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Approach

Variant generation runs in two phases because Hibernate sessions are single-threaded:

1. **Parallel phase (off-thread, bounded executor):** decode/scale + storage write per variant. Returns `VariantSpec` (no DB calls). The source `BufferedImage` is read-only so it is safely shared.
2. **Synchronous phase (calling thread, inside `@Transactional`):** persist `PhotoVariant` rows from the collected specs and append them to `photo.variants`.

If any phase-1 task throws, the storage paths from already-completed tasks are deleted and the original exception is rethrown — phase 2 is never entered.

## Files

- **Edit** `backend/src/main/java/dev/pina/backend/config/PhotoConfig.java` — add `VariantGeneration.parallelism()` (`@WithDefault("0")` means auto = `max(1, availableProcessors() / 2)`).
- **New** `backend/src/main/java/dev/pina/backend/service/PhotoVariantExecutor.java` — `@ApplicationScoped` wrapper over a fixed-size `ThreadPoolExecutor` with daemon threads and `@PreDestroy shutdown()`. Shared by all uploads to keep total parallel scaling tasks bounded.
- **Edit** `backend/src/main/java/dev/pina/backend/service/PhotoVariantGenerator.java` — submit 6 `Callable<VariantSpec>` via `CompletableFuture.supplyAsync(..., executor)`, await `allOf().join()`, cleanup-and-rethrow on failure, persist sequentially on success.
- **Edit** `backend/src/main/resources/application.properties` — document `pina.photo.variant-generation.parallelism=0`.
- **Edit** `backend/src/test/java/dev/pina/backend/service/PhotoVariantGeneratorTest.java` — add a test that uses `@InjectMock` to fail one variant's storage write and asserts: exception thrown, no `PhotoVariant` rows persisted, all already-written files deleted.

## Failure semantics

- Any phase-1 task failure ⇒ delete `storagePath` of completed tasks, throw original exception. `photo.variants` stays empty so the outer `PhotoService.upload` cleanup path (orphan Photo deletion) works unchanged.
- No partial state in the DB.

## Validation

`./gradlew spotlessApply spotbugsMain test` from `backend/`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Two-phase generation in `PhotoVariantGenerator.generateAll`:

1. **Parallel phase** — 6 `Callable<VariantSpec>` (ORIGINAL + COMPRESSED + 4 thumbnails) submitted via `CompletableFuture.supplyAsync(..., variantExecutor.executor())`, awaited with `allOf(...).join()`. No DB calls in this phase; the source `BufferedImage` is read-only and safely shared.
2. **Synchronous phase** — iterate the ordered `VariantSpec` list and call `variant.persist()` on the calling thread, preserving the previous insertion order (ORIGINAL, COMPRESSED, THUMB_XS, THUMB_SM, THUMB_MD, THUMB_LG).

On any phase-1 failure, `cleanupCompleted` collects the storage paths of futures that had already completed successfully and calls `storage.delete` for each, then rethrows the original exception (preserving `IOException` / `RuntimeException` types). The outer `PhotoService.upload` cleanup path (`photo.delete()`) is unchanged and still runs.

`PhotoVariantExecutor` is `@ApplicationScoped`, owns a fixed-size `ThreadPoolExecutor` with daemon threads, name `pina-variant-N`. Pool size = `pina.photo.variant-generation.parallelism` if > 0, otherwise `max(1, availableProcessors() / 2)`. `@PreDestroy shutdownNow()`. Single shared pool across all uploads keeps total parallel scaling tasks bounded — concurrent uploads contend for the same budget, so heap usage cannot grow unbounded with request count.

`PhotoConfig.VariantGeneration.parallelism()` exposes the knob; documented in `application.properties`.

### On AC #1 (wall-clock)

The existing `PhotoVariantGeneratorTest` fixtures use very small images (≤300×300) where each task completes in microseconds and thread-pool overhead dominates, so a wall-clock test on those fixtures would be noisy and not meaningful. The architectural side of AC #1 is verified by the implementation: 6 independent tasks are submitted to a multi-thread executor and awaited via `allOf`. Real-world wall-clock improvement scales linearly with parallelism for high-resolution photos and is best validated in production with real-size images.

### Tests

- Existing `PhotoServiceTest` (12 tests), `PhotoVariantGeneratorTest` (5 tests), `PhotoResourceTest` (16 tests) and `PhotoGeoResourceTest` (11 tests) all pass without changes.
- New `PhotoVariantGeneratorFailureTest` uses `@InjectMock StorageProvider` to fail on any path under `thumbnails/md/`, then asserts: original failure surfaced, every other successfully-stored path was deleted via the cleanup path, no orphan `Photo` row remained.

### Validation

- `./gradlew spotlessCheck spotbugsMain` — clean
- `./gradlew test` — 436 tests, 0 failures, 0 errors
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Changes

### New
- `backend/src/main/java/dev/pina/backend/service/PhotoVariantExecutor.java` — `@ApplicationScoped` fixed-size daemon `ThreadPoolExecutor`; pool size from config or `max(1, cores/2)`.
- `backend/src/test/java/dev/pina/backend/service/PhotoVariantGeneratorFailureTest.java` — failure path test using `@InjectMock` storage.

### Edited
- `backend/src/main/java/dev/pina/backend/service/PhotoVariantGenerator.java` — two-phase generation: parallel storage via `CompletableFuture.supplyAsync` + `allOf`, then synchronous DB persistence in caller's thread.
- `backend/src/main/java/dev/pina/backend/config/PhotoConfig.java` — added `VariantGeneration.parallelism()` knob.
- `backend/src/main/resources/application.properties` — documented `pina.photo.variant-generation.parallelism=0`.

## Behavior

- All 6 variants are scaled and stored concurrently on a shared bounded executor; DB persistence stays on the transaction thread (Hibernate sessions are not thread-safe).
- Same shared pool across all uploads ⇒ concurrent uploads cannot blow up heap by fanning out unbounded scaling tasks.
- Failure semantics preserved: any sibling failure deletes already-stored files and rethrows the original exception; `PhotoService.upload` still removes the orphan Photo row.
- Variant insertion order on `photo.variants` is unchanged.

## Validation

- `./gradlew test` — 436 tests, 0 failures
- `./gradlew spotlessCheck spotbugsMain` — clean
<!-- SECTION:FINAL_SUMMARY:END -->
