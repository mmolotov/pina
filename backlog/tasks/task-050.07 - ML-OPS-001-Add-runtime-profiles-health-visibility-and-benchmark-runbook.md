---
id: TASK-050.07
title: 'ML-OPS-001 Add runtime profiles, health visibility, and benchmark runbook'
status: To Do
assignee: []
created_date: '2026-04-20 13:56'
updated_date: '2026-04-20 13:56'
labels:
  - ml
  - ops
  - performance
milestone: m-3
dependencies:
  - TASK-050.02
  - TASK-050.03
  - TASK-050.04
  - TASK-050.05
references:
  - >-
    https://onnxruntime.ai/docs/execution-providers/OpenVINO-ExecutionProvider.html
  - >-
    https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html
  - >-
    /Users/mama/dev/pina/backlog/tasks/task-049 -
    ML-PLAN-001-Define-Phase-4-ML-service-delivery-plan.md
documentation:
  - README.md
  - ml/README.md
  - backend/README.md
  - docs/product-requirements.adoc
parent_task_id: TASK-050
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Document and operationalize the Phase 4 ML service so self-hosters can understand runtime profiles, health state, and weak-hardware tradeoffs. This task covers the supporting operational layer around the ML service rather than the core inference logic itself.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Compose and developer-facing docs explain the supported runtime profiles, provider selection, cache behavior, and expected weak-hardware tradeoffs
- [ ] #2 The service or admin-facing health surface exposes enough information to understand whether the ML runtime is reachable, which profile is active, and whether required models are available
- [ ] #3 A reproducible smoke path validates local boot plus at least one backend↔ML inference round-trip in the configured stack
- [ ] #4 A small benchmark or sizing matrix is recorded for CPU-only operation so the `cpu-lite` profile has evidence-based concurrency and throughput guidance
<!-- AC:END -->
