---
id: TASK-010
title: FE-GEO-003 Map clustering and geo browse polish
status: To Do
assignee: []
created_date: '2026-04-03 16:47'
labels:
  - frontend
  - geo
  - map
  - ux
milestone: m-2
dependencies:
  - TASK-009
references:
  - frontend/README.md
  - backend/README.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add grouped map rendering for dense photo areas and polish the geo browsing experience so map exploration remains usable at different zoom levels.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Dense sets of nearby photo markers are rendered as map clusters instead of overlapping single markers
- [ ] #2 Cluster interaction supports zooming in and progressively revealing underlying photos
- [ ] #3 The map UI communicates the number of photos represented by each cluster
- [ ] #4 List/detail interaction remains coherent when users move between clustered map browsing and individual photo views
- [ ] #5 Frontend tests cover cluster rendering behavior or the derived clustering integration points
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Requirements:
- Prefer client-side clustering over adding new backend aggregation endpoints in this slice
- Keep clustering behavior understandable on both desktop and mobile
- Avoid hiding all photo context behind clusters; users should still be able to reach individual assets with a reasonable number of interactions
- Polish supporting UX around selection, zoom transitions, and map/list continuity only after the base map view is stable

This task completes the frontend geo-search browsing slice with map grouping for real libraries that have many nearby photos.
<!-- SECTION:NOTES:END -->
