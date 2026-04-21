---
id: TASK-050.03
title: ML-MODEL-001 Implement model registry and runtime profiles
status: To Do
assignee: []
created_date: '2026-04-20 13:55'
updated_date: '2026-04-20 13:56'
labels:
  - ml
  - models
  - ops
milestone: m-3
dependencies:
  - TASK-050.02
references:
  - >-
    https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html
  - >-
    https://onnxruntime.ai/docs/execution-providers/OpenVINO-ExecutionProvider.html
  - 'https://github.com/deepinsight/insightface'
  - 'https://github.com/mlfoundations/open_clip'
  - >-
    /Users/mama/dev/pina/backlog/tasks/task-049 -
    ML-PLAN-001-Define-Phase-4-ML-service-delivery-plan.md
documentation:
  - MILESTONES.md
  - docs/product-requirements.adoc
  - ml/README.md
parent_task_id: TASK-050
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the model-registry layer for Phase 4 so the ML service can resolve, download, validate, and activate models through manifests instead of hardcoded runtime choices. The registry should support both the default installation profile and a lighter `cpu-lite` profile for weaker self-hosted hardware.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 YAML manifests describe each model with task type, version, source URL, license metadata, input or output expectations, and runtime requirements
- [ ] #2 The ML service can download configured models on first use or startup, store them in a persistent cache, and avoid repeated downloads when artifacts already exist
- [ ] #3 At least `default` and `cpu-lite` runtime profiles are defined with different step or model selections and hardware-friendly concurrency expectations
- [ ] #4 License metadata is surfaced clearly enough to block or flag non-compliant default model choices for redistribution
<!-- AC:END -->
