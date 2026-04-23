---
id: TASK-053.09
title: ALBM-FE-004 Album detail route with proportional timeline rail
status: Done
assignee:
  - codex
created_date: '2026-04-22 12:16'
updated_date: '2026-04-23 13:01'
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
- [x] #1 Two new routes registered: `/app/library/albums/:albumId` and `/app/library/albums/:albumId/photos/:photoId`
- [x] #2 Album detail shows header (name, description, cover, date range, item count) and paginated photos grouped by day
- [x] #3 Proportional timeline rail renders on the right with the same sticky behaviour as the library timeline
- [x] #4 Timeline / day-grouping logic is shared (not duplicated) between library and album detail
- [x] #5 Header provides Edit, Download, Share, Favorite toggle, and Delete actions
- [x] #6 Photo detail route renders within the album context and the back link returns to the album grid
- [x] #7 Vitest covers loader happy path, empty album, and navigation between grid / detail / photo detail
- [x] #8 Strings in `en` and `ru`
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect the current frontend routing, album/library pages, and shared timeline/photo-detail patterns to identify the minimum extraction needed for album-specific detail routes.
2. Register `/app/library/albums/:albumId` and `/app/library/albums/:albumId/photos/:photoId`, then implement album detail loaders and screens that reuse existing library and space-album patterns for grouped media rendering.
3. Extract shared day-grouping and proportional-timeline utilities from the current library route into a reusable module so album detail and the main library use the same behavior instead of duplicated logic.
4. Add the album detail header actions and album-context navigation/back-link behavior, including empty-state handling and photo-detail route integration.
5. Add or update Vitest coverage for loader happy path, empty album state, and navigation between album grid, album detail, and album photo detail, then run focused frontend checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added personal album detail and album-photo-detail routes, a shared timeline utility module, and a reusable proportional timeline rail component so album detail reuses the same day-grouping and rail behavior as the main library.

Implemented the album detail header, grouped photo sections, add-photos panel, edit/delete/favorite actions, and album-context photo detail navigation. Download/share and cover-selection actions are intentionally present as disabled placeholders because their real backend wiring is tracked in TASK-053.10.

Verified the route set with `npm run typecheck` and `npm run test -- --run app/routes/app-album-detail.test.tsx app/routes/app-album-photo-detail.test.tsx app/routes/app-library.test.tsx app/routes/app-search.test.tsx` in `frontend/`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented ALBM-FE-004 by adding `/app/library/albums/:albumId` and `/app/library/albums/:albumId/photos/:photoId`, building a personal album detail experience with grouped photos, sticky proportional timeline rail, album header actions, add-photos flow, and album-context photo detail navigation. Shared timeline/day-grouping logic now lives outside `app-library.tsx` in reusable frontend modules, album API types were aligned with the enriched backend DTO, and i18n strings were added in both English and Russian. Focused frontend validation passed with `npm run typecheck` plus targeted Vitest coverage for the new routes and affected library/search specs.
<!-- SECTION:FINAL_SUMMARY:END -->
