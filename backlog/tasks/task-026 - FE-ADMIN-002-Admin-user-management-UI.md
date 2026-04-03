---
id: TASK-026
title: FE-ADMIN-002 Admin user-management UI
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
  - TASK-007.02
references:
  - MILESTONES.md
  - frontend/README.md
  - backend/docs/admin-panel-backend-requirements.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the Phase 3 admin UI for instance-wide user management on top of the backend admin user APIs. This includes user listing, detail inspection, and supported administrative mutations.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Admin users can browse paginated user lists and inspect user details from the frontend
- [ ] #2 The UI exposes the supported account-status and instance-role mutations provided by the backend
- [ ] #3 Mutations revalidate the affected admin views and surface clear success and error feedback
- [ ] #4 Frontend tests cover list rendering, mutation flows, and denied or failed request states
<!-- AC:END -->
