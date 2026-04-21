---
id: TASK-048
title: Split Docker Compose into base and production ingress override
status: To Do
assignee: []
created_date: '2026-04-13 06:30'
labels:
  - infra
  - deployment
dependencies: []
references:
  - /Users/mama/dev/femi/infrastructure/docker-compose.prod.yml
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Mirror the compose-layer refactor used in femi so local container usage does not require shared ingress assumptions while production deployment still uses a dedicated override for the `edge` network and Caddy labels.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Project services can be started from a base compose file without requiring the external edge network or Caddy labels.
- [ ] #2 Production deployment still works through a separate override that adds the shared ingress network and Caddy labels.
- [ ] #3 README and deployment guidance are updated to describe the new base-plus-prod compose workflow.
<!-- AC:END -->
