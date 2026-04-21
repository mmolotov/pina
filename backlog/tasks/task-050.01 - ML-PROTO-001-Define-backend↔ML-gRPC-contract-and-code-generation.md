---
id: TASK-050.01
title: ML-PROTO-001 Define backend↔ML gRPC contract and code generation
status: To Do
assignee: []
created_date: '2026-04-20 13:55'
labels:
  - ml
  - proto
  - backend
milestone: m-3
dependencies: []
references:
  - >-
    /Users/mama/dev/pina/backlog/tasks/task-049 -
    ML-PLAN-001-Define-Phase-4-ML-service-delivery-plan.md
documentation:
  - MILESTONES.md
  - docs/adr.adoc
  - docs/product-requirements.adoc
  - proto/README.md
parent_task_id: TASK-050
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Define the shared `proto/` contract for the backend↔ML boundary and wire code generation so both sides build from one source of truth. The first contract should stay photo-first for Phase 4 while remaining media-agnostic enough to carry future keyframe analysis without a protocol redesign.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Shared proto definitions cover health, photo-analysis request and response payloads, model or step provenance, and explicit per-step result status
- [ ] #2 Backend and ML-side builds generate or consume code from the same checked-in proto source without manual copy steps
- [ ] #3 The contract keeps Phase 4 photo-first scope but avoids assumptions that would block future keyframe-based video analysis
- [ ] #4 A compatibility check, golden fixture, or contract-focused test exists to reduce accidental drift between backend and ML implementations
<!-- AC:END -->
