from __future__ import annotations

import numpy as np
import pytest
from PIL import Image

from pina_ml.pipeline.clip import preprocess_clip_image, score_tags
from pina_ml.pipeline.faces import (
    ARCFACE_TEMPLATE,
    decode_scrfd,
    letterbox_blob,
    similarity_transform,
)


def synthetic_scrfd_outputs() -> list[np.ndarray]:
    counts = {8: 80 * 80 * 2, 16: 40 * 40 * 2, 32: 20 * 20 * 2}
    scores = [np.zeros((counts[s], 1), dtype=np.float32) for s in (8, 16, 32)]
    bboxes = [np.zeros((counts[s], 4), dtype=np.float32) for s in (8, 16, 32)]
    keypoints = [np.zeros((counts[s], 10), dtype=np.float32) for s in (8, 16, 32)]
    # Anchor 0 of cell (x=10, y=10) at stride 8 → center (80, 80).
    index = (10 * 80 + 10) * 2
    scores[0][index, 0] = 0.9
    bboxes[0][index] = (5.0, 5.0, 5.0, 5.0)
    keypoints[0][index] = (-2, -2, 2, -2, 0, 0, -1.5, 2, 1.5, 2)
    return scores + bboxes + keypoints


def test_decode_scrfd_maps_anchor_back_to_original_image() -> None:
    faces = decode_scrfd(
        synthetic_scrfd_outputs(), scale=2.0, original_size=(320, 240), min_confidence=0.5
    )

    assert len(faces) == 1
    face = faces[0]
    assert face.confidence == pytest.approx(0.9)
    x, y, width, height = face.bbox
    # Letterbox box (40,40)-(120,120) → original (20,20)-(60,60).
    assert x == pytest.approx(20 / 320)
    assert y == pytest.approx(20 / 240)
    assert width == pytest.approx(40 / 320)
    assert height == pytest.approx(40 / 240)
    # Center landmark (80,80) in letterbox space → (40,40) in the original.
    assert face.landmarks[2] == pytest.approx((40.0, 40.0))


def test_decode_scrfd_suppresses_overlapping_lower_scores() -> None:
    outputs = synthetic_scrfd_outputs()
    index = (10 * 80 + 10) * 2
    # Same cell, second anchor: nearly identical box with a lower score.
    outputs[0][index + 1, 0] = 0.7
    outputs[3][index + 1] = (5.0, 5.0, 5.0, 5.0)

    faces = decode_scrfd(outputs, scale=2.0, original_size=(320, 240), min_confidence=0.5)

    assert len(faces) == 1
    assert faces[0].confidence == pytest.approx(0.9)


def test_letterbox_blob_scales_and_normalizes() -> None:
    image = Image.new("RGB", (320, 240), (255, 255, 255))
    blob, scale = letterbox_blob(image)

    assert scale == pytest.approx(2.0)
    assert blob.shape == (1, 3, 640, 640)
    # White pixels → (255 - 127.5) / 128; padded black → (0 - 127.5) / 128.
    assert blob[0, 0, 0, 0] == pytest.approx((255 - 127.5) / 128)
    assert blob[0, 0, 639, 639] == pytest.approx(-127.5 / 128)


def test_similarity_transform_recovers_known_mapping() -> None:
    rotation = np.deg2rad(30.0)
    matrix = 1.7 * np.array(
        [[np.cos(rotation), -np.sin(rotation)], [np.sin(rotation), np.cos(rotation)]]
    )
    source = ARCFACE_TEMPLATE @ matrix.T + np.array([11.0, -7.0])

    recovered = similarity_transform(source, ARCFACE_TEMPLATE)
    mapped = source @ recovered[:2, :2].T + recovered[:, 2]

    assert mapped == pytest.approx(ARCFACE_TEMPLATE, abs=1e-4)


def test_preprocess_clip_image_shape_and_range() -> None:
    image = Image.new("RGB", (300, 200), (128, 128, 128))
    blob = preprocess_clip_image(image, 224)

    assert blob.shape == (1, 3, 224, 224)
    assert np.isfinite(blob).all()
    assert abs(blob).max() < 5.0


def test_score_tags_prefers_matching_label() -> None:
    labels = ["beach", "dog", "sunset"]
    label_embeddings = np.eye(3, 4, dtype=np.float32)
    image_embedding = np.array([0.0, 1.0, 0.0, 0.0], dtype=np.float32)

    scored = score_tags(image_embedding, label_embeddings, labels, top_k=2, min_confidence=0.0)

    assert scored[0][0] == "dog"
    assert scored[0][1] > 0.99
    assert len(scored) == 2
