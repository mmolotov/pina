---
id: TASK-053
title: ALBM-EPIC Redesign albums page
status: Done
assignee: []
created_date: '2026-04-22 12:13'
labels:
  - frontend
  - backend
  - ux
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context

The personal albums view today is a tab inside `frontend/app/routes/app-library.tsx`. The UX is weak:

- A large "Create album" form occupies most of the above-the-fold area.
- Albums render as single-column text cards with name, description, an inline edit form, a `<select>` to add photos, and a remove button per photo.
- No cover preview, no item count, no date range, no proper action toolbar, no sorting, and no dedicated detail view.

## Goal

Deliver a redesigned albums experience with the following shape:

1. **Top bar**: prominent "Create album" button that opens a modal with: name, description, section to upload new photos and/or pick existing photos for the album. Creation flow returns to the grid.
2. **Album grid**: tiled layout filling the page. Each tile shows a cover photo (user-selected or auto), name, media date range (`earliest – latest`), number of items, and an actions menu: favorite, edit, share, download, delete.
3. **Sorting**: name, item count, album created-at, album updated-at, newest photo in album.
4. **Album detail route**: clicking a tile opens the album's photos in a grid with a proportional timeline rail on the right, mirroring the main library timeline layout.

## Scope

This epic coordinates backend and frontend subtasks. See child tasks (ALBM-BE-* and ALBM-FE-*) for the concrete deliverables.

## References

- `frontend/app/routes/app-library.tsx` (current albums tab, lines ~1981–2305)
- `backend/src/main/java/dev/pina/backend/api/AlbumResource.java`
- `backend/src/main/java/dev/pina/backend/service/AlbumService.java`
- `backend/src/main/java/dev/pina/backend/domain/Album.java`, `AlbumPhoto.java`
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All ALBM-BE-* subtasks completed and merged
- [x] #2 All ALBM-FE-* subtasks completed and merged
- [x] #3 Albums grid, creation modal, detail route, and sorting all function end-to-end against the real backend
- [x] #4 No regression in existing album CRUD behaviour (existing tests continue to pass)
<!-- AC:END -->
