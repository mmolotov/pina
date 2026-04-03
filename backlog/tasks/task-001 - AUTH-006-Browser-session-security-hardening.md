---
id: TASK-001
title: AUTH-006 Browser-session security hardening
status: Done
assignee: []
created_date: '2026-04-03 13:37'
updated_date: '2026-04-03 18:26'
labels:
  - backend
  - auth
  - security
milestone: m-2
dependencies:
  - TASK-006
references:
  - backend/README.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the browser-session model production-safe for regular web and Telegram WebApp clients.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Session cookies are not exposed to JavaScript
- [x] #2 Cross-origin browser auth works only for approved origins
- [x] #3 Expired or revoked sessions are rejected consistently
- [x] #4 Security-sensitive auth endpoints are covered by automated tests
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Requirements:
- Configure cookie flags correctly: HttpOnly, Secure, explicit SameSite
- Support credentialed CORS for allowed frontend origins only
- Add rate limiting on auth endpoints that create or refresh sessions
- Add session expiration and revocation cleanup strategy
- Add replay protection where needed for Telegram auth payloads and link tokens

Final cookie settings may differ between local development and production.
<!-- SECTION:NOTES:END -->
