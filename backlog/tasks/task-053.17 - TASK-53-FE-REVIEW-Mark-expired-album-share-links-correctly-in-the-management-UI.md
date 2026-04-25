---
id: TASK-053.17
title: >-
  TASK-53-FE-REVIEW Mark expired album share links correctly in the management
  UI
status: Done
assignee: []
created_date: '2026-04-23 15:05'
updated_date: '2026-04-24 09:09'
labels:
  - frontend
  - ux
  - data-consistency
  - review
dependencies: []
references:
  - frontend/app/components/album-share-dialog.tsx
  - frontend/app/routes/app-album-detail.tsx
  - frontend/app/routes/app-library.tsx
  - backend/src/main/java/dev/pina/backend/api/dto/AlbumShareLinkDto.java
parent_task_id: TASK-053
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The album share management UI renders any non-revoked link as `active`, even when `expiresAt` is already in the past. Owners can therefore see and copy dead links that are presented as valid, which makes the share-management state inconsistent with backend token validation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Expired album share links are visually distinguished from active links in the management UI.
- [x] #2 Users are not encouraged to copy or treat expired links as active.
- [x] #3 The chosen contract between frontend and backend is covered so expired-state regressions are caught.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The share management dialog now derives an explicit expired state from `expiresAt`, renders it distinctly from active links, and disables revocation on links that are already dead.

Added a frontend regression test that opens the share dialog, verifies the expired status label, and asserts that the revoke action stays disabled for expired links.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Aligned the album share management UI with backend token validity by marking expired links as expired instead of active. Owners now see dead links clearly, the UI avoids encouraging further actions on them, and regression coverage protects the expired-state behavior.
<!-- SECTION:FINAL_SUMMARY:END -->
