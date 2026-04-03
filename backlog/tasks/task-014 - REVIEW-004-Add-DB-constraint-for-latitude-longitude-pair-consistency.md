---
id: TASK-014
title: REVIEW-004 Add DB constraint for latitude/longitude pair consistency
status: Done
assignee: []
created_date: '2026-04-03 15:31'
updated_date: '2026-04-03 15:39'
labels:
  - backend
  - data-integrity
milestone: m-2
dependencies: []
references:
  - backend/src/main/java/dev/pina/backend/domain/Photo.java
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Photo entity allows latitude without longitude (or vice versa). There is no DB-level or JPA-level validation that both geo fields are either both null or both set. Add a CHECK constraint in the migration and optionally a @PrePersist validation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CHECK constraint ensures (latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL)
- [x] #2 Attempting to persist a photo with only one geo field fails
- [x] #3 Existing tests still pass
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
CHECK constraint `chk_photo_geo_pair` added in V03__photo_geo_columns.sql as part of REVIEW-003. Ensures latitude and longitude are always both null or both set at the DB level.
<!-- SECTION:FINAL_SUMMARY:END -->
