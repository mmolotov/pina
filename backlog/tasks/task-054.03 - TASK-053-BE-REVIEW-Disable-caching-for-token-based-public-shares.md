---
id: TASK-054.03
title: TASK-053-BE-REVIEW Disable caching for token-based public shares
status: Done
assignee: []
created_date: '2026-04-23 12:12'
updated_date: '2026-04-23 12:17'
labels:
  - backend
  - security
  - review
dependencies: []
references:
  - backend/src/main/java/dev/pina/backend/api/PublicAlbumResource.java
  - backend/src/test/java/dev/pina/backend/api/AlbumShareLinkResourceTest.java
parent_task_id: TASK-054
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ensure token-authenticated public album metadata and file endpoints are not stored by browsers or intermediary caches so share revocation and expiry remain effective immediately.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Public album metadata responses include headers that prevent caching.
- [x] #2 Public photo file responses include headers that prevent caching.
- [x] #3 Backend tests verify the no-store caching behavior on token-based public endpoints.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added Cache-Control: no-store to token-based public album metadata and file responses so browser and intermediary caches do not outlive link revocation or expiry.

Covered the cache policy in public share integration tests for both metadata and file delivery endpoints.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Disabled caching for token-based public album metadata and file responses by emitting Cache-Control: no-store on successful share-link reads. The integration tests now verify that both anonymous metadata and file proxy responses are marked non-cacheable.
<!-- SECTION:FINAL_SUMMARY:END -->
