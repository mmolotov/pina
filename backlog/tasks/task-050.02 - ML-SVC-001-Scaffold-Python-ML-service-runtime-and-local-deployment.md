---
id: TASK-050.02
title: ML-SVC-001 Scaffold Python ML service runtime and local deployment
status: In Progress
assignee:
  - '@claude'
created_date: '2026-04-20 13:55'
updated_date: '2026-06-11 17:30'
labels:
  - ml
  - python
  - ops
milestone: m-3
dependencies:
  - TASK-050.01
references:
  - >-
    backlog/tasks/task-049 -
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Project layout: `ml/` as a uv-managed Python 3.12 project (pyproject.toml + uv.lock, src layout). Runtime deps: grpcio, grpcio-health-checking, protobuf, fastapi, uvicorn, pydantic-settings. Dev deps: pytest, pytest-asyncio, httpx, grpcio-tools, ruff. Heavy inference deps (onnxruntime etc.) intentionally deferred to TASK-050.03/04.
2. Configuration (`pina_ml.config`, pydantic-settings, env prefix `PINA_ML_`): grpc host/port, http host/port, model_cache_dir, profile (`default` | `cpu-lite`), execution_providers list, log level — covers AC#3 without code edits.
3. Servers: grpc.aio server registering ImageAnalysis servicer (AnalyzeImage/EmbedText return UNIMPLEMENTED until TASK-050.04; GetServiceStatus returns version + active profile + ready state) plus standard grpc.health.v1 service; FastAPI admin app with /healthz, /readyz, /api/info; single asyncio entrypoint `pina_ml.main` runs both with graceful shutdown.
4. Codegen wiring: ml/Makefile target `proto` invokes ../proto/scripts/generate-python.sh into ml/src (generated `pina/ml/v1` namespace package, gitignored); conftest fails with a clear "run make proto" message when stubs are missing.
5. Docker/Compose: docker/Dockerfile.ml (uv-based multi-stage, generates proto during build), compose service `ml` with persistent model-cache volume, /healthz healthcheck, env-driven config.
6. Tests + CI: pytest smoke test boots both servers in-process on ephemeral ports and asserts HTTP /healthz + gRPC health SERVING + GetServiceStatus payload; new .github/workflows/ml.yml runs ruff + proto generation + pytest on ml/** and proto/** changes.
7. Docs: rewrite ml/README.md (stale "Phase 3" placeholder) with layout, config reference, run/test commands; update ml/CHANGELOG.md and docker/CHANGELOG.md.
Validation: `make proto && uv run pytest` green locally; `docker compose -f docker/docker-compose.yml up --build ml` reports healthy.
<!-- SECTION:PLAN:END -->
