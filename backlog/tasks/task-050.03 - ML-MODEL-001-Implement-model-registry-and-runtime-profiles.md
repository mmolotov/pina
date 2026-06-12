---
id: TASK-050.03
title: ML-MODEL-001 Implement model registry and runtime profiles
status: Done
assignee:
  - '@claude'
created_date: '2026-04-20 13:55'
updated_date: '2026-06-12 06:42'
labels:
  - ml
  - models
  - ops
milestone: m-3
dependencies:
  - TASK-050.02
references:
  - >-
    https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html
  - >-
    https://onnxruntime.ai/docs/execution-providers/OpenVINO-ExecutionProvider.html
  - 'https://github.com/deepinsight/insightface'
  - 'https://github.com/mlfoundations/open_clip'
  - >-
    backlog/tasks/task-049 -
    ML-PLAN-001-Define-Phase-4-ML-service-delivery-plan.md
documentation:
  - MILESTONES.md
  - docs/product-requirements.adoc
  - ml/README.md
parent_task_id: TASK-050
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the model-registry layer for Phase 4 so the ML service can resolve, download, validate, and activate models through manifests instead of hardcoded runtime choices. The registry should support both the default installation profile and a lighter `cpu-lite` profile for weaker self-hosted hardware.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 YAML manifests describe each model with task type, version, source URL, license metadata, input or output expectations, and runtime requirements
- [x] #2 The ML service can download configured models on first use or startup, store them in a persistent cache, and avoid repeated downloads when artifacts already exist
- [x] #3 At least `default` and `cpu-lite` runtime profiles are defined with different step or model selections and hardware-friendly concurrency expectations
- [x] #4 License metadata is surfaced clearly enough to block or flag non-compliant default model choices for redistribution
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Manifest schema (`pina_ml/registry/manifest.py`, pydantic + PyYAML): ModelManifest{id, version, step (image_embedding|tagging|face_detection|face_embedding), runtime, license{spdx, url, commercial_use, allow_bundling, notes}, files[{name, url, sha256?, archive?{format: zip, member}}], input/output expectation dicts}; RuntimeProfileSpec{name, max_parallel_analyses, analysis_max_resolution, steps: step → {model, enabled}}.
2. Packaged manifests (`pina_ml/manifests/models/*.yaml`, `.../profiles/{default,cpu-lite}.yaml`): default = CLIP ViT-B/32 vision+text ONNX (Xenova export of openai/clip-vit-base-patch32, MIT) + InsightFace buffalo_l (SCRFD det_10g + ArcFace w600k_r50 from the GitHub release zip); cpu-lite = quantized CLIP int8 exports + buffalo_s (det_500m + w600k_mbf MobileFaceNet), max_parallel_analyses 1 vs 2, analysis_max_resolution 960 vs 1280. Optional extra manifests dir via PINA_ML_MANIFESTS_DIR for operator overrides.
3. Artifact cache + downloader (`pina_ml/registry/downloads.py`, httpx streaming): cache layout model-cache/models/<id>/<version>/<file>; shared zip archives cached once under model-cache/archives/<url-digest>.zip with member extraction (basename fallback for nested layouts); file:// support for tests/custom local models; .part temp + atomic rename; optional sha256 verification; skip when already cached.
4. Registry (`pina_ml/registry/registry.py`): loads manifests + active profile from Settings, ensure_model/ensure_all downloads, availability report per step, ready = all profile-required models cached, license_warnings() flags commercial_use=false / allow_bundling=false models (InsightFace packs) — logged at startup and surfaced via API for AC#4; weights are never bundled into images, only downloaded on the operator instance.
5. Wiring: GetServiceStatus returns real per-model availability + ready from the registry; new admin GET /api/models lists id/version/step/license/availability; main.py loads registry, logs license warnings, optionally kicks background ensure_all() via new PINA_ML_DOWNLOAD_MODELS_ON_STARTUP (default true).
6. Tests (offline only): packaged manifest/profile consistency (all 4 steps covered in both profiles, referenced ids exist), downloader file:// + zip-member + sha256 + cache-hit behavior with tmp fixtures, registry availability/ready flips after ensure_all, updated gRPC/admin smoke tests (packaged registry reports ready=false with 4 required models until artifacts exist; local-file registry reports ready=true).
7. Docs: ml/README.md (registry, manifests, profiles, licensing section), CHANGELOG.
Validation: make format lint test green; no network in tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation decisions: (1) Manifests live inside the package (src/pina_ml/manifests) so the wheel/Docker image carries them; PINA_ML_MANIFESTS_DIR adds an operator override dir (later-loaded manifests/profiles win by id/name) — this also doubles as the test seam and the future Phase 6 custom-model entry point. (2) Artifact cache layout models/<id>/<version>/<file> plus shared source archives under archives/<url-digest>.zip so the two InsightFace models per pack download one zip; zip member resolution falls back to unique basename match to tolerate packs with a top-level folder. (3) file:// URLs supported (tests + local custom models); downloads stream via httpx to .part files with atomic rename and optional sha256 verification. (4) GetServiceStatus and /api/info//api/models now report real per-model availability; ready == all profile-required models cached. (5) Startup downloads run as a background asyncio task (PINA_ML_DOWNLOAD_MODELS_ON_STARTUP, default true) so the service is reachable while fetching ~850MB (default) / ~270MB (cpu-lite); failures log and retry on next start. (6) All artifact URLs HEAD-verified live (7× HTTP 200): Xenova CLIP ONNX exports incl. *_quantized variants + buffalo_l/buffalo_s release zips.

License handling (AC#4): InsightFace manifests carry spdx LicenseRef-InsightFace-NonCommercial with commercial_use=false and allow_bundling=false; registry.license_warnings() logs prominent startup warnings and /api/models exposes the metadata; README licensing section documents that weights are downloaded at runtime onto the operator instance and must never be redistributed or baked into images. CLIP exports are MIT.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the model registry and runtime profiles for the ML service.

**Manifest schema** (pydantic + YAML): models declare id, version, pipeline step (image_embedding/tagging/face_detection/face_embedding), runtime, license metadata (spdx, commercial_use, allow_bundling, notes, url), and downloadable files (URL, optional sha256, optional zip-archive member). Profiles map steps to models with hardware limits (max_parallel_analyses, analysis_max_resolution).

**Packaged catalog**: `default` = CLIP ViT-B/32 ONNX fp32 (Xenova export, MIT) + InsightFace buffalo_l (SCRFD det_10g, ArcFace w600k_r50), 2-parallel/1280px, ~850MB; `cpu-lite` = CLIP int8 quantized + buffalo_s (det_500m, w600k_mbf MobileFaceNet), 1-parallel/960px, ~270MB. All 7 artifact URLs HEAD-verified (HTTP 200). Operator overrides via `PINA_ML_MANIFESTS_DIR`.

**Downloads/cache**: httpx streaming with .part + atomic rename, optional sha256 verification, file:// support, shared zip archives fetched once with basename-tolerant member extraction; artifacts cached under `models/<id>/<version>/` and never re-fetched while present. Background ensure-all at startup (`PINA_ML_DOWNLOAD_MODELS_ON_STARTUP`, default true) keeps boot non-blocking.

**Surfacing**: GetServiceStatus now reports real per-model availability and ready state; `/api/info` adds models_ready/max_parallel_analyses; new `/api/models` lists license + availability; restricted InsightFace packs (non-commercial research) raise startup warnings and are marked allow_bundling=false — never redistributed, only downloaded onto the operator instance.

**Tests** (16 total, all offline): packaged profile consistency (all 4 steps, disjoint model sets, stricter cpu-lite limits), license flagging, downloader (cache hits, shared-archive zip extraction, sha256 mismatch, scheme rejection), registry ready-flip after ensure_all, updated gRPC/admin smoke tests. make format/lint/test green.
<!-- SECTION:FINAL_SUMMARY:END -->
