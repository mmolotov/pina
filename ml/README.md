# PINA ML service

Python service for photo analysis: a gRPC server for backend inference traffic
plus a FastAPI admin/health surface. Phase 4 scope and sequencing live in
[MILESTONES.md](../MILESTONES.md); the shared contract lives in
[proto/](../proto/README.md).

Current state: the full photo-analysis pipeline is live. `AnalyzeImage` runs
the profile-enabled steps (CLIP image embedding, zero-shot tagging, SCRFD face
detection, ArcFace descriptors), `EmbedText` embeds queries into the CLIP
space, and `GetServiceStatus` reports per-model availability.

## Layout

```
pyproject.toml          # uv-managed project (Python >= 3.12)
src/pina_ml/            # service code: config, gRPC server, FastAPI admin, entrypoint
src/pina_ml/registry/   # model manifests schema, artifact cache/downloads, registry
src/pina_ml/manifests/  # packaged model manifests + runtime profiles (YAML)
src/pina_ml/pipeline/   # analysis pipeline: CLIP, faces (SCRFD/ArcFace), orchestrator
src/pina/               # GENERATED gRPC modules (git-ignored, `make proto`)
scripts/                # real_model_smoke.py — one-shot real-model verification
tests/                  # pytest suite (offline; tiny ONNX fixture models)
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
| `PINA_ML_TAG_TOP_K`           | `8`                        | Max auto-tags per photo                    |
| `PINA_ML_TAG_MIN_CONFIDENCE`  | `0.05`                     | Min softmax probability for a tag          |
| `PINA_ML_FACE_MIN_CONFIDENCE` | `0.5`                      | Min detector score for a face              |
| `PINA_ML_TAGS_VOCABULARY_PATH`| packaged list              | Override zero-shot tag vocabulary file     |

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

## Analysis pipeline

`AnalyzeImage` decodes the supplied derived variant (never an original),
downscales to the profile's `analysis_max_resolution`, and runs the enabled
steps in order:

1. **image_embedding** — CLIP vision encoder → L2-normalized embedding.
2. **tagging** — zero-shot scoring of the image embedding against the packaged
   tag vocabulary (`pipeline/data/tag_vocabulary.txt`, prompt "a photo of …");
   reuses the embedding from step 1.
3. **face_detection** — SCRFD at 640px letterbox, NMS, normalized boxes.
4. **face_embedding** — 5-point alignment to the 112×112 ArcFace template,
   L2-normalized 512-d descriptors for later clustering.

Every step reports its own status (`COMPLETED`, `FAILED`, `SKIPPED_DISABLED`,
`SKIPPED_UNAVAILABLE`), model provenance, and duration — one broken model
never fails the RPC. Models load lazily and download on first use if the
startup prefetch is disabled. Concurrency is capped by the profile's
`max_parallel_analyses`.

To verify real models end to end (downloads the active profile's artifacts):

```bash
PINA_ML_PROFILE=cpu-lite uv run python scripts/real_model_smoke.py <image>
```

## Operations

### Health and status surfaces

- gRPC `grpc.health.v1.Health` — liveness for infra probes (`SERVING`).
- gRPC `ImageAnalysis.GetServiceStatus` — active profile, readiness, per-model
  availability (what the backend admin health consumes).
- HTTP `/healthz`, `/readyz` — container/compose probes.
- HTTP `/api/info`, `/api/models` — version, profile, limits, model licenses
  and availability.
- Backend `GET /api/v1/admin/health` mirrors this as an `ml` block for admins.

### Cache and providers

Model artifacts live in `PINA_ML_MODEL_CACHE_DIR` (compose: the `mlmodels`
volume) and are downloaded once per id+version; deleting the volume forces a
re-download. Execution providers are selected via
`PINA_ML_EXECUTION_PROVIDERS` in priority order with automatic
`CPUExecutionProvider` fallback; on Intel hardware the ONNX Runtime OpenVINO
execution provider is the first acceleration option to evaluate (requires an
onnxruntime build that ships it).

### Stack smoke (boot + backend↔ML round-trip)

```bash
PINA_ML_PROFILE=cpu-lite docker/smoke-ml.sh        # add --down to clean up
```

Boots postgres + ml + backend, registers a user, uploads a photo through the
API, and waits until the asynchronous analysis lands in `photo_analysis_jobs`
/ `photo_tags` / `photo_embeddings`. First run downloads the profile's models
into the `mlmodels` volume.

### CPU-only sizing (benchmark)

```bash
PINA_ML_PROFILE=cpu-lite uv run python scripts/benchmark.py <image> [iterations]
```

Measured on an Apple Silicon laptop CPU (10 iterations, 1280×800 input, no
faces in frame; one warmup pass excluded — cold start adds ~0.6–1.7 s for
session loads plus vocabulary embedding):

| Profile    | image_embedding | face_detection | total / photo | serial throughput |
|------------|-----------------|----------------|---------------|-------------------|
| `cpu-lite` | 14 ms           | 19 ms          | ~44 ms        | ~22 photos/s      |
| `default`  | 33 ms           | 99 ms          | ~138 ms       | ~7 photos/s       |

Tagging is a sub-millisecond matmul once the vocabulary is embedded; each
detected face adds one ArcFace pass (w600k_mbf is several times cheaper than
w600k_r50). Face detection dominates the default profile, so `cpu-lite`
(det_500m + int8 CLIP) is the right choice for weak or busy CPUs — roughly 3×
the throughput at reduced accuracy. Expect low-power x86 SBCs to be several
times slower than these numbers; keep `max_parallel_analyses` at 1 there (the
profile defaults already do) and let the backend queue absorb bursts.

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
