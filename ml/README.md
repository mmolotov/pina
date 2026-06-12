# PINA ML service

Python service for photo analysis: a gRPC server for backend inference traffic
plus a FastAPI admin/health surface. Phase 4 scope and sequencing live in
[MILESTONES.md](../MILESTONES.md); the shared contract lives in
[proto/](../proto/README.md).

Current state: runnable service with a model registry. `GetServiceStatus`,
gRPC health, the admin endpoints, manifests, profiles, and model downloads are
live; `AnalyzeImage` / `EmbedText` respond `UNIMPLEMENTED` until the pipeline
lands (TASK-050.04).

## Layout

```
pyproject.toml          # uv-managed project (Python >= 3.12)
src/pina_ml/            # service code: config, gRPC server, FastAPI admin, entrypoint
src/pina_ml/registry/   # model manifests schema, artifact cache/downloads, registry
src/pina_ml/manifests/  # packaged model manifests + runtime profiles (YAML)
src/pina/               # GENERATED gRPC modules (git-ignored, `make proto`)
tests/                  # pytest suite (offline: smoke, config, registry, downloads)
Makefile                # proto / lint / format / test / run / clean
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
| `PINA_ML_MANIFESTS_DIR`       | unset                      | Extra dir with override model manifests    |
| `PINA_ML_DOWNLOAD_MODELS_ON_STARTUP` | `true`             | Fetch profile models in the background at boot |
| `PINA_ML_PROFILE`             | `default`                  | Runtime profile: `default` or `cpu-lite`   |
| `PINA_ML_EXECUTION_PROVIDERS` | `["CPUExecutionProvider"]` | ONNX Runtime execution provider order      |
| `PINA_ML_LOG_LEVEL`           | `INFO`                     | Logging level                              |

## Model registry and profiles

Models are described by YAML manifests in `src/pina_ml/manifests/models/`
(id, version, pipeline step, runtime, license metadata, downloadable files
with optional zip-archive members and sha256). Runtime profiles in
`.../manifests/profiles/` map each pipeline step to a model and set
hardware-friendly limits:

| Profile    | Embedding / tagging                 | Faces (detect / embed)            | Limits                      | Approx. download |
|------------|-------------------------------------|-----------------------------------|-----------------------------|------------------|
| `default`  | CLIP ViT-B/32 ONNX (fp32)           | SCRFD det_10g / ArcFace w600k_r50 | 2 parallel, 1280px analysis | ~850 MB          |
| `cpu-lite` | CLIP ViT-B/32 ONNX (int8 quantized) | SCRFD det_500m / ArcFace w600k_mbf| 1 parallel, 960px analysis  | ~270 MB          |

Artifacts are downloaded on startup (or first use) into the persistent cache
(`models/<id>/<version>/…`; shared source archives under `archives/`) and are
never re-downloaded while present. Operators can add or override manifests via
`PINA_ML_MANIFESTS_DIR`; `GET /api/models` shows what the active profile
resolved.

## Model licensing

License metadata is part of every manifest and surfaced via `/api/models` and
startup warnings. The CLIP ONNX exports are MIT. The InsightFace packs
(SCRFD/ArcFace) are **non-commercial research licenses**: PINA downloads them
at runtime onto the operator's own instance, never redistributes them, and
they must not be baked into distributable images (`allow_bundling: false`).
Operators needing commercially licensed face models can point
`PINA_ML_MANIFESTS_DIR` at manifests for their own ONNX packs.

## Endpoints

- gRPC `pina.ml.v1.ImageAnalysis` — `AnalyzeImage`, `EmbedText`,
  `GetServiceStatus` (see [proto/README.md](../proto/README.md))
- gRPC `grpc.health.v1.Health` — standard health protocol, reports `SERVING`
- HTTP `GET /healthz` — liveness
- HTTP `GET /readyz` — readiness (503 until the gRPC server is up)
- HTTP `GET /api/info` — version, active profile, model readiness, providers
- HTTP `GET /api/models` — resolved models with license and availability
- HTTP `GET /docs` — FastAPI OpenAPI UI

## Docker

The compose stack builds and runs the service with a persistent model-cache
volume:

```bash
docker compose -f docker/docker-compose.yml up --build ml
```
