---
id: TASK-035
title: BE-SEARCH-003 Face cluster browse and management APIs
status: To Do
assignee:
  - codex
created_date: '2026-04-03 17:09'
labels:
  - backend
  - search
  - faces
milestone: m-2
dependencies:
  - TASK-033
references:
  - MILESTONES.md
  - docs/product-requirements.adoc
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the backend APIs needed for face-based browsing in Phase 3: list clusters, inspect cluster media, and apply supported naming or merge operations. The task should respect the current product scope without dragging in unrelated ML pipeline administration.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Backend exposes `/api/v1/search/faces` and related cluster-detail endpoints with a stable DTO contract
- [ ] #2 Supported Phase 3 cluster mutations such as naming and merge are implemented and validated server-side
- [ ] #3 Face-search endpoints respect access control and only expose clusters and media visible to the authenticated user
- [ ] #4 Backend tests cover list, detail, mutation, and authorization behavior for face-cluster flows
<!-- AC:END -->
