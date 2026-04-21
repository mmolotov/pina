---
id: TASK-050.06
title: ML-FACE-001 Implement face clustering foundation for downstream browse APIs
status: To Do
assignee: []
created_date: '2026-04-20 13:55'
updated_date: '2026-04-20 13:56'
labels:
  - backend
  - ml
  - faces
milestone: m-3
dependencies:
  - TASK-050.05
references:
  - >-
    /Users/mama/dev/pina/backlog/tasks/task-035 -
    BE-SEARCH-003-Face-cluster-browse-and-management-APIs.md
  - >-
    /Users/mama/dev/pina/backlog/tasks/task-049 -
    ML-PLAN-001-Define-Phase-4-ML-service-delivery-plan.md
documentation:
  - docs/product-requirements.adoc
  - backend/README.md
  - MILESTONES.md
parent_task_id: TASK-050
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the backend-side face clustering foundation that groups persisted face descriptors into stable clusters for later browsing and naming. This task should focus on the data model and clustering behavior needed to support downstream face APIs, rather than on the final API surface itself.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Persisted face descriptors can be grouped into stable cluster records with deterministic identity or merge rules appropriate for incremental ingestion
- [ ] #2 The clustering approach supports adding newly analyzed photos without requiring a full rebuild for routine ingestion
- [ ] #3 The resulting data model is compatible with the browse, naming, and merge flows expected by `TASK-035` without a later schema redesign
- [ ] #4 Tests cover cluster assignment behavior and at least the core invariants needed to avoid unsafe merge or split outcomes
<!-- AC:END -->
