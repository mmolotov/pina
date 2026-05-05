---
id: TASK-053.16
title: TASK-53-BE-REVIEW Remove internal album ID header from public file proxy
status: Done
assignee: []
created_date: '2026-04-23 15:05'
updated_date: '2026-04-24 08:55'
labels:
  - backend
  - security
  - privacy
  - review
dependencies: []
references:
  - backend/src/main/java/dev/pina/backend/api/PublicAlbumResource.java
parent_task_id: TASK-053
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`GET /api/v1/public/albums/by-token/{token}/photos/{photoId}/file` currently adds `X-Album-Id` to anonymous share responses. The header leaks the internal album UUID to anyone holding the share token even though the value is not required to stream the file.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Anonymous public file responses no longer expose internal album identifiers in response headers.
- [x] #2 Public share file streaming behavior remains unchanged for valid and revoked tokens.
- [x] #3 Backend tests cover the absence of the internal header on successful public file responses.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed the unnecessary `X-Album-Id` header from anonymous public file responses in `PublicAlbumResource`.

Strengthened the public file proxy integration test to assert that successful token-based file responses do not expose the internal album UUID.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed the internal album identifier leak from the anonymous public file proxy by dropping the `X-Album-Id` response header. Existing public file behavior stayed intact, and backend regression coverage now verifies that the header is absent.
<!-- SECTION:FINAL_SUMMARY:END -->
