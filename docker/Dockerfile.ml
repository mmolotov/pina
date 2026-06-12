# PINA ML service image. Build context is the repository root:
#   docker build -f docker/Dockerfile.ml .

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS build
ENV UV_LINK_MODE=copy UV_COMPILE_BYTECODE=1
WORKDIR /app/ml
COPY ml/pyproject.toml ml/uv.lock ./
RUN uv sync --frozen --no-install-project
COPY ml/src ./src
COPY proto /app/proto
RUN uv run --no-sync bash /app/proto/scripts/generate-python.sh src

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim
ENV UV_LINK_MODE=copy UV_COMPILE_BYTECODE=1
WORKDIR /app/ml
COPY ml/pyproject.toml ml/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY ml/README.md ./
COPY --from=build /app/ml/src ./src
RUN uv sync --frozen --no-dev \
    && useradd --create-home --uid 10001 pina \
    && mkdir -p /models \
    && chown -R pina:pina /models /app/ml
USER pina
ENV PINA_ML_MODEL_CACHE_DIR=/models
EXPOSE 8000 50051
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD ["uv", "run", "--no-sync", "python", "-c", "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=3).status == 200 else 1)"]
CMD ["uv", "run", "--no-sync", "pina-ml"]
