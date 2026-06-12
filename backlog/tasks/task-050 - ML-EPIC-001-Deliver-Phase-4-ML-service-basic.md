---
id: TASK-050
title: ML-EPIC-001 Deliver Phase 4 ML service (basic)
status: Done
assignee: []
created_date: '2026-04-20 13:54'
updated_date: '2026-06-12 14:29'
labels:
  - ml
  - backend
  - proto
  - epic
milestone: m-3
dependencies: []
references:
  - >-
    backlog/tasks/task-049 -
    ML-PLAN-001-Define-Phase-4-ML-service-delivery-plan.md
documentation:
  - MILESTONES.md
  - docs/product-requirements.adoc
  - docs/adr.adoc
  - README.md
  - backend/README.md
  - ml/README.md
  - proto/README.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deliver the first usable Phase 4 ML stack for PINA as a photo-first, local-only service. The milestone should add the shared backend↔ML contract, a Python ML service, model registry and runtime profiles, asynchronous photo analysis, persisted embeddings and face data, and the operational foundation needed for downstream semantic, tag, and face search work without blocking the upload path.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A shared backend↔ML contract and runnable local ML service exist in the repository and local stack
- [x] #2 Photo uploads can trigger asynchronous ML analysis without delaying the successful upload response
- [x] #3 Embeddings, tags, detections, and face descriptors are persisted with a data model suitable for pgvector-backed retrieval and downstream face clustering
- [x] #4 The milestone defines and documents at least `default` and `cpu-lite` deployment profiles for self-hosted environments
- [x] #5 Compose, docs, and verification coverage are sufficient for follow-up API and frontend search work to consume the new ML outputs
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. `TASK-050.01` — define the shared gRPC contract and code generation flow under `proto/`.
2. `TASK-050.02` — scaffold the Python ML service runtime and local deployment wiring.
3. `TASK-050.03` — implement model manifests, downloads, cache handling, and `default` / `cpu-lite` runtime profiles.
4. `TASK-050.04` — implement the first photo-analysis pipeline for embeddings, tags, detections, and face descriptors.
5. `TASK-050.05` — add backend orchestration, retry-safe asynchronous invocation, persistence, and pgvector-backed storage.
6. `TASK-050.06` — build face clustering data foundations that downstream browse APIs can consume.
7. `TASK-050.07` — document runtime profiles, health visibility, smoke coverage, and CPU-only sizing guidance.

8. `TASK-050.08` — expose tag-backed search through the existing `/api/v1/search` contract once ML outputs are persisted (covers the Phase 4 "Search by tags" milestone bullet; semantic embedding search stays follow-up work).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
This epic follows the delivery constraints defined in `TASK-049`: keep Phase 4 photo-first, avoid making full video execution a milestone gate before Phase 7, and treat low-end hardware support as a first-class runtime-profile concern rather than a later optimization. Existing search tasks should consume the Phase 4 data model instead of introducing a separate ML/search persistence path.

Validation pass 2026-06-11: references previously pointed at stale absolute paths from the old `/Users/mama/dev/pina` checkout; replaced with repo-relative paths across the epic and subtasks. Added TASK-050.08 so the Phase 4 milestone bullet 'Search by tags' has an execution task (current TASK-034 search is filename-based only — no tag data exists yet).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Phase 4 ML service (basic) delivered end to end across eight subtasks (TASK-050.01–050.08), all Done.

**Contract & service**: shared `pina.ml.v1` gRPC contract with codegen on both sides and a golden drift-guard test (050.01); runnable Python ML service — grpc.aio + FastAPI admin, env-driven config, Docker/compose with persistent model cache (050.02); YAML model registry with `default`/`cpu-lite` profiles, runtime downloads, and license flagging for the non-commercial InsightFace packs (050.03); photo pipeline v1 on pure ONNX Runtime — CLIP embeddings, zero-shot tags, SCRFD detection, ArcFace descriptors with per-step status/provenance, proven against real models (050.04).

**Backend**: async orchestration with lease-based retryable jobs that never delay or fail uploads, pgvector persistence (embeddings vector(512) + HNSW, tags, faces) and query paths (050.05); per-owner incremental face clustering compatible with the TASK-035 browse/naming/merge API work (050.06); ops layer — admin-health ML block, reproducible `docker/smoke-ml.sh` stack round-trip (verified green), measured CPU sizing matrix for both profiles (050.07); tag-backed search through the stable `/api/v1/search` contract (050.08).

**Verification**: backend suite 461 tests green with SpotBugs + coverage gates; ML suite 28 offline tests + real-model smoke; full compose stack smoke green (upload → gRPC → analysis → pgvector rows). MILESTONES Phase 4 bullets ticked except video keyframe extraction, which stays explicitly deferred to Phase 7 per the TASK-049 plan (the contract already carries the keyframe seam). Follow-ups unblocked: TASK-035 face browse APIs, semantic text search (EmbedText + nearest-neighbor path ready).
<!-- SECTION:FINAL_SUMMARY:END -->
