---
id: TASK-025
title: FE-ADMIN-001 Admin panel shell and access gating
status: To Do
assignee:
  - codex
created_date: '2026-04-03 17:05'
labels:
  - frontend
  - admin
milestone: m-2
dependencies:
  - TASK-007.01
references:
  - MILESTONES.md
  - frontend/README.md
  - backend/docs/admin-panel-backend-requirements.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Introduce the real frontend admin entrypoint for Phase 3: protected admin routes, capability-aware navigation, loading states, and access denial behavior based on the backend instance-admin capability model.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The app exposes a real admin route tree under the authenticated shell instead of a placeholder-only contract
- [ ] #2 Only users with backend-confirmed instance-admin capability can enter admin routes; non-admin users receive a clear denial state
- [ ] #3 The admin shell provides stable navigation and shared layout for user, Space, invite, storage, health, and settings administration screens
- [ ] #4 Frontend tests cover admin-route gating, capability loading, and denial behavior
<!-- AC:END -->
