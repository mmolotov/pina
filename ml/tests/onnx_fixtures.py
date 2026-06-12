"""Tiny ONNX models mimicking the I/O interfaces of the real pipeline models."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import onnx
import yaml
from onnx import TensorProto, helper, numpy_helper

# Flat anchor index for stride 8, cell (x=10, y=10), anchor 0 on a 640 input:
# (y * 80 + x) * 2 = 1620; the anchor center is (80, 80) in letterbox pixels.
SCRFD_TEST_ANCHOR_INDEX = 1620
SCRFD_TEST_SCORE = 0.9
SCRFD_TEST_DISTANCES = (5.0, 5.0, 5.0, 5.0)  # in stride units → box (40,40)-(120,120)

_OPSET = [helper.make_opsetid("", 13)]


def build_vision_model(path: Path, embed_dim: int = 8) -> None:
    pixel_values = helper.make_tensor_value_info(
        "pixel_values", TensorProto.FLOAT, ["batch", 3, 224, 224]
    )
    image_embeds = helper.make_tensor_value_info(
        "image_embeds", TensorProto.FLOAT, ["batch", embed_dim]
    )
    weights = numpy_helper.from_array(
        np.linspace(-1.0, 1.0, num=3 * embed_dim, dtype=np.float32).reshape(3, embed_dim),
        name="vision_weights",
    )
    nodes = [
        helper.make_node("ReduceMean", ["pixel_values"], ["pooled"], axes=[2, 3], keepdims=0),
        helper.make_node("MatMul", ["pooled", "vision_weights"], ["image_embeds"]),
    ]
    graph = helper.make_graph(nodes, "vision", [pixel_values], [image_embeds], [weights])
    onnx.save(helper.make_model(graph, opset_imports=_OPSET), str(path))


def build_text_model(path: Path, embed_dim: int = 8) -> None:
    input_ids = helper.make_tensor_value_info("input_ids", TensorProto.INT64, ["batch", "seq"])
    attention_mask = helper.make_tensor_value_info(
        "attention_mask", TensorProto.INT64, ["batch", "seq"]
    )
    text_embeds = helper.make_tensor_value_info(
        "text_embeds", TensorProto.FLOAT, ["batch", embed_dim]
    )
    weights = numpy_helper.from_array(
        np.linspace(0.1, 1.0, num=embed_dim, dtype=np.float32).reshape(1, embed_dim),
        name="text_weights",
    )
    nodes = [
        helper.make_node("Cast", ["input_ids"], ["ids_float"], to=TensorProto.FLOAT),
        helper.make_node("ReduceMean", ["ids_float"], ["pooled"], axes=[1], keepdims=1),
        helper.make_node("MatMul", ["pooled", "text_weights"], ["text_embeds"]),
    ]
    graph = helper.make_graph(nodes, "text", [input_ids, attention_mask], [text_embeds], [weights])
    onnx.save(helper.make_model(graph, opset_imports=_OPSET), str(path))


def build_scrfd_model(path: Path) -> None:
    """Constant-output SCRFD lookalike with one confident anchor at stride 8."""
    image = helper.make_tensor_value_info("input", TensorProto.FLOAT, ["batch", 3, 640, 640])

    counts = {8: 80 * 80 * 2, 16: 40 * 40 * 2, 32: 20 * 20 * 2}
    scores = {stride: np.zeros((count, 1), dtype=np.float32) for stride, count in counts.items()}
    bboxes = {stride: np.zeros((count, 4), dtype=np.float32) for stride, count in counts.items()}
    keypoints = {
        stride: np.zeros((count, 10), dtype=np.float32) for stride, count in counts.items()
    }
    scores[8][SCRFD_TEST_ANCHOR_INDEX, 0] = SCRFD_TEST_SCORE
    bboxes[8][SCRFD_TEST_ANCHOR_INDEX] = SCRFD_TEST_DISTANCES
    keypoints[8][SCRFD_TEST_ANCHOR_INDEX] = (-2, -2, 2, -2, 0, 0, -1.5, 2, 1.5, 2)

    initializers = []
    outputs = []
    nodes = []
    for kind, data in (("score", scores), ("bbox", bboxes), ("kps", keypoints)):
        for stride in (8, 16, 32):
            name = f"{kind}_{stride}"
            initializers.append(numpy_helper.from_array(data[stride], name=f"{name}_const"))
            outputs.append(
                helper.make_tensor_value_info(name, TensorProto.FLOAT, list(data[stride].shape))
            )
            nodes.append(helper.make_node("Identity", [f"{name}_const"], [name]))

    graph = helper.make_graph(nodes, "scrfd", [image], outputs, initializers)
    onnx.save(helper.make_model(graph, opset_imports=_OPSET), str(path))


def build_rec_model(path: Path, embed_dim: int = 16) -> None:
    image = helper.make_tensor_value_info("input", TensorProto.FLOAT, ["batch", 3, 112, 112])
    embedding = helper.make_tensor_value_info("embedding", TensorProto.FLOAT, ["batch", embed_dim])
    weights = numpy_helper.from_array(
        np.linspace(0.5, 1.5, num=3 * embed_dim, dtype=np.float32).reshape(3, embed_dim),
        name="rec_weights",
    )
    nodes = [
        helper.make_node("ReduceMean", ["input"], ["pooled"], axes=[2, 3], keepdims=0),
        helper.make_node("MatMul", ["pooled", "rec_weights"], ["embedding"]),
    ]
    graph = helper.make_graph(nodes, "rec", [image], [embedding], [weights])
    onnx.save(helper.make_model(graph, opset_imports=_OPSET), str(path))


def build_tokenizer(path: Path) -> None:
    from tokenizers import Tokenizer, models, pre_tokenizers

    vocab = {
        "[UNK]": 0,
        "a": 1,
        "photo": 2,
        "of": 3,
        "beach": 4,
        "dog": 5,
        "sunset": 6,
        "cat": 7,
        "hello": 8,
        "world": 9,
    }
    tokenizer = Tokenizer(models.WordLevel(vocab, unk_token="[UNK]"))
    tokenizer.pre_tokenizer = pre_tokenizers.Whitespace()
    tokenizer.save(str(path))


def build_pipeline_manifests(base_dir: Path) -> Path:
    """Manifests dir with interface-compatible tiny models for all 4 steps."""
    manifests_dir = base_dir / "pipeline-manifests"
    models_dir = manifests_dir / "models"
    profiles_dir = manifests_dir / "profiles"
    models_dir.mkdir(parents=True)
    profiles_dir.mkdir(parents=True)
    artifacts_dir = base_dir / "pipeline-artifacts"
    artifacts_dir.mkdir()

    build_vision_model(artifacts_dir / "vision.onnx")
    build_text_model(artifacts_dir / "text.onnx")
    build_scrfd_model(artifacts_dir / "det.onnx")
    build_rec_model(artifacts_dir / "rec.onnx")
    build_tokenizer(artifacts_dir / "tokenizer.json")

    manifests = [
        {
            "id": "test-vision",
            "version": "1.0",
            "step": "image_embedding",
            "license": {"spdx": "MIT"},
            "files": [{"name": "vision.onnx", "url": (artifacts_dir / "vision.onnx").as_uri()}],
            "input": {"image_size": 224},
            "output": {"embedding_dim": 8},
        },
        {
            "id": "test-text",
            "version": "1.0",
            "step": "tagging",
            "license": {"spdx": "MIT"},
            "files": [
                {"name": "text.onnx", "url": (artifacts_dir / "text.onnx").as_uri()},
                {"name": "tokenizer.json", "url": (artifacts_dir / "tokenizer.json").as_uri()},
            ],
            "output": {"embedding_dim": 8},
        },
        {
            "id": "test-det",
            "version": "1.0",
            "step": "face_detection",
            "license": {"spdx": "MIT"},
            "files": [{"name": "det.onnx", "url": (artifacts_dir / "det.onnx").as_uri()}],
            "input": {"image_size": 640},
        },
        {
            "id": "test-rec",
            "version": "1.0",
            "step": "face_embedding",
            "license": {"spdx": "MIT"},
            "files": [{"name": "rec.onnx", "url": (artifacts_dir / "rec.onnx").as_uri()}],
            "output": {"embedding_dim": 16},
        },
    ]
    for manifest in manifests:
        (models_dir / f"{manifest['id']}.yaml").write_text(
            yaml.safe_dump(manifest), encoding="utf-8"
        )

    profile = {
        "name": "default",
        "max_parallel_analyses": 1,
        "analysis_max_resolution": 640,
        "steps": {
            "image_embedding": {"model": "test-vision"},
            "tagging": {"model": "test-text"},
            "face_detection": {"model": "test-det"},
            "face_embedding": {"model": "test-rec"},
        },
    }
    (profiles_dir / "default.yaml").write_text(yaml.safe_dump(profile), encoding="utf-8")
    return manifests_dir
