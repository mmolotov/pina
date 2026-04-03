---
id: TASK-007.02
title: ADMIN-001 Admin user-management API
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
Implement stable backend admin APIs for instance-wide user management. This task covers listing, detail, and update operations needed by a future admin panel, including instance role and account-status changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Admin APIs provide paginated user listing and user detail endpoints under `/api/v1/admin/users`
- [ ] #2 Admin APIs allow updating supported user-management fields, including account active or disabled state and instance role changes
- [ ] #3 User-management responses include the documented identity, profile, provider, status, role, lifecycle, and usage summary fields required for the admin panel
- [ ] #4 Backend tests cover admin access control, filtering or query behavior where applicable, and the supported mutation flows
<!-- AC:END -->
