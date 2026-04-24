---
id: TASK-053.15
title: >-
  TASK-53-FE-REVIEW Replace full-library album detail loaders with bounded
  fetches
status: Done
assignee: []
created_date: '2026-04-23 15:05'
updated_date: '2026-04-24 09:04'
labels:
  - frontend
  - performance
  - review
dependencies:
  - TASK-053.26
references:
  - frontend/app/routes/app-album-detail.tsx
  - frontend/app/routes/app-album-photo-detail.tsx
  - frontend/app/lib/api.ts
parent_task_id: TASK-053
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The new personal album detail and album photo detail routes currently fetch the entire album list and, for the main detail screen, the entire personal photo library just to render a single album context. On medium and large libraries this creates unnecessary network fan-out, client memory churn, and slower navigation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Navigating to `/app/library/albums/:albumId` no longer requires downloading the full album list or the full personal photo library.
- [x] #2 Navigating to `/app/library/albums/:albumId/photos/:photoId` no longer requires downloading the full album list.
- [x] #3 The replacement data flow is bounded to the current album context and remains covered by route tests.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Switched both personal album context routes from `listAlbums()` to the new targeted `getAlbum()` API call.

Replaced the album-detail route's full-library `listAllPhotos()` fetch with a bounded first-page personal photo request for the existing-photo picker, and surfaced a UI notice when the picker is intentionally limited for performance.

Updated the route tests to assert the new loader contract and verified the change with `npm run typecheck` plus focused Vitest runs for the album detail routes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Reworked the personal album context loaders to use bounded fetches instead of scanning the user's full album list and full photo library. Album detail and album photo routes now resolve the current album directly, the existing-photo picker loads only a capped first page, and the route tests cover the new behavior.
<!-- SECTION:FINAL_SUMMARY:END -->
