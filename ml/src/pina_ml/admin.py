from __future__ import annotations

from dataclasses import dataclass

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from pina_ml import __version__
from pina_ml.config import Settings


@dataclass
class ServiceState:
    """Mutable runtime state shared between the entrypoint and the admin app."""

    grpc_ready: bool = False


def create_admin_app(settings: Settings, state: ServiceState) -> FastAPI:
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
            "profile": settings.profile.value,
            "execution_providers": settings.execution_providers,
            "model_cache_dir": str(settings.model_cache_dir),
            "grpc_port": settings.grpc_port,
        }

    return app
