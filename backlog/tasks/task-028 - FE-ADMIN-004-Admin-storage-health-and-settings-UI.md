---
id: TASK-028
title: FE-ADMIN-004 Admin storage, health, and settings UI
status: To Do
assignee:
  - codex
created_date: '2026-04-03 17:05'
labels:
  - frontend
  - admin
milestone: m-2
dependencies:
  - TASK-025
  - TASK-007.04
  - TASK-007.05
references:
  - MILESTONES.md
  - frontend/README.md
  - backend/docs/admin-panel-backend-requirements.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the operational Phase 3 admin screens for instance storage summary, system health, and mutable instance settings. This task turns the future admin panel into a practical operations surface rather than a user-management-only tool.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The admin UI shows backend-provided storage summary and health information in a usable operational layout
- [ ] #2 Supported instance settings can be viewed and updated from the admin panel with clear validation and feedback
- [ ] #3 Health and storage states expose empty, degraded, and failure scenarios without breaking the admin shell
- [ ] #4 Frontend tests cover settings mutation flows plus storage and health rendering states
<!-- AC:END -->
