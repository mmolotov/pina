---
id: TASK-006
title: AUTH-001 Cookie-backed browser session foundation
status: Done
assignee: []
created_date: '2026-04-03 13:37'
updated_date: '2026-04-03 18:26'
labels:
  - backend
  - auth
  - session
milestone: m-2
dependencies: []
references:
  - backend/README.md
  - docs/adr.adoc
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a server-managed browser session model so regular web clients and Telegram WebApp can use httpOnly cookies instead of storing long-lived refresh tokens in frontend-controlled storage.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Username/password login can create an httpOnly session cookie
- [x] #2 GET /api/v1/auth/me works when authenticated only by the session cookie
- [x] #3 Logout revokes the active session and the cookie can no longer access protected endpoints
- [x] #4 Mutating browser requests are protected against CSRF
- [x] #5 Backend tests cover successful session auth, logout, session revocation, and CSRF rejection
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Requirements:
- Introduce a persistent session entity or table with at least session id, user id, session type (WEB, TELEGRAM_WEBAPP), created at, expires at, revoked at, and optional metadata such as user agent and IP hash
- Add cookie-based session issuance for browser-capable login flows
- Keep existing user, roles, and authorization rules unchanged
- Provide logout for the current session and backend support for revocation
- Keep auth/resource code independent from the transport by resolving a unified authenticated principal
- Add CSRF protection for mutating requests that rely on cookies
- Keep bearer-token support available for non-browser clients during the transition

This is the foundation for Telegram WebApp auth and frontend token-storage hardening.
<!-- SECTION:NOTES:END -->
