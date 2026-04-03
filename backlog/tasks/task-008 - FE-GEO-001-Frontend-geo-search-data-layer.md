---
id: TASK-008
title: FE-GEO-001 Frontend geo search data layer
status: To Do
assignee: []
created_date: '2026-04-03 16:47'
labels:
  - frontend
  - geo
  - map
milestone: m-2
dependencies: []
references:
  - frontend/README.md
  - backend/README.md
  - backend/docs/plan-geo-search.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add frontend API support and route-level state for personal photo geo search so the UI can query photos by bounding box and by nearby point.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Frontend API client supports `/api/v1/photos/geo` and `/api/v1/photos/geo/nearby`
- [ ] #2 Shared frontend photo types include nullable `latitude` and `longitude`
- [ ] #3 Route state can store map viewport query parameters and restore them from the URL
- [ ] #4 Frontend tests cover API parsing, query serialization, and invalid response handling
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Requirements:
- Extend the existing frontend API layer instead of introducing a duplicate photo client
- Keep geo search scoped to the authenticated user's personal library
- Model bounding box params explicitly: `swLat`, `swLng`, `neLat`, `neLng`, `page`, `size`, `needsTotal`
- Keep nearby search support available for later UX even if the first UI slice is viewport-driven
- Make URL state stable enough to support refresh, back/forward, and deep links into a map view

This task is the frontend foundation for the geo map slice and should land before map rendering work.
<!-- SECTION:NOTES:END -->
