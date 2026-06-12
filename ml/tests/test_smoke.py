from __future__ import annotations

import grpc
import httpx
import pytest
from grpc_health.v1 import health_pb2, health_pb2_grpc

from pina.ml.v1 import image_analysis_pb2, image_analysis_pb2_grpc
from pina_ml import __version__
from pina_ml.admin import ServiceState, create_admin_app
from pina_ml.config import Settings
from pina_ml.grpc_server import GRPC_SERVICE_NAME, create_grpc_server


def loopback_settings() -> Settings:
    return Settings(grpc_host="127.0.0.1", grpc_port=0, http_host="127.0.0.1", http_port=0)


async def test_grpc_boots_serving_and_reports_status() -> None:
    settings = loopback_settings()
    server, port = await create_grpc_server(settings)
    try:
        async with grpc.aio.insecure_channel(f"127.0.0.1:{port}") as channel:
            health_stub = health_pb2_grpc.HealthStub(channel)
            for service_name in ("", GRPC_SERVICE_NAME):
                response = await health_stub.Check(
                    health_pb2.HealthCheckRequest(service=service_name)
                )
                assert response.status == health_pb2.HealthCheckResponse.SERVING

            stub = image_analysis_pb2_grpc.ImageAnalysisStub(channel)
            status = await stub.GetServiceStatus(image_analysis_pb2.GetServiceStatusRequest())
            assert status.service_version == __version__
            assert status.active_profile == "default"
            assert status.ready is True
    finally:
        await server.stop(grace=None)


async def test_inference_rpcs_report_unimplemented_until_pipeline_lands() -> None:
    settings = loopback_settings()
    server, port = await create_grpc_server(settings)
    try:
        async with grpc.aio.insecure_channel(f"127.0.0.1:{port}") as channel:
            stub = image_analysis_pb2_grpc.ImageAnalysisStub(channel)

            with pytest.raises(grpc.aio.AioRpcError) as analyze_error:
                await stub.AnalyzeImage(image_analysis_pb2.AnalyzeImageRequest(request_id="r1"))
            assert analyze_error.value.code() == grpc.StatusCode.UNIMPLEMENTED

            with pytest.raises(grpc.aio.AioRpcError) as embed_error:
                await stub.EmbedText(image_analysis_pb2.EmbedTextRequest(text="hello"))
            assert embed_error.value.code() == grpc.StatusCode.UNIMPLEMENTED
    finally:
        await server.stop(grace=None)


async def test_admin_endpoints_report_health_readiness_and_info() -> None:
    settings = loopback_settings()
    state = ServiceState()
    app = create_admin_app(settings, state)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://admin") as client:
        assert (await client.get("/healthz")).status_code == 200

        assert (await client.get("/readyz")).status_code == 503
        state.grpc_ready = True
        assert (await client.get("/readyz")).status_code == 200

        info = (await client.get("/api/info")).json()
        assert info["service"] == "pina-ml"
        assert info["version"] == __version__
        assert info["profile"] == "default"
        assert info["execution_providers"] == ["CPUExecutionProvider"]
        assert info["grpc_port"] == 0
