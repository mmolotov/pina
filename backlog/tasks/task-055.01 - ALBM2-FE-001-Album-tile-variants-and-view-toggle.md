---
id: TASK-055.01
title: ALBM2-FE-001 Album tile variants and view toggle
status: Done
assignee: []
created_date: '2026-04-25 06:57'
updated_date: '2026-04-25 13:22'
labels:
  - frontend
  - albums
dependencies: []
parent_task_id: TASK-055
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement three album tile variants matching `pina-proto-components.jsx`:

- `AlbumTileCard` (`.atc`): rounded card with gradient/cover, badges (favorite, count), 2-col meta footer (period, snапов).
- `AlbumTileCompact` (`.atco`): square cover with bottom overlay (name, count, mini photo mosaic) — visual default.
- `AlbumTileList` (`.atl`): horizontal row with thumb, name, description, count + period right-aligned.

Add view toggle in toolbar: 3 segmented buttons using `IcoGrid`/`IcoRows` icons. Persist `tileStyle` and grid columns (2..4) in `localStorage`. Defaults: `compact` + 4 columns.

For empty-cover fallback, derive a palette index deterministically from `album.id` (hash → modulo 8) using the same gradients as the prototype.

Each tile retains the existing context menu (Edit, Share, Download, Favorite toggle, Delete).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Three tile variants render with prototype-equivalent markup, classes, and gradients
- [x] #2 View toggle switches active tile component and persists across reloads
- [x] #3 Columns selector works for compact and card layouts (2..4)
- [x] #4 Empty-cover fallback uses gradient palette derived from album.id
- [x] #5 Vitest specs cover each variant + persistence
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented in components/album-tile.tsx with three variants (Card, Compact, List) wired through `style` prop. Empty-cover gradient is selected via `getAlbumPaletteIndex(album.id)` (deterministic hash → 8 prototype palettes added to app.css). View toggle is rendered in the albums toolbar with Lucide icons (LayoutGrid, Grid2x2, Rows3). Persistence handled by `app/lib/album-view-prefs.ts` (lazy-init from localStorage). Existing context-menu actions (favorite, edit, share, download, delete) reused across all three variants. Tile tests retained by forcing `tileStyle: "card"` in `beforeEach` so legacy tile assertions still resolve.
<!-- SECTION:FINAL_SUMMARY:END -->
