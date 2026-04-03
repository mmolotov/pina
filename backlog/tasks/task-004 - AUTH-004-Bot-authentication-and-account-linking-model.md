---
id: TASK-004
title: AUTH-004 Bot authentication and account-linking model
status: To Do
assignee: []
created_date: '2026-04-03 13:37'
labels:
  - backend
  - auth
  - telegram
  - bot
milestone: m-4
dependencies: []
references:
  - backend/docs/admin-panel-backend-requirements.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Support Telegram bot integration without forcing the bot into browser-style cookie auth.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The bot can authenticate without browser cookies
- [ ] #2 The backend can distinguish bot requests from browser/WebApp requests
- [ ] #3 User-level bot actions require an explicit link or impersonation rule
- [ ] #4 Audit records identify bot-driven actions correctly
- [ ] #5 Tests cover credential validation, missing-link rejection, and scope enforcement
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Requirements:
- Choose and implement one of the allowed backend models: preferred service credential; acceptable scoped API tokens for bot flows
- Do not reuse browser session cookies for bot access
- Add a link flow between Telegram bot identity and local user identity when the bot needs to act on behalf of a user
- Support deep-link or short-lived link-token based account linking
- Record bot-to-user bindings separately from browser sessions
- Support scoped permissions for bot credentials
- Ensure every bot-triggered action is auditable: which bot credential was used and whether it acted as itself or on behalf of a user

This task should not introduce ML-specific bot capabilities.
<!-- SECTION:NOTES:END -->
