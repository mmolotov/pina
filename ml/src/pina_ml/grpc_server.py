from __future__ import annotations

import logging

import grpc
from grpc_health.v1 import health, health_pb2, health_pb2_grpc

from pina.ml.v1 import common_pb2, image_analysis_pb2, image_analysis_pb2_grpc
from pina_ml import __version__
from pina_ml.config import Settings
from pina_ml.pipeline import ImageDecodeError, PhotoAnalysisPipeline
from pina_ml.registry import ModelManifest, ModelRegistry, PipelineStep, RegistryError

LOG = logging.getLogger(__name__)

GRPC_SERVICE_NAME = "pina.ml.v1.ImageAnalysis"


class ImageAnalysisService(image_analysis_pb2_grpc.ImageAnalysisServicer):
    """Image analysis service backed by the registry-driven pipeline."""

    def __init__(
        self, settings: Settings, registry: ModelRegistry, pipeline: PhotoAnalysisPipeline
    ) -> None:
        self._settings = settings
        self._registry = registry
        self._pipeline = pipeline

    async def AnalyzeImage(self, request, context):
        requested = [
            PipelineStep[common_pb2.AnalysisStep.Name(step)]
            for step in request.steps
            if step != common_pb2.ANALYSIS_STEP_UNSPECIFIED
        ]
        try:
            result = await self._pipeline.analyze(request.image.data, requested)
        except ImageDecodeError as error:
            await context.abort(grpc.StatusCode.INVALID_ARGUMENT, str(error))

        response = image_analysis_pb2.AnalyzeImageResponse(request_id=request.request_id)
        for outcome in result.outcomes:
            step_result = response.step_results.add()
            step_result.step = common_pb2.AnalysisStep.Value(outcome.step.name)
            step_result.status = common_pb2.StepStatus.Value(outcome.state.value)
            step_result.duration_ms = outcome.duration_ms
            if outcome.manifest is not None:
                step_result.model.CopyFrom(_model_ref(outcome.manifest))
            if outcome.error:
                step_result.error_message = outcome.error
        if result.image_embedding is not None:
            response.image_embedding.values.extend(result.image_embedding)
        for tag in result.tags:
            response.tags.add(label=tag.label, confidence=tag.confidence)
        for face in result.faces:
            face_message = response.faces.add()
            face_message.box.x = face.x
            face_message.box.y = face.y
            face_message.box.width = face.width
            face_message.box.height = face.height
            face_message.confidence = face.confidence
            if face.embedding is not None:
                face_message.embedding.values.extend(face.embedding)
        return response

    async def EmbedText(self, request, context):
        if not request.text.strip():
            await context.abort(grpc.StatusCode.INVALID_ARGUMENT, "text must not be blank")
        try:
            values, manifest = await self._pipeline.embed_text(request.text)
        except RegistryError as error:
            await context.abort(grpc.StatusCode.FAILED_PRECONDITION, str(error))
        return image_analysis_pb2.EmbedTextResponse(
            embedding=common_pb2.Embedding(values=values), model=_model_ref(manifest)
        )

    async def GetServiceStatus(self, request, context):
        availability = self._registry.availability()
        return image_analysis_pb2.GetServiceStatusResponse(
            service_version=__version__,
            active_profile=self._registry.profile.name,
            ready=all(entry.available for entry in availability),
            models=[
                image_analysis_pb2.ModelAvailability(
                    model=_model_ref(entry.manifest),
                    step=common_pb2.AnalysisStep.Value(entry.step.name),
                    available=entry.available,
                )
                for entry in availability
            ],
        )


def _model_ref(manifest: ModelManifest) -> common_pb2.ModelRef:
    return common_pb2.ModelRef(
        model_id=manifest.id, version=manifest.version, runtime=manifest.runtime
    )


async def create_grpc_server(
    settings: Settings, registry: ModelRegistry
) -> tuple[grpc.aio.Server, int]:
    """Start the gRPC server and mark it SERVING; returns (server, bound port)."""
    pipeline = PhotoAnalysisPipeline(settings, registry)
    server = grpc.aio.server()
    image_analysis_pb2_grpc.add_ImageAnalysisServicer_to_server(
        ImageAnalysisService(settings, registry, pipeline), server
    )
    health_servicer = health.aio.HealthServicer()
    health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)
    port = server.add_insecure_port(f"{settings.grpc_host}:{settings.grpc_port}")
    await server.start()
    for service_name in ("", GRPC_SERVICE_NAME):
        await health_servicer.set(service_name, health_pb2.HealthCheckResponse.SERVING)
    return server, port
