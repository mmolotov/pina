---
id: TASK-050
title: ML-EPIC-001 Deliver Phase 4 ML service (basic)
status: To Do
assignee: []
created_date: '2026-04-20 13:54'
updated_date: '2026-04-20 13:57'
labels:
  - ml
  - backend
  - proto
  - epic
milestone: m-3
dependencies: []
references:
  - >-
    /Users/mama/dev/pina/backlog/tasks/task-049 -
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
- [ ] #1 A shared backend↔ML contract and runnable local ML service exist in the repository and local stack
- [ ] #2 Photo uploads can trigger asynchronous ML analysis without delaying the successful upload response
- [ ] #3 Embeddings, tags, detections, and face descriptors are persisted with a data model suitable for pgvector-backed retrieval and downstream face clustering
- [ ] #4 The milestone defines and documents at least `default` and `cpu-lite` deployment profiles for self-hosted environments
- [ ] #5 Compose, docs, and verification coverage are sufficient for follow-up API and frontend search work to consume the new ML outputs
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
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
This epic follows the delivery constraints defined in `TASK-049`: keep Phase 4 photo-first, avoid making full video execution a milestone gate before Phase 7, and treat low-end hardware support as a first-class runtime-profile concern rather than a later optimization. Existing search tasks should consume the Phase 4 data model instead of introducing a separate ML/search persistence path.
<!-- SECTION:NOTES:END -->
