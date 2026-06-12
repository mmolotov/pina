# PINA ML service

Python service for photo analysis: a gRPC server for backend inference traffic
plus a FastAPI admin/health surface. Phase 4 scope and sequencing live in
[MILESTONES.md](../MILESTONES.md); the shared contract lives in
[proto/](../proto/README.md).

Current state: runnable scaffold. `GetServiceStatus`, gRPC health, and the
admin endpoints are live; `AnalyzeImage` / `EmbedText` respond `UNIMPLEMENTED`
until the model registry and pipeline land (TASK-050.03 / TASK-050.04).

## Layout

```
pyproject.toml        # uv-managed project (Python >= 3.12)
src/pina_ml/          # service code: config, gRPC server, FastAPI admin, entrypoint
src/pina/             # GENERATED gRPC modules (git-ignored, `make proto`)
tests/                # pytest suite (asyncio smoke + config tests)
Makefile              # proto / lint / format / test / run / clean
```

## Requirements

- [uv](https://docs.astral.sh/uv/) (manages Python and dependencies)
- `make`

## Commands

```bash
make proto    # generate pina.ml.v1 modules from ../proto (required once before test/run)
make test     # proto + pytest
make lint     # ruff check + format check
make format   # ruff auto-format + autofix
make run      # proto + start the service
```

## Configuration

Every setting is an environment variable with the `PINA_ML_` prefix; no code
edits needed. Lists use JSON syntax.

| Variable                      | Default                    | Purpose                                   |
|-------------------------------|----------------------------|-------------------------------------------|
| `PINA_ML_GRPC_HOST` / `_PORT` | `0.0.0.0` / `50051`        | gRPC bind address (backend traffic)        |
| `PINA_ML_HTTP_HOST` / `_PORT` | `0.0.0.0` / `8000`         | FastAPI admin bind address                 |
| `PINA_ML_MODEL_CACHE_DIR`     | `models` (`/models` in Docker) | Persistent model artifact cache        |
| `PINA_ML_PROFILE`             | `default`                  | Runtime profile: `default` or `cpu-lite`   |
| `PINA_ML_EXECUTION_PROVIDERS` | `["CPUExecutionProvider"]` | ONNX Runtime execution provider order      |
| `PINA_ML_LOG_LEVEL`           | `INFO`                     | Logging level                              |

## Endpoints

- gRPC `pina.ml.v1.ImageAnalysis` — `AnalyzeImage`, `EmbedText`,
  `GetServiceStatus` (see [proto/README.md](../proto/README.md))
- gRPC `grpc.health.v1.Health` — standard health protocol, reports `SERVING`
- HTTP `GET /healthz` — liveness
- HTTP `GET /readyz` — readiness (503 until the gRPC server is up)
- HTTP `GET /api/info` — version, active profile, providers, cache dir
- HTTP `GET /docs` — FastAPI OpenAPI UI

## Docker

The compose stack builds and runs the service with a persistent model-cache
volume:

```bash
docker compose -f docker/docker-compose.yml up --build ml
```
