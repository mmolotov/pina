---
id: TASK-053.11
title: >-
  TASK-053-FE-REVIEW Prevent create-album submit during upload and include
  uploaded photos reliably
status: Done
assignee: []
created_date: '2026-04-23 13:39'
labels:
  - frontend
  - review
dependencies: []
parent_task_id: TASK-053
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Review finding: the create-album modal currently allows submit while uploads are still in flight. Newly uploaded photos are only merged into local state after the upload loop completes, so creating the album during upload can produce an album without the freshly uploaded files while still leaving those files in the library.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Create-album submit is disabled while modal uploads are in progress
- [x] #2 Freshly uploaded photos are deterministically included in the album create flow without timing races
- [x] #3 User feedback clearly distinguishes upload progress from album creation progress
- [x] #4 Vitest covers the race-prone path and prevents regression
<!-- AC:END -->
