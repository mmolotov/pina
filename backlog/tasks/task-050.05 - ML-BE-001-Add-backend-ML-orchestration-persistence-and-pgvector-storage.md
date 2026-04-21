---
id: TASK-050.05
title: 'ML-BE-001 Add backend ML orchestration, persistence, and pgvector storage'
status: To Do
assignee: []
created_date: '2026-04-20 13:55'
updated_date: '2026-04-20 13:56'
labels:
  - backend
  - ml
  - search
milestone: m-3
dependencies:
  - TASK-050.01
  - TASK-050.04
references:
  - >-
    /Users/mama/dev/pina/backlog/tasks/task-049 -
    ML-PLAN-001-Define-Phase-4-ML-service-delivery-plan.md
  - >-
    /Users/mama/dev/pina/backlog/tasks/task-033 -
    BE-SEARCH-001-Search-API-foundation-and-result-model.md
  - >-
    /Users/mama/dev/pina/backlog/tasks/task-034 -
    BE-SEARCH-002-Text-and-tag-search-API.md
  - >-
    /Users/mama/dev/pina/backlog/tasks/task-036 -
    BE-SEARCH-004-Search-filters-sort-and-query-validation.md
documentation:
  - backend/README.md
  - docs/adr.adoc
  - docs/product-requirements.adoc
  - MILESTONES.md
parent_task_id: TASK-050
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the backend so photo ingestion can hand work off to the ML service asynchronously and persist the resulting ML outputs in a search-friendly schema. The resulting storage model should support pgvector retrieval, tag-based filtering, and downstream face-cluster APIs without inventing a parallel search data path.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Photo upload can schedule or trigger ML analysis asynchronously without delaying the successful upload response
- [ ] #2 The backend degrades gracefully when the ML service is unavailable and preserves a retryable path instead of dropping analysis silently
- [ ] #3 Flyway migrations and backend domain or repository layers persist embeddings, tags, detections, and face descriptors in a schema suitable for pgvector-backed retrieval
- [ ] #4 Backend tests cover orchestration behavior, degraded ML availability, persistence of ML outputs, and loading paths that downstream search work can consume
<!-- AC:END -->
