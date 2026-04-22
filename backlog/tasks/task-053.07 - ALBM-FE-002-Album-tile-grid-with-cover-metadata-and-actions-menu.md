---
id: TASK-053.07
title: 'ALBM-FE-002 Album tile grid with cover, metadata, and actions menu'
status: To Do
assignee: []
created_date: '2026-04-22 12:16'
labels:
  - frontend
  - ux
milestone: m-2
dependencies:
  - TASK-053.01
parent_task_id: TASK-053
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context

Today each album is rendered as a one-column `SurfaceCard` with text and an inline editor. The redesign replaces that list with a responsive tile grid.

## What to build

- A responsive tile grid (e.g. `grid-cols-2 md:grid-cols-3 xl:grid-cols-4`) rendering one `AlbumTile` per album.
- `AlbumTile` contents:
  - Cover image (use `coverPhotoId` + variants from the enriched `AlbumDto`; placeholder illustration if `photoCount === 0`).
  - Album name (truncated, title attribute with full name).
  - Media date range: `formatDateRange(mediaRangeStart, mediaRangeEnd, locale)`; single date if both equal; empty-state text if no photos.
  - Item count using the existing `formatRelativeCount` helper.
  - Kebab / overflow menu with actions:
    - **Favorite / Unfavorite** (reuses existing `addFavorite`/`removeFavorite` + `ALBUM` type)
    - **Edit** — opens an edit modal (reuse or share the create modal shell) with name/description and cover picker entry point
    - **Share** — copies a link. Initially copies the owner-only album detail URL; when ALBM-BE-005 lands, switch to share-link creation
    - **Download** — triggers album archive download (wired in ALBM-FE-005 when ALBM-BE-004 lands; show disabled with tooltip until then)
    - **Delete** — confirmation dialog, calls existing delete endpoint
- Clicking the tile (not the menu) navigates to the album detail route (ALBM-FE-004).
- Drop the per-album inline photo list and inline `<select>` add-photo flow; editing/adding photos moves to the detail route.
- i18n coverage for every new string in `en` and `ru`.

## Dependencies

- ALBM-BE-001 (TASK-053.01) for cover/count/date-range fields.
- ALBM-FE-004 for the detail route target.
- Coordinates with ALBM-FE-005 for download/share wiring.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Albums view renders a responsive tile grid; old single-column card list is removed
- [ ] #2 Each tile shows cover image (or placeholder), name, media date range, and item count
- [ ] #3 Kebab menu contains Favorite, Edit, Share, Download, Delete in that order with correct disabled states
- [ ] #4 Clicking the tile body navigates to `/app/library/albums/:albumId`; clicking menu items does not navigate
- [ ] #5 Favorite toggle, Edit, and Delete continue to work against existing endpoints without regressions
- [ ] #6 Share action copies album URL to clipboard and shows a transient success message (final token-backed share wired later)
- [ ] #7 Empty states handled: no albums yet, no match for current filter, album with zero photos
- [ ] #8 Copy in `en` and `ru`; Vitest covers tile rendering, menu interactions, and navigation
<!-- AC:END -->
