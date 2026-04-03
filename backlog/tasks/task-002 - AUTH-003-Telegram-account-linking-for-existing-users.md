---
id: TASK-002
title: AUTH-003 Telegram account linking for existing users
status: To Do
assignee: []
created_date: '2026-04-03 13:37'
updated_date: '2026-04-03 14:28'
labels:
  - backend
  - auth
  - telegram
milestone: m-4
dependencies:
  - TASK-003
references:
  - backend/README.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Let an already authenticated local user link a Telegram identity to an existing account instead of always creating a new one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An existing authenticated user can link a Telegram account once
- [ ] #2 Attempting to link an already bound Telegram account returns a controlled conflict
- [ ] #3 Unlink rules are explicit and tested
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Requirements:
- Add an authenticated account-link flow for Telegram identity binding
- Prevent one Telegram identity from being linked to multiple users
- Prevent one user from linking multiple Telegram identities unless the product explicitly decides to support it
- Support conflict-aware unlink or relink rules
- Audit linking and unlinking actions

Linking rules should stay consistent with the existing LinkedAccount model.
<!-- SECTION:NOTES:END -->
