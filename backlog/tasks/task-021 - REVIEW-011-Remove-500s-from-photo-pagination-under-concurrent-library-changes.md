---
id: TASK-021
title: REVIEW-011 Remove 500s from photo pagination under concurrent library changes
status: Done
assignee: []
created_date: '2026-04-03 16:13'
updated_date: '2026-04-03 16:46'
labels:
  - backend
  - photos
  - reliability
  - review
milestone: m-2
dependencies: []
documentation:
  - backend/src/main/java/dev/pina/backend/service/PhotoService.java
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Photo list and geo list pagination currently fetch page IDs first and entities second, then throw IllegalStateException if the result set changes in between. Under concurrent upload or delete activity this can surface as user-visible 500 responses instead of a resilient page result.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Photo listing endpoints remain valid under concurrent upload/delete activity
- [x] #2 Pagination no longer throws IllegalStateException when rows change between page ID selection and entity fetch
- [x] #3 Automated tests cover concurrent or simulated mid-page mutations
<!-- AC:END -->
