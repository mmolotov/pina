---
id: TASK-049
title: ML-PLAN-001 Define Phase 4 ML service delivery plan
status: Done
assignee: []
created_date: '2026-04-20 13:44'
updated_date: '2026-04-20 13:45'
labels:
  - planning
  - ml
  - backend
  - proto
milestone: m-3
dependencies: []
references:
  - 'https://github.com/google-ai-edge/LiteRT-LM'
  - 'https://github.com/google-ai-edge/gallery'
  - >-
    https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html
  - >-
    https://onnxruntime.ai/docs/execution-providers/OpenVINO-ExecutionProvider.html
  - 'https://github.com/deepinsight/insightface'
  - 'https://github.com/mlfoundations/open_clip'
documentation:
  - MILESTONES.md
  - README.md
  - ml/README.md
  - proto/README.md
  - docs/product-requirements.adoc
  - docs/adr.adoc
  - backend/README.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Produce the execution plan for Phase 4 so PINA can add a first usable local ML service for photo embeddings, auto-tags, and face analysis without blocking uploads. The plan must align MILESTONES, PRD, and ADR decisions, keep the initial delivery photo-first, define how backend/search integration consumes ML outputs, and include a low-end hardware profile for self-hosted CPU-only or otherwise weak-device installs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Delivery stages are defined for the shared proto contract, ML service scaffold, model registry/runtime, photo analysis pipeline, backend persistence/search, and operations/testing
- [x] #2 Phase boundaries are explicit, including what remains deferred to Phase 6 or Phase 7, especially reindexing, multi-GPU scaling, and full video execution
- [x] #3 Low-end hardware strategy is documented, including smaller or quantized model profiles, concurrency or backpressure limits, and optional acceleration backends
- [x] #4 Key risks and constraints are called out, including face-model licensing and downstream dependencies for existing search work
- [x] #5 The task includes the local documentation set plus external references needed to decompose implementation into execution tasks
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Shared contract and code generation
Define `proto/pina/ml/v1` contracts for health, model catalog, pipeline profile, and photo-analysis requests/responses. Keep the request photo-first and pass already-derived image bytes plus minimal media metadata so backend and ML can evolve independently.

2. ML service scaffold
Create the `ml/` Python service with FastAPI for admin/health/config and a separate gRPC server for inference requests. Add Docker/Compose wiring, readiness/liveness checks, structured logging, and a persistent model-cache volume.

3. Model registry and runtime abstraction
Introduce YAML manifests per pipeline step and model with source URL, version, license, input shape, output schema, and runtime requirements. Keep manifests runtime-agnostic so the same catalog can run with CPU-only defaults or optional hardware-specific providers.

4. Photo pipeline v1
Ship the first usable asynchronous photo pipeline around CLIP-style embeddings, zero-shot auto-tagging, and face detection or recognition. Use the compressed or medium derived photo variant as the ML input so analysis does not depend on original-file retention.

5. Backend orchestration and persistence
Dispatch ML work asynchronously from photo upload without blocking the HTTP response, and tolerate temporary ML outages with retryable job handling. Persist embeddings, tags, detections, and face descriptors in dedicated tables, and add pgvector indexes for semantic retrieval.

6. Search alignment
Use Phase 4 outputs to back semantic text, tag, and face search while keeping the current `/api/v1/search` contract stable for the frontend. Existing search tasks `TASK-024` and `TASK-033` through `TASK-036` should consume these outputs instead of inventing a parallel search data model.

7. Video boundary and sequencing
Keep milestone success explicitly photo-first. Prepare media-agnostic analysis interfaces and a keyframe extraction seam, but do not make full video execution a gating item before Phase 7 video entities, upload, and storage flows exist.

8. Low-end hardware profile
Define at least two deployment profiles: `default` and `cpu-lite`. The `cpu-lite` profile should reduce analysis resolution and concurrency, prefer smaller model classes, allow quantized ONNX artifacts where accuracy remains acceptable, and make heavy steps optional instead of mandatory.

9. Verification and follow-up decomposition
Add contract tests, ML smoke tests, compose boot validation, and a simple benchmark matrix for CPU-only hardware. Before implementation starts, split the work into execution tasks for proto/build, ML scaffold, model registry/runtime, backend persistence/search, face clustering, and operations/performance.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Assumption: Phase 4 ships a photo-first ML path and prepares, but does not fully activate, video ML execution until the Phase 7 video backend exists.

Low-end hardware evaluation: LiteRT-LM and Google AI Edge Gallery are useful reference points for hardware-profiled packaging, but they are not a direct Phase 4 runtime fit because they focus on on-device/mobile LLM execution while this milestone needs a server-side Python image-analysis service. ONNX Runtime is the stronger baseline for this phase because it supports model quantization and multiple execution providers; its OpenVINO Execution Provider can accelerate ONNX models on Intel CPU, GPU, and NPU, which is relevant for weak self-hosted hardware.

Face-model licensing risk: the InsightFace Python library uses ONNX Runtime, but its published pretrained model packs are documented as non-commercial research only. Phase 4 must not hardwire those weights into the default distributable profile without license resolution or a switch to compliant/user-supplied ONNX packs.

Explicit deferrals: background reindexing, multi-GPU worker pools, captioning, OCR, NSFW detection, aesthetic scoring, and full video analysis remain outside this basic milestone unless the roadmap is revised.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Prepared the Phase 4 implementation plan from the repository roadmap and architecture docs, and added an explicit low-end hardware strategy plus external runtime references. Documented a key licensing risk around InsightFace pretrained model packs and clarified that video execution must stay photo-first until Phase 7 video support exists.
<!-- SECTION:FINAL_SUMMARY:END -->
