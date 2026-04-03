---
id: TASK-005
title: AUTH-005 Unified principal resolution for cookie and bearer auth
status: Done
assignee: []
created_date: '2026-04-03 13:37'
updated_date: '2026-04-03 18:26'
labels:
  - backend
  - auth
milestone: m-2
dependencies:
  - TASK-006
references:
  - docs/adr.adoc
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make backend authorization independent from whether authentication came from a browser session, Telegram WebApp, or a bearer token.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Protected endpoints behave the same for equivalent authenticated users regardless of auth method
- [x] #2 Existing authorization rules do not need per-endpoint branching by client type
- [x] #3 Tests cover the same protected route under both session and bearer auth
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Requirements:
- Extend the auth layer so resources and services can resolve the current principal from either session cookie or bearer token
- Preserve the same UserResolver-level semantics for ownership and Space access
- Expose auth context details needed for audit and rollout: auth method, session id or token id when available, and client type when known

This task reduces coupling and makes future auth changes safer.
<!-- SECTION:NOTES:END -->
