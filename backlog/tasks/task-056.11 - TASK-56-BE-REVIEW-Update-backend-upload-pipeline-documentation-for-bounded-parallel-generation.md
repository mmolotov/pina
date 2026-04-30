---
id: TASK-056.11
title: >-
  TASK-56-BE-REVIEW Update backend upload-pipeline documentation for bounded
  parallel generation
status: Done
assignee:
  - '@maksim'
created_date: '2026-04-30 06:56'
updated_date: '2026-04-30 07:13'
labels:
  - backend
  - review
  - photos
  - documentation
dependencies: []
references:
  - backend/README.md
  - backend/src/main/java/dev/pina/backend/service/PhotoService.java
  - backend/src/main/java/dev/pina/backend/config/PhotoConfig.java
  - backend/src/main/resources/application.properties
documentation:
  - >-
    backlog/tasks/task-056 -
    UPLD-EPIC-Speed-up-photo-upload-pipeline-while-keeping-it-stable.md
parent_task_id: TASK-056
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Review follow-up for TASK-056. The backend implementation now hashes first, performs a cheap dedup lookup, acquires a heavy-phase admission slot, generates variants outside a DB transaction, and persists `Photo` plus `PhotoVariant` rows at the end. `backend/README.md` still describes the old order as persisting the Photo before generating variants, and its configuration table does not include `pina.photo.variant-generation.parallelism` or `pina.photo.heavy-phase.max-concurrent`. This leaves operators without the new resource-control knobs and documents an obsolete consistency model.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backend/README.md` describes the current upload order: temp file/hash, dedup fast path, admission/backpressure, decode/EXIF, storage outside DB transaction, final Photo+variants persist.
- [x] #2 The configuration table documents `pina.photo.variant-generation.parallelism` with default/auto behavior and operational impact.
- [x] #3 The configuration table documents `pina.photo.heavy-phase.max-concurrent` with default/auto behavior and memory/backpressure impact.
- [x] #4 Documentation language is consistent with the implemented invariant that dedup readers must not observe a visible Photo row before variants are ready.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Update `backend/README.md` Upload Pipeline section to match current `PhotoService.upload` order:
   - stream to temp file and hash;
   - run same-uploader dedup lookup before decode/EXIF;
   - acquire heavy-phase admission slot for decode/storage work;
   - decode image and extract EXIF;
   - pre-generate photo id and store original/compressed/thumbnail variants outside a DB transaction;
   - persist `Photo` and `PhotoVariant` rows together in the final short transaction.

2. Add a short consistency/backpressure note below the numbered pipeline:
   - dedup readers do not observe a visible `Photo` row until variants are ready;
   - duplicate races are resolved by the `(uploader_id, content_hash)` unique index at final persist;
   - failed final persists clean up stored files.

3. Extend the configuration table with the new resource-control properties:
   - `pina.photo.variant-generation.parallelism` default `0`, auto = `max(1, availableProcessors() / 2)`, shared bounded variant executor;
   - `pina.photo.heavy-phase.max-concurrent` default `0`, auto = `availableProcessors()`, cap for concurrent decoded/upload-heavy work.

4. Validate documentation formatting with `git diff --check`, then mark all acceptance criteria complete.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated `backend/README.md` Upload Pipeline to match the current implementation: hash and same-uploader dedup first, heavy-phase admission before decode/storage, variant storage outside a DB transaction, and final `Photo` + `PhotoVariant` persistence together.

Added the consistency invariant that dedup readers never observe a visible `Photo` row until variants are ready, and documented same-hash race resolution through the unique index with loser file cleanup.

Extended the configuration section with `pina.photo.variant-generation.parallelism` and `pina.photo.heavy-phase.max-concurrent`, including auto defaults and operational impact for CPU-bound variant work and decoded-image memory/backpressure.

Validation: `git diff --check` passed. No code tests were run because this task changed documentation only.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Changes

- Updated `backend/README.md` to describe the current upload pipeline order: temp file/hash, same-uploader dedup fast path, heavy-phase admission, decode/EXIF, storage outside DB transaction, and final `Photo` + `photo_variants` persistence.
- Documented the consistency invariant that dedup readers do not see a `Photo` row before variants are ready.
- Added the new upload resource-control settings to the configuration section:
  - `pina.photo.variant-generation.parallelism=0` auto-resolves to `max(1, availableProcessors() / 2)` and caps shared variant-scaling work.
  - `pina.photo.heavy-phase.max-concurrent=0` auto-resolves to `availableProcessors()` and caps concurrent decoded-image upload work.

## Validation

- `git diff --check` — passed

No code tests were run; this task only updates documentation.
<!-- SECTION:FINAL_SUMMARY:END -->
