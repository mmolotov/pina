---
id: TASK-022
title: REVIEW-013 Reassess browser-session metadata trust and optional binding checks
status: Done
assignee: []
created_date: '2026-04-03 16:13'
updated_date: '2026-04-03 16:46'
labels:
  - backend
  - auth
  - security
  - review
milestone: m-2
dependencies: []
documentation:
  - backend/src/main/java/dev/pina/backend/api/AuthResource.java
  - backend/src/main/java/dev/pina/backend/service/BrowserSessionService.java
  - >-
    backend/src/main/java/dev/pina/backend/service/BrowserSessionAuthenticationMechanism.java
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Browser sessions store hashed user-agent and IP metadata, but authentication does not validate either signal and session issuance currently records the raw X-Forwarded-For header value from the request. This weakens the value of the metadata for audit and leaves room for misleading session provenance data.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Session metadata collection uses a trustworthy client address source
- [x] #2 The intended purpose of stored IP and user-agent hashes is documented and reflected in tests
- [x] #3 If session binding checks are intentionally omitted, the decision and trade-offs are recorded explicitly
<!-- AC:END -->
