---
id: TASK-050.04
title: ML-PIPE-001 Implement photo analysis pipeline v1
status: Done
assignee:
  - '@claude'
created_date: '2026-04-20 13:55'
updated_date: '2026-06-12 06:58'
labels:
  - ml
  - pipeline
  - photos
milestone: m-3
dependencies:
  - TASK-050.01
  - TASK-050.02
  - TASK-050.03
references:
  - 'https://github.com/mlfoundations/open_clip'
  - 'https://github.com/deepinsight/insightface'
  - >-
    backlog/tasks/task-049 -
    ML-PLAN-001-Define-Phase-4-ML-service-delivery-plan.md
documentation:
  - MILESTONES.md
  - docs/product-requirements.adoc
  - ml/README.md
  - backend/README.md
parent_task_id: TASK-050
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the first usable Phase 4 photo-analysis pipeline in the ML service. The initial pipeline should stay photo-only and focus on the outputs that unblock semantic retrieval and face-driven organization: image embeddings, auto-tags, face detections, and face descriptors suitable for later clustering.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 For a photo input, the pipeline can produce image embeddings, auto-tags, face detections, and face descriptors through configured processing steps
- [x] #2 The pipeline consumes a derived photo variant suitable for analysis so Phase 4 does not depend on retaining original files
- [x] #3 Pipeline responses include enough provenance to identify which model and version produced each result set
- [x] #4 Failure of one enabled step is handled explicitly so a single model issue does not crash the whole analysis flow or force upload-path failure
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Deps: onnxruntime, numpy, pillow, tokenizers (runtime); onnx (dev — builds tiny interface-compatible test models). Sessions honor PINA_ML_EXECUTION_PROVIDERS with CPUExecutionProvider fallback (pipeline/sessions.py).
2. CLIP (pipeline/clip.py): preprocess resize-shortest+center-crop 224, CLIP mean/std, NCHW; vision wrapper returns L2-normalized image embedding (output picked by name image_embeds with positional fallback); text wrapper uses tokenizers (truncate to 77, batch padding) over tokenizer.json; zero-shot tagging scores logit-scale-100 softmax of image embedding against precomputed label-prompt embeddings ("a photo of {label}") from packaged vocabulary pipeline/data/tag_vocabulary.txt (~200 photo-centric labels, override via PINA_ML_TAGS_VOCABULARY_PATH); top-k/min-confidence settings.
3. Faces (pipeline/faces.py): SCRFD top-left letterbox to 640, (x-127.5)/128 blob, decode strides 8/16/32 × 2 anchors positionally (scores/bboxes/kps), distance2bbox + 5-point kps, NMS IoU 0.4, min confidence setting, boxes normalized to [0,1]; face alignment via umeyama similarity transform to the standard 112×112 ArcFace 5-point template using PIL affine warp; ArcFace wrapper returns L2-normalized 512-d descriptors.
4. Orchestrator (pipeline/pipeline.py): PhotoAnalysisPipeline with profile-driven semaphore (max_parallel_analyses) and initial decode downscale to analysis_max_resolution; lazy model loading through registry.ensure_step (download on first use); per-step outcomes carrying status (COMPLETED/FAILED/SKIPPED_DISABLED/SKIPPED_UNAVAILABLE), manifest provenance, duration_ms, error; TAGGING consumes the IMAGE_EMBEDDING result (SKIPPED_UNAVAILABLE when absent), FACE_EMBEDDING consumes FACE_DETECTION output; embed_text() backs the EmbedText RPC via the tagging text model; inference runs in asyncio.to_thread.
5. gRPC wiring: AnalyzeImage maps outcomes/results to StepResult/Tag/FaceDetection/Embedding proto messages; undecodable payload aborts INVALID_ARGUMENT (request-level error per contract); EmbedText implemented.
6. Settings additions: tag_top_k, tag_min_confidence, face_min_confidence, tags_vocabulary_path.
7. Tests (offline): onnx.helper-built tiny models matching real interfaces (vision pixel_values→image_embeds; text input_ids/attention_mask→text_embeds; SCRFD 9 constant outputs with one synthetic high-score anchor at a known location to exercise decode; rec (N,3,112,112)→(N,512)) plus a minimal tokenizer.json; gRPC end-to-end AnalyzeImage asserting embedding/tags/faces and per-step provenance; unit tests for distance2bbox/NMS/letterbox math, alignment, CLIP preprocess; failure paths (corrupt image → INVALID_ARGUMENT, missing artifacts → SKIPPED_UNAVAILABLE, disabled step → SKIPPED_DISABLED, EmbedText).
8. Docs: ml/README pipeline section, CHANGELOG.
Validation: make format lint test green offline; then one real-model smoke with the cpu-lite profile (~270MB download) sending a real photo through AnalyzeImage to verify actual ONNX I/O names, zip member names, and sane tags.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation decisions: (1) No insightface/torch/open_clip dependencies — ONNX Runtime only, with SCRFD decode (strides 8/16/32 × 2 anchors, distance2bbox, 5-point kps, NMS 0.4) and umeyama 5-point alignment to the 112×112 ArcFace template implemented in numpy/PIL; keeps the image slim and avoids the insightface package's research-only coupling. (2) Tagging reuses the IMAGE_EMBEDDING output (CLIP zero-shot over packaged ~250-label vocabulary with prompt 'a photo of {label}', logit scale 100 softmax, top-k + min-confidence settings); when the embedding step is absent the tagging outcome is SKIPPED_UNAVAILABLE — explicit, no hidden double inference. (3) ONNX I/O resolved by name with positional fallback (pixel_values→image_embeds, input_ids/attention_mask→text_embeds); CLIP truncation keeps the EOS token since CLIP pools at EOS. (4) Models load lazily through registry.ensure_step (download on first use) under a lock; inference runs in asyncio.to_thread; concurrency capped by profile max_parallel_analyses; initial decode downscales to profile analysis_max_resolution and applies EXIF transpose defensively. (5) Tests use tiny onnx.helper-built models with the real interfaces incl. a constant-output SCRFD lookalike with one confident anchor at a known location, which exercises the full decode path offline.

Real-model verification (cpu-lite, ~270MB): all artifacts downloaded incl. buffalo_s.zip shared-archive extraction (det_500m.onnx, w600k_mbf.onnx); all 4 steps COMPLETED against real quantized CLIP + SCRFD + ArcFace (vision 170ms, tagging 375ms first-call incl. vocab embedding, det 40ms, rec 15ms on Apple Silicon CPU); 512-d embedding; a UI screenshot correctly got top tag 'screenshot' (0.098) and zero faces — sane zero-shot output and no detector false positives. scripts/real_model_smoke.py committed as the reusable verification entrypoint (feeds TASK-050.07 smoke/benchmark work).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented photo-analysis pipeline v1 in the ML service; `AnalyzeImage` and `EmbedText` are now fully functional.

**Steps** (all ONNX Runtime, no torch/insightface deps): CLIP vision → L2-normalized image embedding; zero-shot tagging of that embedding against a packaged ~250-label vocabulary ("a photo of {label}", logit-scale-100 softmax, top-k/min-confidence knobs); SCRFD face detection (640px letterbox, full anchor decode + NMS in numpy, normalized boxes); ArcFace descriptors via umeyama 5-point alignment to the 112×112 template (PIL affine warp), L2-normalized.

**Orchestration**: per-step outcomes with status (COMPLETED/FAILED/SKIPPED_DISABLED/SKIPPED_UNAVAILABLE), model id+version+runtime provenance, and duration_ms — a single broken model never fails the RPC (AC#4); lazy model loading with download-on-first-use; concurrency capped by profile `max_parallel_analyses`; input is always a derived variant, downscaled to profile `analysis_max_resolution` (AC#2); undecodable payloads abort INVALID_ARGUMENT per contract. EmbedText reuses the tagging text model and returns provenance.

**Config**: PINA_ML_TAG_TOP_K, PINA_ML_TAG_MIN_CONFIDENCE, PINA_ML_FACE_MIN_CONFIDENCE, PINA_ML_TAGS_VOCABULARY_PATH.

**Tests** (28 total, offline): tiny onnx.helper fixture models with real I/O interfaces (incl. constant-output SCRFD with a known confident anchor exercising the decode math), gRPC end-to-end AnalyzeImage (embeddings/tags/faces/provenance), requested-step filtering, dependency skips, disabled-step reporting, missing-artifact skips, INVALID_ARGUMENT, EmbedText; unit tests for SCRFD decode/NMS/letterbox, umeyama alignment, CLIP preprocess, tag scoring.

**Real-model proof** (cpu-lite, ~270MB): all four steps COMPLETED against real quantized CLIP + SCRFD det_500m + ArcFace w600k_mbf; 512-d embeddings; UI screenshot correctly top-tagged "screenshot"; zero face false-positives. `scripts/real_model_smoke.py` added as a reusable verification entrypoint.
<!-- SECTION:FINAL_SUMMARY:END -->
