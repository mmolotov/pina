---
id: TASK-023
title: REVIEW-010 Make geo nearby queries distance-aware instead of bounding-box only
status: Done
assignee: []
created_date: '2026-04-03 16:13'
updated_date: '2026-04-03 16:46'
labels:
  - backend
  - geo
  - performance
  - review
milestone: m-2
dependencies: []
documentation:
  - backend/src/main/java/dev/pina/backend/api/PhotoResource.java
  - backend/src/main/java/dev/pina/backend/service/PhotoService.java
  - backend/src/test/java/dev/pina/backend/api/PhotoGeoResourceTest.java
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The current /photos/geo/nearby endpoint expands the requested point into a bounding box and reuses the generic bounding-box query without any final distance filter or distance-based ordering. This means the endpoint can return photos outside the requested radius and does not behave like a true nearby search.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Nearby queries return only photos within the requested radius
- [x] #2 Results are ordered by actual distance or another explicitly documented nearby-specific ordering
- [x] #3 Automated tests cover edge cases such as pole-adjacent searches and radius boundaries
<!-- AC:END -->
