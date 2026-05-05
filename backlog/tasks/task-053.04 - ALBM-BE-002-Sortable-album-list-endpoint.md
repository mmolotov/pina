---
id: TASK-053.04
title: ALBM-BE-002 Sortable album list endpoint
status: Done
assignee: []
created_date: '2026-04-22 12:15'
updated_date: '2026-04-23 08:11'
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
- [x] #1 `GET /api/v1/albums` accepts `sort` ∈ {name, itemCount, createdAt, updatedAt, newestPhoto} and `direction` ∈ {asc, desc}
- [x] #2 Invalid `sort` or `direction` returns 400 with a structured error matching project conventions
- [x] #3 Default ordering unchanged (`createdAt desc`) when no params are supplied
- [x] #4 Pagination (`page`, `size`, `needsTotal`) works correctly under every sort option
- [x] #5 Sorting is stable: ties broken by `id` so pagination does not skip/duplicate items
- [x] #6 Integration tests cover each sort value in both directions and verify stable pagination across pages
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- `AlbumService` exposes `SortField` (NAME, ITEM_COUNT, CREATED_AT, UPDATED_AT, NEWEST_PHOTO) and `SortDirection` (ASC, DESC) with case-insensitive `parse(String)` methods that throw `IllegalArgumentException` on invalid values. `SortField.defaultDirection()` returns ASC for NAME and DESC elsewhere.
- `listByOwner` and `listBySpace` now take `(PageRequest, SortField, SortDirection)` and delegate to a shared `listAlbums` helper using a two-phase query: (1) `SELECT a.id ... ORDER BY <expr>, a.id <dir>` — stable under ties; (2) `SELECT DISTINCT a FROM Album a <fetch joins> WHERE a.id IN :ids` then preserve the order in-memory.
- Sort expression is built with `buildOrderByClause`: simple column references for `name/createdAt/updatedAt`, and correlated subqueries for aggregate sorts — `(SELECT COUNT(ap) …)` for `itemCount` and `(SELECT MAX(COALESCE(p.takenAt, p.createdAt)) …)` for `newestPhoto`. `newestPhoto` adds `NULLS FIRST/LAST` so empty albums sort deterministically.
- `AlbumResource#list` and `SpaceResource#listAlbums` accept `sort` and `direction` query params, parse them in a `try/catch` around `IllegalArgumentException`, and return `ApiErrors.badRequest(...)` on invalid values — same shape SearchResource uses.
- Tests: 8 new cases in `AlbumResourceTest` — sort by name (asc/desc/default), item count (asc/desc), default createdAt desc and explicit asc, updatedAt after edit, newestPhoto with NULLS positioning, invalid sort/direction 400s, and stable pagination under ties.
<!-- SECTION:NOTES:END -->
