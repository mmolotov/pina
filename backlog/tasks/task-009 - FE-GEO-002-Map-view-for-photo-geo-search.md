---
id: TASK-009
title: FE-GEO-002 Map view for photo geo search
status: To Do
assignee: []
created_date: '2026-04-03 16:47'
labels:
  - frontend
  - geo
  - map
milestone: m-2
dependencies:
  - TASK-008
references:
  - frontend/README.md
  - backend/README.md
  - backend/docs/plan-geo-search.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a frontend map view that loads the user's geo-tagged photos for the current viewport and renders them as interactive map markers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Users can switch to a dedicated map-based photo browsing view in the frontend
- [ ] #2 The map requests photo data for the current viewport using the backend bounding-box endpoint
- [ ] #3 Marker selection opens a photo preview or detail navigation for the selected asset
- [ ] #4 Loading, empty, and error states are presented clearly for the map experience
- [ ] #5 Frontend tests cover viewport-driven data loading and marker interaction
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Requirements:
- Reuse the existing frontend visual language; avoid introducing an isolated prototype route
- Choose a map library that works cleanly with the current React/Vite stack and is testable enough for route-level coverage
- Keep viewport fetches debounced or transition-friendly so pans/zooms do not spam requests
- Preserve the current list/timeline experience; the map should be an additional browsing mode, not a destructive replacement
- Make the selected-photo interaction compatible with existing photo detail routes when possible

This task should stop short of marker clustering; clustering is tracked separately so the base map UX can be reviewed on its own.
<!-- SECTION:NOTES:END -->
