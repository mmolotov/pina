---
id: TASK-053.09
title: ALBM-FE-004 Album detail route with proportional timeline rail
status: To Do
assignee: []
created_date: '2026-04-22 12:16'
labels:
  - frontend
  - ux
milestone: m-2
dependencies: []
parent_task_id: TASK-053
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context

Today clicking an album does not open a dedicated view — photos render inline within the albums list. The spec requires an album detail view with the same proportional timeline rail used on the main library (`ProportionalTimelineRail` in `app-library.tsx`).

## What to build

- New routes in `frontend/app/routes.ts`:
  - `/app/library/albums/:albumId` → `app-album-detail.tsx`
  - `/app/library/albums/:albumId/photos/:photoId` → `app-album-photo-detail.tsx` (mirrors the existing space-album variant)
- `app-album-detail.tsx` layout:
  - Header: album name, description, cover thumbnail, media date range, item count, inline actions (Edit, Download, Share, Favorite, Delete).
  - Two-column content: photos grouped by day (reuse helpers from `app-library.tsx`) on the left, `ProportionalTimelineRail` on the right — same sticky behaviour as the library timeline.
  - "Add photos" action in the header that opens the existing photo picker / upload flow against this album.
  - Remove-photo affordance per photo on hover (reuses existing `removePhotoFromAlbum`).
  - "Set as album cover" action in the photo context menu (wired when ALBM-BE-003 lands; placeholder disabled until then).
- Extract shared timeline / day-grouping logic from `app-library.tsx` into a small module (`app/lib/timeline.ts` or similar) rather than duplicating 100+ lines.
- Photo detail route opens within album context so the "back" link returns to the album grid.
- i18n for `en` and `ru`.

## Dependencies

- ALBM-FE-002 (tile navigates here).
- Shared helpers may be factored from existing `app-library.tsx` code.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Two new routes registered: `/app/library/albums/:albumId` and `/app/library/albums/:albumId/photos/:photoId`
- [ ] #2 Album detail shows header (name, description, cover, date range, item count) and paginated photos grouped by day
- [ ] #3 Proportional timeline rail renders on the right with the same sticky behaviour as the library timeline
- [ ] #4 Timeline / day-grouping logic is shared (not duplicated) between library and album detail
- [ ] #5 Header provides Edit, Download, Share, Favorite toggle, and Delete actions
- [ ] #6 Photo detail route renders within the album context and the back link returns to the album grid
- [ ] #7 Vitest covers loader happy path, empty album, and navigation between grid / detail / photo detail
- [ ] #8 Strings in `en` and `ru`
<!-- AC:END -->
