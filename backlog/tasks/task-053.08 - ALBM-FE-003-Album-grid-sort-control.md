---
id: TASK-053.08
title: ALBM-FE-003 Album grid sort control
status: Done
assignee: []
created_date: '2026-04-22 12:16'
labels:
  - frontend
milestone: m-2
dependencies:
  - TASK-053.01
parent_task_id: TASK-053
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context

ALBM-BE-002 adds `sort` + `direction` to `GET /api/v1/albums`. The albums view needs a user-facing sort control wired to that API.

## What to build

- A sort dropdown above the grid with these options (and i18n labels):
  - Name (A–Z / Z–A)
  - Item count (few → many / many → few)
  - Album created (newest / oldest)
  - Album updated (newest / oldest)
  - Newest photo (newest / oldest)
- Persist the chosen sort + direction to the URL via `useSearchParams` (`?sort=...&dir=...`) so deep-links are stable.
- `clientLoader` reads params and passes them to `listAlbums` (extend the API helper to accept them).
- Default sort: album created, descending (matches current behaviour).
- Handle backend 400s gracefully — reset to default and show an inline message.

## Dependencies

- ALBM-BE-002 (depends on ALBM-BE-001).
- ALBM-FE-002 for the grid context.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Sort dropdown with all five sort keys and both directions, labelled in `en` and `ru`
- [x] #2 Selection persists to URL (`?sort=`, `?dir=`) and survives page reload
- [x] #3 `listAlbums` helper accepts `sort` and `direction` params and they are sent to the backend
- [x] #4 Default sort is `createdAt desc` when no params present — matching current behaviour
- [x] #5 Invalid combinations (e.g. unsupported sort) reset to default and surface an inline hint
- [x] #6 Vitest covers URL sync, default behaviour, and the API call shape
<!-- AC:END -->
