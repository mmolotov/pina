---
id: TASK-054.04
title: TASK-053-BE-REVIEW Make public variant parsing locale-safe
status: Done
assignee:
  - codex
created_date: '2026-04-23 12:12'
updated_date: '2026-04-23 12:32'
labels:
  - backend
  - review
dependencies: []
references:
  - backend/src/main/java/dev/pina/backend/api/PublicAlbumResource.java
  - backend/src/main/java/dev/pina/backend/api/AlbumResource.java
  - backend/src/test/java/dev/pina/backend/api/AlbumShareLinkResourceTest.java
parent_task_id: TASK-054
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make anonymous public photo variant parsing independent of the JVM default locale so valid requests behave consistently across deployments.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Public photo file downloads accept valid variant values regardless of the JVM default locale.
- [x] #2 The parsing logic is aligned with authenticated album download behavior.
- [x] #3 Backend tests cover locale-sensitive variant parsing.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Compare public variant parsing with the authenticated album download implementation.
2. Switch the public endpoint to locale-safe normalization using Locale.ROOT or shared parsing logic.
3. Add a regression test that demonstrates valid variant parsing under a locale-sensitive JVM locale.
4. Verify the related backend tests and record the result in the task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Aligned public share variant parsing with locale-safe uppercasing via Locale.ROOT.

Added an integration regression test that exercises variant parsing under the Turkish default locale.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made public album file variant parsing locale-safe by normalizing the query parameter with Locale.ROOT before resolving VariantType. Added a regression test that proves valid lowercase variant values continue to work under a Turkish JVM locale.
<!-- SECTION:FINAL_SUMMARY:END -->
