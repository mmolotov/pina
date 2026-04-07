---
id: TASK-047
title: BE-AUTH Extend initial admin bootstrap for future auth providers
status: To Do
assignee: []
created_date: '2026-04-06 13:55'
labels: []
milestone: m-5
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When additional authentication providers are added beyond local username/password, the backend should support deterministic initial instance-admin bootstrap for those providers as well. The current implementation only auto-promotes the first eligible local account or a configured local username, which is acceptable now but will become an operational gap once other provider-only deployments are supported.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Initial instance-admin bootstrap works for supported non-local authentication providers introduced in the future milestone
- [ ] #2 Bootstrap rules remain deterministic and do not allow concurrent first-user self-promotion races
- [ ] #3 Backend documentation explains how initial admin assignment behaves for each supported authentication provider
<!-- AC:END -->
