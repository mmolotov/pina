---
id: TASK-027
title: FE-ADMIN-003 Admin Space and invite oversight UI
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
  - TASK-007.03
  - TASK-007.06
references:
  - MILESTONES.md
  - frontend/README.md
  - backend/docs/admin-panel-backend-requirements.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the Phase 3 admin UI for instance-wide oversight of Spaces and invites. This covers browsing, inspecting, and applying the supported global moderation or management actions exposed by backend admin APIs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Admin users can browse and inspect Spaces across the whole instance from a dedicated admin UI
- [ ] #2 Admin users can inspect invite inventory and apply the supported invite oversight actions from the frontend
- [ ] #3 The UI clearly separates global admin actions from ordinary Space membership flows so existing Space screens remain user-focused
- [ ] #4 Frontend tests cover list and detail rendering, supported admin actions, and error handling
<!-- AC:END -->
