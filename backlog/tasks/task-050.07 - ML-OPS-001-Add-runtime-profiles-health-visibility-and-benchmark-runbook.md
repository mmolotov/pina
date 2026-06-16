---
id: TASK-050.07
title: 'ML-OPS-001 Add runtime profiles, health visibility, and benchmark runbook'
status: Done
assignee:
  - '@claude'
created_date: '2026-04-20 13:56'
updated_date: '2026-06-12 14:29'
labels:
  - ml
  - ops
  - performance
milestone: m-3
dependencies:
  - TASK-050.02
  - TASK-050.03
  - TASK-050.04
  - TASK-050.05
references:
  - >-
    https://onnxruntime.ai/docs/execution-providers/OpenVINO-ExecutionProvider.html
  - >-
    https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html
  - >-
    backlog/tasks/task-049 -
    ML-PLAN-001-Define-Phase-4-ML-service-delivery-plan.md
documentation:
  - README.md
  - ml/README.md
  - backend/README.md
  - docs/product-requirements.adoc
parent_task_id: TASK-050
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Document and operationalize the Phase 4 ML service so self-hosters can understand runtime profiles, health state, and weak-hardware tradeoffs. This task covers the supporting operational layer around the ML service rather than the core inference logic itself.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Compose and developer-facing docs explain the supported runtime profiles, provider selection, cache behavior, and expected weak-hardware tradeoffs
- [x] #2 The service or admin-facing health surface exposes enough information to understand whether the ML runtime is reachable, which profile is active, and whether required models are available
- [x] #3 A reproducible smoke path validates local boot plus at least one backend↔ML inference round-trip in the configured stack
- [x] #4 A small benchmark or sizing matrix is recorded for CPU-only operation so the `cpu-lite` profile has evidence-based concurrency and throughput guidance
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Health visibility (AC#2): ML-side surfaces already exist (gRPC health, GetServiceStatus, /readyz, /api/info, /api/models from 050.02/03); add the admin-facing view — backend GET /api/v1/admin/health gains an `ml` block (reachable, activeProfile, ready, modelsAvailable/modelsTotal) populated via GetServiceStatus with a short deadline; UNREACHABLE degrades gracefully. Test via fake @GrpcService profile + degraded profile.
2. Smoke path (AC#3): docker/smoke-ml.sh — compose up postgres+ml+backend, wait for health, register user, upload a real PNG via the API, poll photo_analysis_jobs through compose exec psql until COMPLETED, print persisted tags; PINA_ML_PROFILE selectable (cpu-lite default for the runbook); --down flag to clean up. Documented as the reproducible boot + backend↔ML round-trip.
3. Benchmark (AC#4): ml/scripts/benchmark.py — ensures models for the active profile, one warmup pass (lazy loads + vocabulary embedding), then N timed AnalyzeImage-equivalent passes collecting per-step durations from outcomes; prints a step×latency matrix (mean/p50/p95). Run on this machine for cpu-lite and default profiles; record the resulting CPU-only sizing matrix and concurrency guidance in ml/README.
4. Docs (AC#1): ml/README Operations section (profiles tradeoffs recap, cache/volume behavior, provider selection incl. OpenVINO note, benchmark matrix, smoke runbook); root README stack/compose paragraph updated for the ml service; backend README admin health note; CHANGELOGs.
5. Epic wrap-up afterwards: MILESTONES.md Phase 4 bullets, epic TASK-050 finalization.
Validation: smoke-ml.sh green against the real compose stack (cpu-lite); backend build green; ml make lint test green.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification artifacts: (1) docker/smoke-ml.sh ran green end-to-end against the real compose stack (cpu-lite): boot → register → upload → async analysis COMPLETED → tags 'screenshot=0.114, laptop=0.079', 1 embedding row — sane output for a UI screenshot. (2) Benchmark matrix measured on Apple Silicon CPU, 10 iterations each: cpu-lite ~44ms/photo (~22 photos/s serial), default ~138ms/photo (~7 photos/s; SCRFD det_10g dominates at ~99ms) — recorded in ml/README with concurrency guidance. (3) Backend admin health ml block tested against the fake @GrpcService (reachable/profile/ready/model counts) and the disabled default profile. Fixes that fell out of making the stack actually boot: compose backend was missing PINA_ALBUM_DOWNLOAD_TOKEN_SIGNING_KEY (prod-mode boot failure) and JWT keys (now a documented ro-mount of backend/dev-keys); postgres host port made configurable (PINA_POSTGRES_PORT) to coexist with a local PostgreSQL; ml downloader read-timeout raised to 300s after a real httpx.ReadTimeout on the 335MB CLIP vision download.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Operationalized the Phase 4 ML stack: docs, health visibility, a reproducible stack smoke, and a measured CPU sizing matrix.

**Health visibility (AC#2)**: ML-side surfaces (grpc.health.v1, GetServiceStatus, /readyz, /api/info, /api/models) documented; backend `GET /api/v1/admin/health` now includes an `ml` block (enabled, reachable, activeProfile, ready, modelsAvailable/modelsTotal) via GetServiceStatus with a 2s deadline, degrading to reachable=false. Covered by tests in both the fake-ML and disabled profiles.

**Stack smoke (AC#3)**: `docker/smoke-ml.sh` boots postgres+ml+backend, uploads a photo through the API, and waits for the async analysis to land in the DB; verified green for real (cpu-lite): tags "screenshot=0.114, laptop=0.079" persisted for a UI screenshot. Making the stack genuinely bootable also fixed compose gaps: backend prod-mode signing key env, JWT dev-keys ro-mount (documented inline), configurable PINA_POSTGRES_PORT.

**Benchmark (AC#4)**: `ml/scripts/benchmark.py` prints a per-step latency matrix; measured both profiles on an Apple Silicon CPU — cpu-lite ~44ms/photo (~22 photos/s), default ~138ms/photo (~7 photos/s, face detection dominates). Matrix + weak-hardware guidance (cpu-lite ≈3× throughput, keep max_parallel_analyses=1 on SBCs) recorded in ml/README.

**Docs (AC#1)**: ml/README Operations section (health surfaces, cache/volume behavior, provider selection incl. OpenVINO pointer, smoke runbook, sizing matrix); root README Phase 4 overview + compose/model-download notes; backend README admin health; CHANGELOGs. Also raised the ml downloader read timeout to 300s after hitting a real CDN stall on the 335MB CLIP download.
<!-- SECTION:FINAL_SUMMARY:END -->
