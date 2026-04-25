---
id: TASK-055.02
title: ALBM2-FE-002 Album detail hero variants and photo grid columns
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
Refactor album detail hero into two variants from prototype:

- `split`: panel with cover on left, meta + actions on right.
- `banner`: full-bleed cover with gradient overlay, glass action buttons + favorite toggle.

Banner is default. Add inline switcher in detail page toolbar (`split` / `banner` segmented control). Persist `heroStyle` and `photoColumns` (2..4) in localStorage.

Photo grid: keep existing day grouping + timeline rail (`ProportionalTimelineRail`), but apply the prototype's `repeat({cols},1fr)` grid and `.photo-swatch` styling. Photo columns default to 4.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Album detail hero renders both split and banner variants matching prototype
- [x] #2 Hero variant + photo columns persist across reloads
- [x] #3 Photo grid uses configurable columns (2..4) without breaking timeline rail
- [x] #4 Existing tests for album detail keep passing or are updated to new markup
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Refactored `routes/app-album-detail.tsx` to render two prototype hero variants: `split` (left cover panel + right meta+actions) and `banner` (full-bleed cover with gradient overlay, glass action buttons + favorite toggle). Banner is the default (per TWEAK_DEFAULTS). A segmented switcher lives in the back-button row. Photo grid columns control (range 2..4) renders above the photo grid; both `heroStyle` and `photoColumns` persist in localStorage via `useAlbumViewPrefs`. `ProportionalTimelineRail` retained. Glass overlay tokens moved into app.css (.hero-banner-overlay, .hero-banner-eyebrow, .hero-banner-stat-label, .hero-banner-favorite-active, .hero-text-on-image, .hero-text-muted-on-image) to satisfy the design-system color guard.
<!-- SECTION:FINAL_SUMMARY:END -->
