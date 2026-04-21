---
id: TASK-050.02
title: ML-SVC-001 Scaffold Python ML service runtime and local deployment
status: To Do
assignee: []
created_date: '2026-04-20 13:55'
updated_date: '2026-04-20 13:56'
labels:
  - ml
  - python
  - ops
milestone: m-3
dependencies:
  - TASK-050.01
references:
  - >-
    /Users/mama/dev/pina/backlog/tasks/task-049 -
    ML-PLAN-001-Define-Phase-4-ML-service-delivery-plan.md
documentation:
  - README.md
  - ml/README.md
  - docs/adr.adoc
  - docs/product-requirements.adoc
parent_task_id: TASK-050
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the first runnable ML service in `ml/` as a Python application with FastAPI for admin or health endpoints and a gRPC server for backend inference traffic. The task should establish project structure, configuration, Docker integration, and a clean boot path for local development and compose-based deployments.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `ml/` contains a runnable Python service layout with FastAPI admin or health endpoints and a gRPC server started from shared configuration
- [ ] #2 The local stack includes Docker or Compose wiring for the ML service, persistent model-cache storage, and health or readiness checks
- [ ] #3 Runtime configuration covers cache paths, network ports, execution-provider selection, and deployable profile selection without code edits
- [ ] #4 A smoke test or startup validation path proves the service can boot locally and report healthy state before model-specific pipeline work lands
<!-- AC:END -->
