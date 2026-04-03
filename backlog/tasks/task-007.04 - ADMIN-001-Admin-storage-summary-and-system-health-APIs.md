---
id: TASK-007.04
title: ADMIN-001 Admin storage summary and system health APIs
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
Implement stable backend admin APIs for storage reporting and system-health visibility required by a real admin console. This task covers richer storage monitoring and admin-level health reporting, without ML-specific health details.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Admin APIs provide storage summary plus paginated per-user and per-Space storage reporting endpoints under `/api/v1/admin/storage`
- [ ] #2 Storage responses include the documented aggregate and breakdown metrics required for the admin panel
- [ ] #3 An admin-only system health endpoint exists at `/api/v1/admin/health` and returns the documented backend, database, storage, and build-status information
- [ ] #4 Backend tests cover admin access control and verify the expected response shape for storage and health endpoints
<!-- AC:END -->
