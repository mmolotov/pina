---
id: TASK-007.01
title: ADMIN-001 Instance admin authorization and capability exposure
status: To Do
assignee:
  - codex
created_date: '2026-04-03 16:34'
labels:
  - backend
  - admin
milestone: m-2
dependencies: []
documentation:
  - backend/docs/admin-panel-backend-requirements.md
parent_task_id: TASK-007
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Introduce the backend authorization foundation for instance-level administration so a later admin panel can reliably gate access independently of Space membership. This task covers only the authorization model and exposure of the current user's instance-admin capability; management endpoints stay in follow-up subtasks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An instance-level admin role or equivalent permission exists independently from Space membership roles
- [ ] #2 Authorized admin-only backend checks can be applied consistently to future `/api/v1/admin/**` endpoints
- [ ] #3 The authenticated-user response or a dedicated capability endpoint exposes whether the current user has instance-admin access
- [ ] #4 Backend tests cover positive and negative authorization cases, including proof that Space admin membership alone does not grant instance-admin access
<!-- AC:END -->
