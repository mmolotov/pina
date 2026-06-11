---
id: TASK-050.08
title: ML-SEARCH-001 Expose tag-backed search through /api/v1/search
status: To Do
assignee: []
created_date: '2026-06-11 16:16'
labels:
  - backend
  - ml
  - search
milestone: m-3
dependencies:
  - TASK-050.05
references:
  - backlog/tasks/task-034 - BE-SEARCH-002-Text-and-tag-search-API.md
  - >-
    backlog/tasks/task-050.05 -
    ML-BE-001-Add-backend-ML-orchestration-persistence-and-pgvector-storage.md
documentation:
  - backend/README.md
  - MILESTONES.md
parent_task_id: TASK-050
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the existing search stack so persisted ML auto-tags become searchable through the stable `/api/v1/search` contract, covering the Phase 4 milestone bullet "Search by tags". Current search (TASK-034) matches photo filenames and album names/descriptions only; once TASK-050.05 persists auto-tags, tag matches should become an additional photo-match signal without breaking the existing DTO contract or pagination semantics. Semantic embedding (CLIP text) search stays out of scope — it requires query-time text embeddings via the ML service and lands as follow-up work.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Photo results match when the query matches a persisted auto-tag of an accessible photo, in addition to existing filename matching
- [ ] #2 Tag matches contribute to relevance scoring with deterministic ordering, and existing filters, sort, and pagination behavior stay unchanged
- [ ] #3 Access control for tag-matched results is identical to existing photo search results across library, space, and favorites scopes
- [ ] #4 Backend tests cover tag-backed matching, scoring, and authorization paths
<!-- AC:END -->
