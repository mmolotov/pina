from __future__ import annotations

import asyncio
import logging

import uvicorn

from pina_ml.admin import ServiceState, create_admin_app
from pina_ml.config import Settings
from pina_ml.grpc_server import create_grpc_server
from pina_ml.registry import ModelRegistry

LOG = logging.getLogger(__name__)


async def run(settings: Settings) -> None:
    registry = ModelRegistry.load(settings)
    for warning in registry.license_warnings():
        LOG.warning("%s", warning)

    state = ServiceState()
    grpc_server, grpc_port = await create_grpc_server(settings, registry)
    state.grpc_ready = True
    LOG.info(
        "gRPC server listening on %s:%d (profile %s)",
        settings.grpc_host,
        grpc_port,
        registry.profile.name,
    )

    download_task: asyncio.Task[None] | None = None
    if settings.download_models_on_startup:
        download_task = asyncio.create_task(_download_models(registry))

    app = create_admin_app(settings, state, registry)
    http_config = uvicorn.Config(
        app, host=settings.http_host, port=settings.http_port, log_level=settings.log_level.lower()
    )
    http_server = uvicorn.Server(http_config)
    try:
        # serve() installs SIGINT/SIGTERM handlers and returns on shutdown.
        await http_server.serve()
    finally:
        state.grpc_ready = False
        if download_task is not None and not download_task.done():
            download_task.cancel()
        await grpc_server.stop(grace=5)
        await grpc_server.wait_for_termination()


async def _download_models(registry: ModelRegistry) -> None:
    try:
        await registry.ensure_all()
        LOG.info("All models for profile %s are available", registry.profile.name)
    except asyncio.CancelledError:
        raise
    except Exception:
        LOG.exception("Model download failed; the service stays up and retries on next start")


def main() -> None:
    settings = Settings()
    logging.basicConfig(
        level=settings.log_level.upper(), format="%(asctime)s %(levelname)s %(name)s %(message)s"
    )
    asyncio.run(run(settings))


if __name__ == "__main__":
    main()
