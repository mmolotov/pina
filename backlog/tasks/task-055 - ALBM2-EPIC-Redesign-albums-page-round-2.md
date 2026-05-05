---
id: TASK-055
title: ALBM2-EPIC Redesign albums page (round 2)
status: Done
assignee: []
created_date: '2026-04-25 06:57'
updated_date: '2026-04-25 13:23'
labels:
  - frontend
  - albums
  - design
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the Pina Albums Prototype handoff (`design/pina-handoff.zip`) on the albums list and album detail screens.

Source of truth: `design/pina-handoff/pina/project/Pina Albums Prototype.html` and `pina-proto-components.jsx`.

**Goal:** match the prototype's visual design, layout, tokens and interaction surface for the albums list and detail screens. No backend changes required — `AlbumDto` already exposes everything needed; `paletteIdx` becomes a deterministic derivation from `album.id` for empty-cover fallback.

**Defaults from `TWEAK_DEFAULTS`:**
- Tile style: `compact`
- Grid columns: 4
- Hero style: `banner`
- Photo grid columns: 4

**Scope split into children:** ALBM2-FE-001 (tiles + view toggle), ALBM2-FE-002 (hero variants + columns), ALBM2-FE-003 (header/toolbar copy).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Albums list visually matches prototype for compact (default), card, and list tile variants
- [x] #2 Tile style and column count are persisted across reloads via localStorage
- [x] #3 Album detail hero supports split and banner variants (banner default), with photo grid columns control
- [x] #4 Empty-cover fallback uses prototype palette derived from album.id
- [x] #5 All existing album tests still pass; new tests cover tile variants and persistence
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the Pina Albums Prototype handoff on the albums list and album detail screens.

**Core changes:**
- New `app/components/album-tile.tsx` exports a single `AlbumTile` switching between Card / Compact / List variants based on `style` prop. Compact is the default per TWEAK_DEFAULTS.
- New `app/lib/album-view-prefs.ts` provides a `useAlbumViewPrefs` hook with localStorage persistence (lazy-init for SSR-safe first render). Stores `tileStyle`, `columns` (2..4), `heroStyle`, `photoColumns` (2..4).
- `app/routes/app-library.tsx`: replaced sticky toolbar (only for albums view) with prototype layout — title + N albums · M photos subtitle, + Create album CTA, scope tabs, sort, filter input, tile-style segmented toggle, columns slider. Album grid uses dynamic `repeat(columns, 1fr)`. Empty state matches prototype panel.
- `app/routes/app-album-detail.tsx`: replaced PageHeader-based hero with prototype's `split` and `banner` hero variants (banner default). Inline switcher in the back-button row. Photo grid converted to `repeat(photoColumns, 1fr)` with adjustable columns control above the grid. Kept ProportionalTimelineRail for the per-day rail.
- `app/app.css`: added prototype CSS classes (.atc, .atco, .atl, .atc-* / .atco-* / .atl-*, .album-ctx-menu, .scope-tabs, .photo-swatch, .photo-swatch-N, .album-palette-N, .btn-glass, .hero-banner-* tokens, .nil, .dialog-*).
- `app/lib/i18n.tsx`: added new strings (tileStyle.*, columnsLabel, heroStyleLabel, heroStyle.*, photoColumnsLabel, noAlbumsMatchHint).

**No backend changes were needed.** All required data (cover, count, mediaRange, ownerId, favorited) was already exposed in `AlbumDto`. The decorative paletteIdx is derived deterministically from `album.id`.

**Verification:** `npm run build` passes (format, lint, stylelint, design-system color guard, typecheck, vite build). Full vitest suite green: 39 files / 138 tests. Existing legacy tile tests preserved by forcing `tileStyle: "card"` in the test `beforeEach`.
<!-- SECTION:FINAL_SUMMARY:END -->
