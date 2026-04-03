---
id: TASK-007.06
title: ADMIN-001 Global invite-oversight admin API
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
Implement stable backend admin APIs for instance-wide invite oversight needed by the future admin panel. This task covers global listing and revocation of invite links beyond Space-scoped member APIs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Admin APIs provide paginated invite listing under `/api/v1/admin/invites` with the documented filtering support
- [ ] #2 Admin APIs allow revoking an invite through an instance-admin-only endpoint
- [ ] #3 Invite responses include the documented invite metadata required for admin oversight
- [ ] #4 Backend tests cover admin access control, supported filtering behavior where applicable, and invite revocation flows
<!-- AC:END -->
