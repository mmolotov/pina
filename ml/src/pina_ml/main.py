from __future__ import annotations

import asyncio
import logging

import uvicorn

from pina_ml.admin import ServiceState, create_admin_app
from pina_ml.config import Settings
from pina_ml.grpc_server import create_grpc_server

LOG = logging.getLogger(__name__)


async def run(settings: Settings) -> None:
    state = ServiceState()
    grpc_server, grpc_port = await create_grpc_server(settings)
    state.grpc_ready = True
    LOG.info("gRPC server listening on %s:%d", settings.grpc_host, grpc_port)

    app = create_admin_app(settings, state)
    http_config = uvicorn.Config(
        app, host=settings.http_host, port=settings.http_port, log_level=settings.log_level.lower()
    )
    http_server = uvicorn.Server(http_config)
    try:
        # serve() installs SIGINT/SIGTERM handlers and returns on shutdown.
        await http_server.serve()
    finally:
        state.grpc_ready = False
        await grpc_server.stop(grace=5)
        await grpc_server.wait_for_termination()


def main() -> None:
    settings = Settings()
    logging.basicConfig(
        level=settings.log_level.upper(), format="%(asctime)s %(levelname)s %(name)s %(message)s"
    )
    asyncio.run(run(settings))


if __name__ == "__main__":
    main()
