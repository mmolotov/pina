---
id: TASK-053.04
title: ALBM-BE-002 Sortable album list endpoint
status: To Do
assignee: []
created_date: '2026-04-22 12:15'
labels:
  - backend
  - api
dependencies:
  - TASK-053.01
parent_task_id: TASK-053
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context

`GET /api/v1/albums` currently hard-codes `ORDER BY a.createdAt DESC`. The redesigned grid needs user-controlled sorting.

## What to build

Accept `sort` and `direction` query parameters on both `GET /api/v1/albums` and the equivalent space-scoped list endpoint (keep behaviour consistent).

Supported `sort` values:
- `name` — by album name
- `itemCount` — by photo count (depends on ALBM-BE-001 aggregation)
- `createdAt` — album created-at (default)
- `updatedAt` — album updated-at
- `newestPhoto` — latest `latestPhotoAddedAt` (depends on ALBM-BE-001)

`direction` accepts `asc` / `desc`; defaults to `desc` except for `name` which defaults to `asc`. Invalid values return 400 with a clear error. Pagination semantics unchanged.

## Dependencies

- ALBM-BE-001 (TASK-053.01) must land first so the aggregate fields exist for `itemCount` and `newestPhoto` sorting.

## Out of scope

- Free-text filtering — already happens client-side; if needed, a follow-up.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `GET /api/v1/albums` accepts `sort` ∈ {name, itemCount, createdAt, updatedAt, newestPhoto} and `direction` ∈ {asc, desc}
- [ ] #2 Invalid `sort` or `direction` returns 400 with a structured error matching project conventions
- [ ] #3 Default ordering unchanged (`createdAt desc`) when no params are supplied
- [ ] #4 Pagination (`page`, `size`, `needsTotal`) works correctly under every sort option
- [ ] #5 Sorting is stable: ties broken by `id` so pagination does not skip/duplicate items
- [ ] #6 Integration tests cover each sort value in both directions and verify stable pagination across pages
<!-- AC:END -->
