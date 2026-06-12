from __future__ import annotations

import logging

import grpc
from grpc_health.v1 import health, health_pb2, health_pb2_grpc

from pina.ml.v1 import common_pb2, image_analysis_pb2, image_analysis_pb2_grpc
from pina_ml import __version__
from pina_ml.config import Settings
from pina_ml.registry import ModelRegistry

LOG = logging.getLogger(__name__)

GRPC_SERVICE_NAME = "pina.ml.v1.ImageAnalysis"


class ImageAnalysisService(image_analysis_pb2_grpc.ImageAnalysisServicer):
    """Service backed by the model registry.

    GetServiceStatus reports real per-model availability; the inference RPCs
    respond UNIMPLEMENTED until the pipeline lands (TASK-050.04).
    """

    def __init__(self, settings: Settings, registry: ModelRegistry) -> None:
        self._settings = settings
        self._registry = registry

    async def AnalyzeImage(self, request, context):
        await context.abort(
            grpc.StatusCode.UNIMPLEMENTED, "Photo analysis pipeline is not implemented yet"
        )

    async def EmbedText(self, request, context):
        await context.abort(grpc.StatusCode.UNIMPLEMENTED, "Text embedding is not implemented yet")

    async def GetServiceStatus(self, request, context):
        availability = self._registry.availability()
        return image_analysis_pb2.GetServiceStatusResponse(
            service_version=__version__,
            active_profile=self._registry.profile.name,
            ready=all(entry.available for entry in availability),
            models=[
                image_analysis_pb2.ModelAvailability(
                    model=common_pb2.ModelRef(
                        model_id=entry.manifest.id,
                        version=entry.manifest.version,
                        runtime=entry.manifest.runtime,
                    ),
                    step=common_pb2.AnalysisStep.Value(entry.step.name),
                    available=entry.available,
                )
                for entry in availability
            ],
        )


async def create_grpc_server(
    settings: Settings, registry: ModelRegistry
) -> tuple[grpc.aio.Server, int]:
    """Start the gRPC server and mark it SERVING; returns (server, bound port)."""
    server = grpc.aio.server()
    image_analysis_pb2_grpc.add_ImageAnalysisServicer_to_server(
        ImageAnalysisService(settings, registry), server
    )
    health_servicer = health.aio.HealthServicer()
    health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)
    port = server.add_insecure_port(f"{settings.grpc_host}:{settings.grpc_port}")
    await server.start()
    for service_name in ("", GRPC_SERVICE_NAME):
        await health_servicer.set(service_name, health_pb2.HealthCheckResponse.SERVING)
    return server, port
