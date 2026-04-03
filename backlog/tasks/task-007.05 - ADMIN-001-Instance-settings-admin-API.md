---
id: TASK-007.05
title: ADMIN-001 Instance settings admin API
status: To Do
assignee:
  - codex
created_date: '2026-04-03 16:34'
updated_date: '2026-04-03 16:34'
labels:
  - backend
  - admin
milestone: m-2
dependencies:
  - TASK-007.01
documentation:
  - backend/docs/admin-panel-backend-requirements.md
parent_task_id: TASK-007
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement stable backend admin APIs for reading and updating instance-level settings used by the future admin panel. This slice is limited to the non-ML settings documented for Phase 3.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Admin APIs provide read and update endpoints for instance settings under `/api/v1/admin/settings`
- [ ] #2 The supported settings cover the documented Phase 3 non-ML configuration fields
- [ ] #3 Validation and persistence rules prevent invalid admin-setting updates from being accepted silently
- [ ] #4 Backend tests cover admin access control plus successful and failing update scenarios
<!-- AC:END -->
