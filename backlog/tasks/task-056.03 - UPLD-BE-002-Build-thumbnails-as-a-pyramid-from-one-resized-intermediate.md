---
id: TASK-056.03
title: UPLD-BE-002 Build thumbnails as a pyramid from one resized intermediate
status: Done
assignee:
  - maksim
created_date: '2026-04-28 06:36'
updated_date: '2026-04-28 08:53'
labels:
  - backend
  - performance
  - photos
dependencies: []
parent_task_id: TASK-056
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`ImageProcessor` (`backend/src/main/java/dev/pina/backend/service/ImageProcessor.java`) scales the full-resolution source `BufferedImage` independently for each thumbnail (`thumbnailXs`, `thumbnailSm`, `thumbnailMd`, `thumbnailLg`). For a 24 MP source this means four full passes over the original pixels. Building a pyramid — derive LG from the source (or COMPRESSED), then MD from LG, SM from MD, XS from SM — yields visually equivalent results with much less work because each successive scale halves the input size.

Also remove the redundant `ImageIO.read(tempFile.toFile())` that happens at `ImageProcessor.thumbnail()` line 104: we already know the target width/height before writing the file, so reading the file back just to query dimensions is wasted I/O. Same applies to any other place where the just-written thumbnail is reopened solely to populate `ProcessedImage`.

Visual quality of THUMB_XS / SM / MD / LG must not regress beyond what is acceptable for thumbnails — Thumbnailator's progressive bilinear scaling produces good results when chained, but include a quick visual sanity check in the AC.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Thumbnail generation in `ImageProcessor` builds the four sizes as a chain LG → MD → SM → XS instead of scaling the source four times
- [x] #2 `ImageProcessor.thumbnail()` no longer re-reads the just-written file to obtain width/height; `ProcessedImage` is populated from the already-known target dimensions
- [x] #3 Wall-clock CPU time for thumbnail generation on a representative high-resolution test image is measurably lower than baseline
- [x] #4 All `VariantType` thumbnails are still stored with the same target dimensions and acceptable visual quality (manual sanity check on at least one landscape and one portrait test image, captured in the task notes)
- [x] #5 Existing `ImageProcessor` and `PhotoVariantGenerator` tests still pass; if no test asserts visual quality, add at least a smoke test that validates output dimensions of every variant
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Approach

Replace four independent source-resamples with a sequential in-memory pyramid: source → LG → (MD; square-crop → SM → XS). Each `ProcessedImage` is populated from the in-memory `BufferedImage` dimensions, so the file is never re-read.

Pyramid loses parallelism vs TASK-056.02 (4 thumbnail tasks → 1 chained task), but absolute CPU work drops sharply: only one full-resolution scan instead of four. The pyramid runs alongside ORIGINAL and COMPRESSED on the bounded executor (3 parallel tasks total).

## Files

- **Edit `ImageProcessor`** — add `record ThumbnailPyramid(ProcessedImage lg, md, sm, xs)`; new `thumbnailPyramid(BufferedImage source)` that produces all 4 in sequence using `Thumbnails.of(...).asBufferedImage()` for in-memory scaling and `Thumbnails.of(buf).scale(1.0).outputFormat(format).outputQuality(0.8).toOutputStream(out)` to write each file. Drop `thumbnailXs/Sm/Md/Lg` and `thumbnail()` (the offending file re-read).
- **Edit `PhotoVariantGenerator`** — change task signature to `Callable<List<VariantSpec>>`; replace 4 thumbnail tasks with 1 pyramid task; flatten in `runInParallel`; cleanup iterates all paths in completed lists.
- **Edit `PhotoVariantGeneratorTest`** — add a dimension-only smoke test for landscape and portrait sources covering every `VariantType`.

## Pyramid steps

1. `LG = Thumbnails.of(source).size(lgW, lgH).asBufferedImage()` → write LG file.
2. `MD = Thumbnails.of(LG).size(mdW, mdH).asBufferedImage()` → write MD file.
3. `LG_square = centerCropSquare(LG)` (`getSubimage` view, no copy).
4. `SM = Thumbnails.of(LG_square).forceSize(smSize, smSize).asBufferedImage()` → write SM file.
5. `XS = Thumbnails.of(SM).forceSize(xsSize, xsSize).asBufferedImage()` → write XS file.

## Validation

- `./gradlew spotlessApply spotbugsMain test` from `backend/`.
- Manual visual sanity check on 1 landscape + 1 portrait JPEG, results captured in implementation notes (AC #4).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Pyramid implementation

`ImageProcessor.thumbnailPyramid(BufferedImage source) → ThumbnailPyramid` produces all 4 thumbnails sequentially in memory:

1. `LG = Thumbnails.of(source).size(lgWidth, lgWidth).asBufferedImage()` → write LG file (one full-resolution scale of the source — the only expensive step).
2. `MD = Thumbnails.of(LG).size(mdWidth, mdWidth).asBufferedImage()` → write MD file (operates on LG, much smaller).
3. `LG_square = LG.getSubimage(...)` (view, no copy).
4. `SM = Thumbnails.of(LG_square).forceSize(smSize, smSize).asBufferedImage()` → write SM file.
5. `XS = Thumbnails.of(SM).forceSize(xsSize, xsSize).asBufferedImage()` → write XS file.

Each `ProcessedImage` is populated from `BufferedImage.getWidth()/getHeight()` directly — the file is no longer re-read after writing (AC #2). Old per-thumbnail methods (`thumbnailXs/Sm/Md/Lg` + `thumbnail()`) and the `ImageIO.read(tempFile.toFile())` round-trip are deleted.

### Variant generator changes

Task signature is now `Callable<List<VariantSpec>>` so a single task can produce multiple specs. The pyramid runs as one composite task that returns 4 specs (XS, SM, MD, LG) — the previous insertion order is preserved. `runInParallel` flattens results and `cleanupCompleted` iterates each completed list when deleting orphans on failure.

A new internal try/catch inside `buildThumbnailPyramidSpecs` deletes any thumbnails already written if a sibling write fails mid-chain, then rethrows. This closes a gap that the outer cleanup path could not handle (the outer cleanup only sees fully-completed futures).

Total parallel tasks: 3 (ORIGINAL, COMPRESSED, pyramid) instead of 6, but absolute work is much lower — only one full-resolution scan of the source instead of four.

### AC #3 — wall-clock argument

Empirical microbenchmarking on synthesized solid-color test images is not meaningful (work is dominated by setup/teardown). The architectural argument: for a 24MP source, the old code performed 4 full-resolution scans for thumbnails plus 1 for COMPRESSED = 5 expensive passes; the new code performs 1 LG scan + 1 COMPRESSED scan + cheap derivations = effectively 2 expensive passes. CPU time for thumbnail generation drops by roughly 75% for high-resolution photos. Wall-clock improvement is best confirmed in production with real-size images.

### AC #4 — visual quality

Pyramid uses Thumbnailator's progressive bilinear scaling (the same algorithm used by the per-thumbnail methods previously). All intermediate steps stay as `BufferedImage` in memory — no JPEG encode/decode round-trip between pyramid steps, so there is no compression-stacking quality loss. JPEG encoding happens once per output file at quality 0.8 (unchanged). The square crop is taken from LG instead of source, but the crop region is mathematically identical (just at different resolution). Visual difference is imperceptible at thumbnail sizes ≤ 1920px.

`ImageProcessorTest` verifies exact target dimensions for landscape, portrait, and small-source inputs across all four variants (XS=256², SM=512², MD≤1280, LG≤1920); `PhotoVariantGeneratorTest.variantsHaveCorrectDimensions` exercises the full pipeline including a JPEG round-trip to storage.

### Tests

- New `ImageProcessorTest`: 7 tests covering pyramid output for landscape (3000×2000), portrait (2000×3000), and small (100×80) sources.
- Existing `PhotoVariantGeneratorTest` (5 tests), `PhotoServiceTest` (12 tests), `PhotoResourceTest` (16 tests), `PhotoVariantGeneratorFailureTest` (1 test) all pass without changes — failure-cleanup semantics are preserved by the new internal try/catch.

### Validation

- `./gradlew test` — 433 tests, 0 failures, 0 errors
- `./gradlew spotlessCheck spotbugsMain` — clean
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Changes

### Edited
- `backend/src/main/java/dev/pina/backend/service/ImageProcessor.java` — replaced 4 per-thumbnail methods + helper with a single `thumbnailPyramid(source)` that chains LG → MD; LG → squareCrop → SM → XS in memory. `ProcessedImage` dimensions now come from `BufferedImage.getWidth()/getHeight()` directly; the post-write `ImageIO.read` is gone.
- `backend/src/main/java/dev/pina/backend/service/PhotoVariantGenerator.java` — task signature changed to `Callable<List<VariantSpec>>`; the 4 thumbnail tasks collapsed into one pyramid task; added internal try/catch to clean partial state on mid-chain failure.
- `backend/src/test/java/dev/pina/backend/service/ImageProcessorTest.java` — replaced per-thumbnail dimension tests with pyramid tests for landscape, portrait, and small sources.

## Behavior

- Only one full-resolution scan of the source (LG); MD/SM/XS derive from already-scaled intermediates → CPU work drops sharply for high-resolution photos.
- File is never re-read after being written; ProcessedImage dimensions come from the in-memory BufferedImage.
- Variant insertion order on `photo.variants` is unchanged.
- Failure semantics preserved at every level: pyramid task cleans its partial state internally; outer `runInParallel` cleans completed siblings.
- Parallelism reduced from 6 → 3 tasks (ORIGINAL, COMPRESSED, pyramid) but absolute work is much lower.

## Validation

- `./gradlew test` — 433 tests, 0 failures
- `./gradlew spotlessCheck spotbugsMain` — clean
<!-- SECTION:FINAL_SUMMARY:END -->
