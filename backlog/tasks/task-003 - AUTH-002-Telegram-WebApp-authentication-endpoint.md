---
id: TASK-003
title: AUTH-002 Telegram WebApp authentication endpoint
status: To Do
assignee: []
created_date: '2026-04-03 13:37'
updated_date: '2026-04-03 13:38'
labels:
  - backend
  - auth
  - telegram
milestone: m-4
dependencies:
  - TASK-006
references:
  - backend/README.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Allow Telegram WebApp clients to authenticate by submitting Telegram initData, validating it on the backend, and receiving the same server-managed browser session model as regular web users.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A valid Telegram initData payload logs a user in and creates a browser session
- [ ] #2 The same Telegram account cannot be linked to two different local users
- [ ] #3 Invalid or expired Telegram payloads return a controlled auth error
- [ ] #4 Existing Telegram-linked users reuse the same backend account across logins
- [ ] #5 Backend tests cover signature validation, first login, repeat login, and duplicate-link conflict
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Requirements:
- Add an endpoint such as POST /api/v1/auth/telegram/webapp
- Validate Telegram WebApp signature and expiration according to Telegram rules
- Reject replayed, malformed, expired, or invalidly signed payloads
- Find or create a local User from Telegram identity data
- Persist a unique Telegram identity binding separate from the main User row
- Store the Telegram external id as a unique value
- Cache profile fields useful for UX or audit: Telegram username, first name, last name, photo URL when present
- Issue the same cookie-backed session type used by browser flows
- Return the current user payload expected by the SPA after successful login

This task is about Telegram WebApp only, not the Telegram bot integration.
<!-- SECTION:NOTES:END -->
