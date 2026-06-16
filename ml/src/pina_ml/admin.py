from __future__ import annotations

from dataclasses import dataclass

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from pina_ml import __version__
from pina_ml.config import Settings
from pina_ml.registry import ModelRegistry


@dataclass
class ServiceState:
    """Mutable runtime state shared between the entrypoint and the admin app."""

    grpc_ready: bool = False


def create_admin_app(settings: Settings, state: ServiceState, registry: ModelRegistry) -> FastAPI:
    app = FastAPI(title="PINA ML admin", version=__version__)

    @app.get("/healthz")
    async def healthz() -> dict[str, str]:
        return {"status": "up"}

    @app.get("/readyz")
    async def readyz() -> JSONResponse:
        if not state.grpc_ready:
            return JSONResponse(status_code=503, content={"status": "starting"})
        return JSONResponse(content={"status": "ready"})

    @app.get("/api/info")
    async def info() -> dict[str, object]:
        return {
            "service": "pina-ml",
            "version": __version__,
            "profile": registry.profile.name,
            "models_ready": registry.ready,
            "max_parallel_analyses": registry.profile.max_parallel_analyses,
            "execution_providers": settings.execution_providers,
            "model_cache_dir": str(settings.model_cache_dir),
            "grpc_port": settings.grpc_port,
        }

    @app.get("/api/models")
    async def models() -> list[dict[str, object]]:
        return [
            {
                "id": entry.manifest.id,
                "version": entry.manifest.version,
                "step": entry.step.value,
                "runtime": entry.manifest.runtime,
                "available": entry.available,
                "license": {
                    "spdx": entry.manifest.license.spdx,
                    "url": entry.manifest.license.url,
                    "commercial_use": entry.manifest.license.commercial_use,
                    "allow_bundling": entry.manifest.license.allow_bundling,
                    "notes": entry.manifest.license.notes,
                },
            }
            for entry in registry.availability()
        ]

    return app
