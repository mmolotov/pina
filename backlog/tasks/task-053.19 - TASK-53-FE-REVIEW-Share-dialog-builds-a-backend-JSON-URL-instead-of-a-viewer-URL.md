---
id: TASK-053.19
title: >-
  TASK-53-FE-REVIEW Share dialog builds a backend JSON URL instead of a viewer
  URL
status: Done
assignee: []
created_date: '2026-04-24 05:30'
updated_date: '2026-04-24 09:09'
labels:
  - frontend
  - ux
  - bug
  - review
dependencies: []
references:
  - frontend/app/components/album-share-dialog.tsx
  - frontend/app/routes.ts
  - backend/src/main/java/dev/pina/backend/api/PublicAlbumResource.java
parent_task_id: TASK-053
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`AlbumShareDialog.buildPublicAlbumShareUrl` produces `/api/v1/public/albums/by-token/{token}`, which is the backend JSON endpoint. Owners copy that URL from the "Public endpoint" section and hand it to recipients, but anonymous recipients only see raw JSON because the frontend has no public album viewer route. The share flow as shipped does not actually show a viewable album to the recipient.

Acceptance Criteria:
- [x] The link copied from the share dialog opens a frontend viewer that renders the shared album (or a documented intermediate flow that does not expose raw JSON).
- [x] The viewer works for anonymous recipients and handles expired/revoked tokens gracefully.
- [x] UI or route-level test coverage protects the share URL contract against regressions.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The share dialog now builds frontend viewer links under `/s/album/:token`, and the route table includes a dedicated anonymous public album viewer.

Added route-level test coverage for the public viewer plus a share-dialog regression assertion that copied links target the viewer route instead of the backend JSON endpoint.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed the public album share flow by routing copied links to an anonymous frontend viewer instead of the raw backend JSON endpoint. Shared recipients now land on a browsable album page, and the FE test suite covers both the link contract and the public viewer behavior.
<!-- SECTION:FINAL_SUMMARY:END -->
