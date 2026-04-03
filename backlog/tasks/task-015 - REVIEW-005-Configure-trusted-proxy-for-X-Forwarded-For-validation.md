---
id: TASK-015
title: REVIEW-005 Configure trusted proxy for X-Forwarded-For validation
status: Done
assignee: []
created_date: '2026-04-03 15:31'
updated_date: '2026-04-03 15:45'
labels:
  - backend
  - security
milestone: m-2
dependencies: []
references:
  - backend/src/main/java/dev/pina/backend/api/AuthRateLimitFilter.java
  - backend/src/main/resources/application.properties
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
AuthRateLimitFilter trusts X-Forwarded-For header directly from the request. Without a reverse proxy or trusted-proxy configuration, clients can spoof this header and bypass rate limiting. Configure `quarkus.http.proxy.proxy-address-forwarding` and `quarkus.http.proxy.trusted-proxies` for production.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Quarkus proxy trust configured for production profile
- [x] #2 Rate limiter uses validated remote address in production
- [x] #3 Documentation updated with reverse proxy requirements
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Configured `quarkus.http.proxy.proxy-address-forwarding` and `trusted-proxies` for prod profile via `PINA_TRUSTED_PROXIES` env var. Removed manual X-Forwarded-For parsing from AuthRateLimitFilter — now relies on Quarkus-validated Vert.x remote address. Added reverse proxy section to README.
<!-- SECTION:FINAL_SUMMARY:END -->
