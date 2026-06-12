from __future__ import annotations

import logging

import grpc
from grpc_health.v1 import health, health_pb2, health_pb2_grpc

from pina.ml.v1 import image_analysis_pb2, image_analysis_pb2_grpc
from pina_ml import __version__
from pina_ml.config import Settings

LOG = logging.getLogger(__name__)

GRPC_SERVICE_NAME = "pina.ml.v1.ImageAnalysis"


class ImageAnalysisService(image_analysis_pb2_grpc.ImageAnalysisServicer):
    """Scaffold servicer.

    GetServiceStatus is live; the inference RPCs respond UNIMPLEMENTED until
    the model registry (TASK-050.03) and pipeline (TASK-050.04) land.
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def AnalyzeImage(self, request, context):
        await context.abort(
            grpc.StatusCode.UNIMPLEMENTED, "Photo analysis pipeline is not implemented yet"
        )

    async def EmbedText(self, request, context):
        await context.abort(grpc.StatusCode.UNIMPLEMENTED, "Text embedding is not implemented yet")

    async def GetServiceStatus(self, request, context):
        # No registry yet: the scaffold requires no models, so it reports ready.
        return image_analysis_pb2.GetServiceStatusResponse(
            service_version=__version__,
            active_profile=self._settings.profile.value,
            ready=True,
        )


async def create_grpc_server(settings: Settings) -> tuple[grpc.aio.Server, int]:
    """Start the gRPC server and mark it SERVING; returns (server, bound port)."""
    server = grpc.aio.server()
    image_analysis_pb2_grpc.add_ImageAnalysisServicer_to_server(
        ImageAnalysisService(settings), server
    )
    health_servicer = health.aio.HealthServicer()
    health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)
    port = server.add_insecure_port(f"{settings.grpc_host}:{settings.grpc_port}")
    await server.start()
    for service_name in ("", GRPC_SERVICE_NAME):
        await health_servicer.set(service_name, health_pb2.HealthCheckResponse.SERVING)
    return server, port
