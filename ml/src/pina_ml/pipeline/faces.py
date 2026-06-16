from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import onnxruntime as ort
from PIL import Image

SCRFD_INPUT_SIZE = 640
_SCRFD_STRIDES = (8, 16, 32)
_SCRFD_NUM_ANCHORS = 2
_NMS_IOU_THRESHOLD = 0.4

ARCFACE_INPUT_SIZE = 112
# Standard InsightFace 5-point destination template for 112x112 alignment.
ARCFACE_TEMPLATE = np.array(
    [
        [38.2946, 51.6963],
        [73.5318, 51.5014],
        [56.0252, 71.7366],
        [41.5493, 92.3655],
        [70.7299, 92.2041],
    ],
    dtype=np.float32,
)


@dataclass(frozen=True)
class DetectedFace:
    """Detection in original-image space: normalized bbox, pixel landmarks."""

    bbox: tuple[float, float, float, float]
    confidence: float
    landmarks: np.ndarray


def letterbox_blob(image: Image.Image) -> tuple[np.ndarray, float]:
    """Top-left letterbox to the SCRFD input; returns (blob, scale)."""
    width, height = image.size
    scale = SCRFD_INPUT_SIZE / max(width, height)
    new_width = max(1, round(width * scale))
    new_height = max(1, round(height * scale))
    resized = image.resize((new_width, new_height), Image.Resampling.BILINEAR)
    canvas = Image.new("RGB", (SCRFD_INPUT_SIZE, SCRFD_INPUT_SIZE), (0, 0, 0))
    canvas.paste(resized, (0, 0))
    pixels = np.asarray(canvas, dtype=np.float32)
    blob = (pixels - 127.5) / 128.0
    return np.ascontiguousarray(blob.transpose(2, 0, 1)[np.newaxis, ...], dtype=np.float32), scale


def decode_scrfd(
    outputs: list[np.ndarray],
    scale: float,
    original_size: tuple[int, int],
    min_confidence: float,
) -> list[DetectedFace]:
    """Decodes the 9 SCRFD outputs (scores, bboxes, keypoints per stride)."""
    if len(outputs) != 9:
        raise ValueError(f"SCRFD model must produce 9 outputs, got {len(outputs)}")

    all_scores: list[np.ndarray] = []
    all_boxes: list[np.ndarray] = []
    all_landmarks: list[np.ndarray] = []
    for index, stride in enumerate(_SCRFD_STRIDES):
        scores = outputs[index].reshape(-1).astype(np.float32)
        boxes = outputs[index + 3].reshape(-1, 4).astype(np.float32) * stride
        keypoints = outputs[index + 6].reshape(-1, 10).astype(np.float32) * stride

        grid = SCRFD_INPUT_SIZE // stride
        xs, ys = np.meshgrid(np.arange(grid), np.arange(grid))
        centers = np.stack([xs, ys], axis=-1).reshape(-1, 2).astype(np.float32) * stride
        centers = np.repeat(centers, _SCRFD_NUM_ANCHORS, axis=0)

        keep = scores >= min_confidence
        if not np.any(keep):
            continue
        scores = scores[keep]
        centers = centers[keep]
        distances = boxes[keep]
        deltas = keypoints[keep].reshape(-1, 5, 2)

        x1 = centers[:, 0] - distances[:, 0]
        y1 = centers[:, 1] - distances[:, 1]
        x2 = centers[:, 0] + distances[:, 2]
        y2 = centers[:, 1] + distances[:, 3]
        all_scores.append(scores)
        all_boxes.append(np.stack([x1, y1, x2, y2], axis=-1))
        all_landmarks.append(centers[:, np.newaxis, :] + deltas)

    if not all_scores:
        return []

    scores = np.concatenate(all_scores)
    boxes = np.concatenate(all_boxes)
    landmarks = np.concatenate(all_landmarks)
    selected = _nms(boxes, scores, _NMS_IOU_THRESHOLD)

    width, height = original_size
    faces: list[DetectedFace] = []
    for index in selected:
        unscaled = boxes[index] / scale
        left = float(np.clip(unscaled[0], 0, width))
        top = float(np.clip(unscaled[1], 0, height))
        right = float(np.clip(unscaled[2], 0, width))
        bottom = float(np.clip(unscaled[3], 0, height))
        if right <= left or bottom <= top:
            continue
        faces.append(
            DetectedFace(
                bbox=(left / width, top / height, (right - left) / width, (bottom - top) / height),
                confidence=float(scores[index]),
                landmarks=landmarks[index] / scale,
            )
        )
    return faces


def _nms(boxes: np.ndarray, scores: np.ndarray, iou_threshold: float) -> list[int]:
    order = scores.argsort()[::-1]
    keep: list[int] = []
    while order.size > 0:
        current = int(order[0])
        keep.append(current)
        if order.size == 1:
            break
        rest = order[1:]
        x1 = np.maximum(boxes[current, 0], boxes[rest, 0])
        y1 = np.maximum(boxes[current, 1], boxes[rest, 1])
        x2 = np.minimum(boxes[current, 2], boxes[rest, 2])
        y2 = np.minimum(boxes[current, 3], boxes[rest, 3])
        intersection = np.maximum(0.0, x2 - x1) * np.maximum(0.0, y2 - y1)
        area_current = (boxes[current, 2] - boxes[current, 0]) * (
            boxes[current, 3] - boxes[current, 1]
        )
        area_rest = (boxes[rest, 2] - boxes[rest, 0]) * (boxes[rest, 3] - boxes[rest, 1])
        iou = intersection / np.maximum(area_current + area_rest - intersection, 1e-12)
        order = rest[iou <= iou_threshold]
    return keep


def similarity_transform(source: np.ndarray, destination: np.ndarray) -> np.ndarray:
    """Umeyama least-squares similarity transform (2x3) mapping source→destination."""
    source = source.astype(np.float64)
    destination = destination.astype(np.float64)
    source_mean = source.mean(axis=0)
    destination_mean = destination.mean(axis=0)
    source_demean = source - source_mean
    destination_demean = destination - destination_mean

    covariance = destination_demean.T @ source_demean / source.shape[0]
    u, singular_values, vt = np.linalg.svd(covariance)
    sign = np.sign(np.linalg.det(u) * np.linalg.det(vt))
    correction = np.array([1.0, sign])
    rotation = u @ np.diag(correction) @ vt

    source_variance = source_demean.var(axis=0).sum()
    scale = (singular_values @ correction) / max(source_variance, 1e-12)

    matrix = np.zeros((2, 3), dtype=np.float64)
    matrix[:2, :2] = scale * rotation
    matrix[:, 2] = destination_mean - scale * rotation @ source_mean
    return matrix


def align_face(image: Image.Image, landmarks: np.ndarray) -> Image.Image:
    """Warps the image so landmarks land on the ArcFace 112x112 template."""
    matrix = similarity_transform(landmarks, ARCFACE_TEMPLATE)
    full = np.vstack([matrix, [0.0, 0.0, 1.0]])
    # PIL's AFFINE transform expects the output→input mapping.
    inverse = np.linalg.inv(full)
    coefficients = tuple(inverse[:2].reshape(-1))
    return image.transform(
        (ARCFACE_INPUT_SIZE, ARCFACE_INPUT_SIZE),
        Image.Transform.AFFINE,
        coefficients,
        resample=Image.Resampling.BILINEAR,
    )


class ScrfdDetector:
    """SCRFD face detector over an ONNX Runtime session."""

    def __init__(self, session: ort.InferenceSession, min_confidence: float) -> None:
        self._session = session
        self._input = session.get_inputs()[0].name
        self._min_confidence = min_confidence

    def detect(self, image: Image.Image) -> list[DetectedFace]:
        blob, scale = letterbox_blob(image)
        outputs = self._session.run(None, {self._input: blob})
        return decode_scrfd(outputs, scale, image.size, self._min_confidence)


class ArcFaceModel:
    """ArcFace descriptor model producing L2-normalized vectors."""

    def __init__(self, session: ort.InferenceSession) -> None:
        self._session = session
        self._input = session.get_inputs()[0].name
        self._output = session.get_outputs()[0].name

    def embed(self, image: Image.Image, landmarks: np.ndarray) -> np.ndarray:
        aligned = align_face(image, landmarks)
        pixels = np.asarray(aligned, dtype=np.float32)
        blob = np.ascontiguousarray(
            ((pixels - 127.5) / 127.5).transpose(2, 0, 1)[np.newaxis, ...], dtype=np.float32
        )
        (embeds,) = self._session.run([self._output], {self._input: blob})
        vector = embeds[0].astype(np.float32)
        return vector / max(float(np.linalg.norm(vector)), 1e-12)
