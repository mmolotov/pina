---
id: TASK-056.06
title: TASK-56-BE-REVIEW Add real backpressure before image-heavy upload work
status: Done
assignee:
  - maksim
created_date: '2026-04-29 07:16'
updated_date: '2026-04-30 06:34'
labels:
  - backend
  - review
  - photos
  - performance
dependencies: []
references:
  - backend/src/main/java/dev/pina/backend/service/PhotoService.java
  - backend/src/main/java/dev/pina/backend/service/PhotoVariantExecutor.java
  - backend/src/main/java/dev/pina/backend/service/PhotoVariantGenerator.java
documentation:
  - >-
    backlog/tasks/task-056.02 -
    UPLD-BE-001-Generate-photo-variants-in-parallel-with-a-bounded-executor.md
  - >-
    backlog/tasks/task-056.04 -
    UPLD-BE-003-Move-variant-generation-out-of-the-photo-upload-transaction.md
parent_task_id: TASK-056
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Review follow-up for TASK-056. The new shared `PhotoVariantExecutor` caps worker threads, but it still uses the unbounded queue from `Executors.newFixedThreadPool`, and each request decodes the image before submitting work. Under many concurrent uploads, pending requests can still retain arbitrary numbers of full-resolution `BufferedImage` instances and queued tasks while waiting for executor slots. The implementation therefore does not actually bound heap usage with request count.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The upload pipeline enforces a global cap on the image-heavy phase that is independent of HTTP request count
- [x] #2 Pending uploads do not keep an unbounded number of decoded full-resolution images resident in memory while waiting for executor capacity
- [x] #3 Executor/task queue growth is bounded or otherwise backpressured so load cannot accumulate indefinitely in-memory
- [x] #4 Tests or instrumentation document the enforced cap and show that concurrent uploads contend for it instead of growing memory without limit
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Approach

Cap the number of uploads that are simultaneously in the image-heavy phase (decode + storage I/O) via a global `Semaphore`. The cap is enforced **after** the cheap dedup lookup and **before** `analyzeImage`, so a duplicate upload returns instantly without consuming a slot.

## Decisions (confirmed)

1. **Default cap** = `Runtime.getRuntime().availableProcessors()`.
2. **Overflow behavior** = blocking `acquire()`. The frontend already throttles to `PHOTO_UPLOAD_CONCURRENCY = 3` per user, so backend pressure manifests as longer wait, not request errors.
3. **Bean** = new `@ApplicationScoped PhotoUploadAdmission` separate from `PhotoVariantExecutor`. Clean responsibility split: admission control vs CPU executor.

## Files

- **Edit `PhotoConfig`** — add `HeavyPhase.maxConcurrent()` (`@WithDefault("0")` → auto = `availableProcessors()`).
- **New `PhotoUploadAdmission`** — owns a `Semaphore` sized at startup; exposes `AutoCloseable acquire()` so callers can use try-with-resources.
- **Edit `PhotoService.upload`** — `try (var slot = admission.acquire())` block wrapping `analyzeImage` through the persist tx. Cheap dedup runs before the acquire.
- **Edit `application.properties`** — document `pina.photo.heavy-phase.max-concurrent=0`.
- **New test** — `CountDownLatch`-blocked storage mock + N+1 concurrent uploads with a small cap; assert `max(inFlight) == cap`.

## Validation

`./gradlew spotlessApply spotbugsMain test` from `backend/`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### What actually grows with request count

The previous claim that the variant executor "bounded heap usage" was wrong. The pool caps thread *count*, but every request thread still keeps its full-resolution `BufferedImage` alive on its stack from `analyzeImage` through `storeAll` while it blocks on `allOf().join()`. For a 24 MP source that is ~100 MB per in-flight upload. Twenty concurrent uploads ⇒ ~2 GB of source images plus the pyramid's intermediate buffers, regardless of what the variant executor is doing.

### Fix

A new `@ApplicationScoped PhotoUploadAdmission` bean owns a `Semaphore` sized at startup. `PhotoService.upload` acquires a slot **after** the cheap dedup lookup and **before** `analyzeImage`, then releases it via try-with-resources after the persist tx (or after a phase 1 / persist tx failure). Cheap dedup hits never consume a slot, so duplicate uploads remain trivially fast.

Default cap is `Runtime.getRuntime().availableProcessors()`. Configurable via `pina.photo.heavy-phase.max-concurrent` (0 = auto). The variant executor itself was not changed — its existing `LinkedBlockingQueue` is now upstream-bounded by the admission semaphore, since at most `cap × 3` tasks can ever be submitted simultaneously.

The `PhotoVariantGenerator.storeAll` extraction (`runHeavyPhase`) keeps `upload` readable: cheap dedup → `try (Slot _ = admission.acquire()) { runHeavyPhase(...) }`. Interruption while waiting maps to `IOException` so the REST resource can surface a meaningful error.

### Test

`PhotoUploadAdmissionTest` (`@QuarkusTest` with `@TestProfile` overriding the cap to 2):

1. `@InjectMock StorageProvider` whose `store(...)` parks on a `CountDownLatch`.
2. Five concurrent `photoService.upload(...)` invocations against the same user with distinct content (each upload gets a different deterministic noise pattern so dedup never triggers).
3. Wait until the first wave (2 uploads) reaches storage; sleep 200 ms to give over-cap uploads a chance to slip past `acquire()` — they cannot.
4. Assert `admission.inFlight() == 2`, `maxObservedInFlight == 2`, and `admission.inFlight() == 0` after the latch is released and every upload completes.

The new `PhotoUploadAdmission.inFlight()` accessor (`capacity - availablePermits()`) gives the test a deterministic readout of slots currently held; nothing else uses it.

### Validation

- `./gradlew test` — 439 tests, 0 failures, 0 errors
- `./gradlew spotlessCheck spotbugsMain` — clean
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Changes

### New
- `backend/src/main/java/dev/pina/backend/service/PhotoUploadAdmission.java` — `@ApplicationScoped` bean that owns a fair `Semaphore` capped at `pina.photo.heavy-phase.max-concurrent` (default `availableProcessors()`). Exposes `acquire()` returning an `AutoCloseable` slot for try-with-resources.
- `backend/src/test/java/dev/pina/backend/service/PhotoUploadAdmissionTest.java` — `@TestProfile`-driven cap of 2, five concurrent uploads with distinct content, blocked storage mock; asserts `inFlight()` never exceeds the cap.

### Edited
- `backend/src/main/java/dev/pina/backend/config/PhotoConfig.java` — adds `HeavyPhase.maxConcurrent()` knob (`@WithDefault("0")` ⇒ auto = `availableProcessors()`).
- `backend/src/main/java/dev/pina/backend/service/PhotoService.java` — `upload` acquires an admission slot after the cheap dedup lookup; the heavy phase (decode → storage → persist) is extracted into `runHeavyPhase` and runs inside try-with-resources so the slot is always released. Interruption maps to `IOException`.
- `backend/src/main/resources/application.properties` — documents the new property.

## Behavior

- At most `availableProcessors()` uploads can simultaneously hold a full-resolution `BufferedImage` in memory; further uploads block on `acquire()` until a slot frees up.
- Cheap dedup hits return immediately without consuming a slot.
- The variant executor is now upstream-bounded: only `cap × 3` tasks can ever be submitted concurrently, so its previously unbounded `LinkedBlockingQueue` cannot grow unboundedly.
- The frontend's per-batch concurrency (`PHOTO_UPLOAD_CONCURRENCY = 3`) and the new backend cap together provide layered backpressure.

## Validation

- `./gradlew test` — 439 tests, 0 failures
- `./gradlew spotlessCheck spotbugsMain` — clean
<!-- SECTION:FINAL_SUMMARY:END -->
