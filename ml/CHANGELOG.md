# Changelog — ML Service

All notable changes to the PINA ML service module will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Runnable service scaffold: grpc.aio server for `pina.ml.v1.ImageAnalysis`
  (status RPC live, inference RPCs `UNIMPLEMENTED` until the pipeline lands)
  with standard `grpc.health.v1` health, plus a FastAPI admin surface
  (`/healthz`, `/readyz`, `/api/info`).
- Env-driven configuration (`PINA_ML_*`): ports, model cache dir, runtime
  profile (`default` / `cpu-lite`), execution providers, log level.
- uv-managed project layout with Makefile (proto/lint/format/test/run),
  pytest smoke suite, and ML CI workflow.
- Docker image (`docker/Dockerfile.ml`) and compose service with persistent
  model-cache volume and healthcheck.
