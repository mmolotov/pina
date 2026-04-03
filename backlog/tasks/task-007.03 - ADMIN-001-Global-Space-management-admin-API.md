---
id: TASK-007.03
title: ADMIN-001 Global Space-management admin API
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
Implement stable backend admin APIs for instance-wide Space oversight. This task covers listing, detail, and delete operations for Spaces visible to instance administrators, separate from member-scoped Space APIs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Admin APIs provide paginated Space listing and Space detail endpoints under `/api/v1/admin/spaces`
- [ ] #2 Admin APIs support deleting a Space through an instance-admin-only endpoint
- [ ] #3 Space-management responses include the documented structural and usage fields required for the admin panel
- [ ] #4 Backend tests cover admin access control, supported query filters where applicable, and destructive flow behavior
<!-- AC:END -->
