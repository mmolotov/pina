---
id: TASK-020
title: REVIEW-012 Reduce geo endpoint overfetch for map browsing payloads
status: Done
assignee: []
created_date: '2026-04-03 16:13'
updated_date: '2026-04-03 16:46'
labels:
  - backend
  - geo
  - performance
  - api
  - review
milestone: m-2
dependencies: []
documentation:
  - backend/src/main/java/dev/pina/backend/service/PhotoService.java
  - backend/src/main/java/dev/pina/backend/api/dto/PhotoDto.java
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Geo endpoints currently fetch full Photo entities with variants and EXIF payloads even though map browsing primarily needs marker-oriented fields such as id, filename, coordinates, and timestamp. This inflates query cost and response payload size for dense viewports.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Geo browsing endpoints avoid loading unnecessary variants and large EXIF payloads for marker use cases
- [x] #2 API shape for geo map browsing is explicitly documented and tested
- [x] #3 Frontend map browsing still has all fields it needs without extra follow-up requests for marker lists
<!-- AC:END -->
