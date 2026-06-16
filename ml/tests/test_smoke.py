from __future__ import annotations

from pathlib import Path

import grpc
import httpx
from grpc_health.v1 import health_pb2, health_pb2_grpc

from manifest_fixtures import build_local_manifests
from pina.ml.v1 import image_analysis_pb2, image_analysis_pb2_grpc
from pina_ml import __version__
from pina_ml.admin import ServiceState, create_admin_app
from pina_ml.config import Settings
from pina_ml.grpc_server import GRPC_SERVICE_NAME, create_grpc_server
from pina_ml.registry import ModelRegistry


def loopback_settings(tmp_path: Path, manifests_dir: Path | None = None) -> Settings:
    return Settings(
        grpc_host="127.0.0.1",
        grpc_port=0,
        http_host="127.0.0.1",
        http_port=0,
        model_cache_dir=tmp_path / "cache",
        manifests_dir=manifests_dir,
    )


async def test_grpc_boots_serving_and_reports_packaged_models(tmp_path: Path) -> None:
    settings = loopback_settings(tmp_path)
    registry = ModelRegistry.load(settings)
    server, port = await create_grpc_server(settings, registry)
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
            assert status.ready is False
            assert {entry.model.model_id for entry in status.models} == {
                "clip-vit-b32-vision",
                "clip-vit-b32-text",
                "scrfd-10g",
                "arcface-w600k-r50",
            }
            assert all(not entry.available for entry in status.models)
    finally:
        await server.stop(grace=None)


async def test_status_reports_ready_once_models_are_cached(tmp_path: Path) -> None:
    manifests_dir = build_local_manifests(tmp_path)
    settings = loopback_settings(tmp_path, manifests_dir=manifests_dir)
    registry = ModelRegistry.load(settings)
    await registry.ensure_all()

    server, port = await create_grpc_server(settings, registry)
    try:
        async with grpc.aio.insecure_channel(f"127.0.0.1:{port}") as channel:
            stub = image_analysis_pb2_grpc.ImageAnalysisStub(channel)
            status = await stub.GetServiceStatus(image_analysis_pb2.GetServiceStatusRequest())
            assert status.ready is True
            assert len(status.models) == 4
            assert all(entry.available for entry in status.models)
    finally:
        await server.stop(grace=None)


async def test_admin_endpoints_report_health_readiness_and_models(tmp_path: Path) -> None:
    settings = loopback_settings(tmp_path)
    registry = ModelRegistry.load(settings)
    state = ServiceState()
    app = create_admin_app(settings, state, registry)
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
        assert info["models_ready"] is False
        assert info["max_parallel_analyses"] == 2
        assert info["execution_providers"] == ["CPUExecutionProvider"]

        models = (await client.get("/api/models")).json()
        assert len(models) == 4
        by_id = {entry["id"]: entry for entry in models}
        assert by_id["scrfd-10g"]["license"]["commercial_use"] is False
        assert by_id["scrfd-10g"]["license"]["allow_bundling"] is False
        assert by_id["clip-vit-b32-vision"]["license"]["spdx"] == "MIT"
        assert all(entry["available"] is False for entry in models)
