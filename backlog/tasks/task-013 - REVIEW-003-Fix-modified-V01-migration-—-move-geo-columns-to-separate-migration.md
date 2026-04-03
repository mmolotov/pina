---
id: TASK-013
title: REVIEW-003 Fix modified V01 migration — move geo columns to separate migration
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
  - backend/src/main/resources/db/migration/V01__core_schema.sql
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Photo geo columns (latitude, longitude) and index were added directly to V01__core_schema.sql. Flyway checks checksums — if V01 was already applied in any environment, migration will fail. Move geo columns to a dedicated V03 migration file.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 V01__core_schema.sql restored to original checksum
- [x] #2 New V03__photo_geo_columns.sql adds latitude, longitude, and partial index
- [x] #3 Flyway migration passes cleanly on fresh and existing databases
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Restored V01__core_schema.sql to original checksum (verified via `diff`). Created V03__photo_geo_columns.sql with ALTER TABLE for latitude/longitude, CHECK constraint for pair consistency (also covers REVIEW-004), and partial geo index. All tests pass.
<!-- SECTION:FINAL_SUMMARY:END -->
