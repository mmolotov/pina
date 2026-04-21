---
id: TASK-050.04
title: ML-PIPE-001 Implement photo analysis pipeline v1
status: To Do
assignee: []
created_date: '2026-04-20 13:55'
updated_date: '2026-04-20 13:56'
labels:
  - ml
  - pipeline
  - photos
milestone: m-3
dependencies:
  - TASK-050.01
  - TASK-050.02
  - TASK-050.03
references:
  - 'https://github.com/mlfoundations/open_clip'
  - 'https://github.com/deepinsight/insightface'
  - >-
    /Users/mama/dev/pina/backlog/tasks/task-049 -
    ML-PLAN-001-Define-Phase-4-ML-service-delivery-plan.md
documentation:
  - MILESTONES.md
  - docs/product-requirements.adoc
  - ml/README.md
  - backend/README.md
parent_task_id: TASK-050
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the first usable Phase 4 photo-analysis pipeline in the ML service. The initial pipeline should stay photo-only and focus on the outputs that unblock semantic retrieval and face-driven organization: image embeddings, auto-tags, face detections, and face descriptors suitable for later clustering.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 For a photo input, the pipeline can produce image embeddings, auto-tags, face detections, and face descriptors through configured processing steps
- [ ] #2 The pipeline consumes a derived photo variant suitable for analysis so Phase 4 does not depend on retaining original files
- [ ] #3 Pipeline responses include enough provenance to identify which model and version produced each result set
- [ ] #4 Failure of one enabled step is handled explicitly so a single model issue does not crash the whole analysis flow or force upload-path failure
<!-- AC:END -->
