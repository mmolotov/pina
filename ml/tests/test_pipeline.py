from __future__ import annotations

import io
import shutil
from pathlib import Path

import grpc
import pytest
import yaml
from PIL import Image

from onnx_fixtures import build_pipeline_manifests
from pina.ml.v1 import common_pb2, image_analysis_pb2, image_analysis_pb2_grpc
from pina_ml.config import Settings
from pina_ml.grpc_server import create_grpc_server
from pina_ml.registry import ModelRegistry

EXPECTED_MODEL_BY_STEP = {
    common_pb2.IMAGE_EMBEDDING: "test-vision",
    common_pb2.TAGGING: "test-text",
    common_pb2.FACE_DETECTION: "test-det",
    common_pb2.FACE_EMBEDDING: "test-rec",
}


def pipeline_settings(tmp_path: Path) -> Settings:
    vocabulary = tmp_path / "vocab.txt"
    if not vocabulary.exists():
        vocabulary.write_text("beach\ndog\nsunset\ncat\n", encoding="utf-8")
    return Settings(
        grpc_host="127.0.0.1",
        grpc_port=0,
        http_host="127.0.0.1",
        http_port=0,
        model_cache_dir=tmp_path / "cache",
        manifests_dir=build_pipeline_manifests(tmp_path),
        tags_vocabulary_path=vocabulary,
        tag_top_k=3,
        tag_min_confidence=0.0,
    )


def photo_bytes(width: int = 320, height: int = 240) -> bytes:
    image = Image.new("RGB", (width, height))
    pixels = image.load()
    assert pixels is not None
    for x in range(width):
        for y in range(height):
            pixels[x, y] = (x % 256, y % 256, (x + y) % 256)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def analyze_request(steps: list[int] | None = None) -> image_analysis_pb2.AnalyzeImageRequest:
    return image_analysis_pb2.AnalyzeImageRequest(
        request_id="req-1",
        media=image_analysis_pb2.MediaContext(kind=image_analysis_pb2.PHOTO, media_id="photo-1"),
        image=image_analysis_pb2.ImageInput(data=photo_bytes(), mime_type="image/png"),
        # The pb2 stubs type enum values via a private NewType; plain ints are
        # what the runtime accepts.
        steps=steps or [],  # type: ignore[arg-type]
    )


async def test_analyze_image_end_to_end(tmp_path: Path) -> None:
    settings = pipeline_settings(tmp_path)
    registry = ModelRegistry.load(settings)
    server, port = await create_grpc_server(settings, registry)
    try:
        async with grpc.aio.insecure_channel(f"127.0.0.1:{port}") as channel:
            stub = image_analysis_pb2_grpc.ImageAnalysisStub(channel)
            response = await stub.AnalyzeImage(analyze_request())

            assert response.request_id == "req-1"
            assert len(response.step_results) == 4
            for step_result in response.step_results:
                assert step_result.status == common_pb2.COMPLETED
                assert step_result.model.model_id == EXPECTED_MODEL_BY_STEP[step_result.step]
                assert step_result.model.version == "1.0"
                assert step_result.duration_ms >= 0

            assert len(response.image_embedding.values) == 8
            norm = sum(value * value for value in response.image_embedding.values) ** 0.5
            assert norm == pytest.approx(1.0, abs=1e-4)

            # The toy text model maps every label to the same direction, so the
            # softmax is uniform over the 4 vocabulary labels.
            assert len(response.tags) == 3
            for tag in response.tags:
                assert tag.confidence == pytest.approx(0.25, abs=1e-4)

            assert len(response.faces) == 1
            face = response.faces[0]
            assert face.confidence == pytest.approx(0.9, abs=1e-5)
            assert face.box.x == pytest.approx(0.0625, abs=1e-3)
            assert face.box.y == pytest.approx(20 / 240, abs=1e-3)
            assert face.box.width == pytest.approx(0.125, abs=1e-3)
            assert face.box.height == pytest.approx(40 / 240, abs=1e-3)
            assert len(face.embedding.values) == 16
    finally:
        await server.stop(grace=None)


async def test_requested_steps_limit_execution(tmp_path: Path) -> None:
    settings = pipeline_settings(tmp_path)
    registry = ModelRegistry.load(settings)
    server, port = await create_grpc_server(settings, registry)
    try:
        async with grpc.aio.insecure_channel(f"127.0.0.1:{port}") as channel:
            stub = image_analysis_pb2_grpc.ImageAnalysisStub(channel)
            response = await stub.AnalyzeImage(analyze_request([common_pb2.IMAGE_EMBEDDING]))
            assert [entry.step for entry in response.step_results] == [common_pb2.IMAGE_EMBEDDING]
            assert len(response.image_embedding.values) == 8
            assert len(response.tags) == 0
            assert len(response.faces) == 0
    finally:
        await server.stop(grace=None)


async def test_tagging_without_embedding_is_skipped(tmp_path: Path) -> None:
    settings = pipeline_settings(tmp_path)
    registry = ModelRegistry.load(settings)
    server, port = await create_grpc_server(settings, registry)
    try:
        async with grpc.aio.insecure_channel(f"127.0.0.1:{port}") as channel:
            stub = image_analysis_pb2_grpc.ImageAnalysisStub(channel)
            response = await stub.AnalyzeImage(analyze_request([common_pb2.TAGGING]))
            (tagging,) = response.step_results
            assert tagging.status == common_pb2.SKIPPED_UNAVAILABLE
            assert "image embedding" in tagging.error_message
            assert len(response.tags) == 0
    finally:
        await server.stop(grace=None)


async def test_disabled_step_reported_as_skipped_disabled(tmp_path: Path) -> None:
    settings = pipeline_settings(tmp_path)
    assert settings.manifests_dir is not None
    profile_path = settings.manifests_dir / "profiles" / "default.yaml"
    profile = yaml.safe_load(profile_path.read_text(encoding="utf-8"))
    profile["steps"]["face_embedding"]["enabled"] = False
    profile_path.write_text(yaml.safe_dump(profile), encoding="utf-8")

    registry = ModelRegistry.load(settings)
    server, port = await create_grpc_server(settings, registry)
    try:
        async with grpc.aio.insecure_channel(f"127.0.0.1:{port}") as channel:
            stub = image_analysis_pb2_grpc.ImageAnalysisStub(channel)
            response = await stub.AnalyzeImage(analyze_request())
            by_step = {entry.step: entry for entry in response.step_results}
            assert by_step[common_pb2.FACE_EMBEDDING].status == common_pb2.SKIPPED_DISABLED
            assert by_step[common_pb2.FACE_DETECTION].status == common_pb2.COMPLETED
            (face,) = response.faces
            assert len(face.embedding.values) == 0
    finally:
        await server.stop(grace=None)


async def test_missing_artifacts_reported_as_skipped_unavailable(tmp_path: Path) -> None:
    settings = pipeline_settings(tmp_path)
    shutil.rmtree(tmp_path / "pipeline-artifacts")

    registry = ModelRegistry.load(settings)
    server, port = await create_grpc_server(settings, registry)
    try:
        async with grpc.aio.insecure_channel(f"127.0.0.1:{port}") as channel:
            stub = image_analysis_pb2_grpc.ImageAnalysisStub(channel)
            response = await stub.AnalyzeImage(analyze_request())
            assert len(response.step_results) == 4
            for step_result in response.step_results:
                assert step_result.status == common_pb2.SKIPPED_UNAVAILABLE
                assert "model unavailable" in step_result.error_message
            assert len(response.image_embedding.values) == 0
    finally:
        await server.stop(grace=None)


async def test_undecodable_image_rejected(tmp_path: Path) -> None:
    settings = pipeline_settings(tmp_path)
    registry = ModelRegistry.load(settings)
    server, port = await create_grpc_server(settings, registry)
    try:
        async with grpc.aio.insecure_channel(f"127.0.0.1:{port}") as channel:
            stub = image_analysis_pb2_grpc.ImageAnalysisStub(channel)
            request = image_analysis_pb2.AnalyzeImageRequest(
                request_id="bad",
                image=image_analysis_pb2.ImageInput(data=b"not-an-image"),
            )
            with pytest.raises(grpc.aio.AioRpcError) as error:
                await stub.AnalyzeImage(request)
            assert error.value.code() == grpc.StatusCode.INVALID_ARGUMENT
    finally:
        await server.stop(grace=None)


async def test_embed_text_round_trip(tmp_path: Path) -> None:
    settings = pipeline_settings(tmp_path)
    registry = ModelRegistry.load(settings)
    server, port = await create_grpc_server(settings, registry)
    try:
        async with grpc.aio.insecure_channel(f"127.0.0.1:{port}") as channel:
            stub = image_analysis_pb2_grpc.ImageAnalysisStub(channel)
            response = await stub.EmbedText(image_analysis_pb2.EmbedTextRequest(text="hello world"))
            assert len(response.embedding.values) == 8
            assert response.model.model_id == "test-text"

            with pytest.raises(grpc.aio.AioRpcError) as error:
                await stub.EmbedText(image_analysis_pb2.EmbedTextRequest(text="   "))
            assert error.value.code() == grpc.StatusCode.INVALID_ARGUMENT
    finally:
        await server.stop(grace=None)
