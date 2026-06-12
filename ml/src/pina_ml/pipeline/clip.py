from __future__ import annotations

from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image
from tokenizers import Tokenizer

_CLIP_MEAN = np.array([0.48145466, 0.4578275, 0.40821073], dtype=np.float32)
_CLIP_STD = np.array([0.26862954, 0.26130258, 0.27577711], dtype=np.float32)
# CLIP was trained with a learned logit scale that converges to ~100; using it
# makes the softmax over labels behave like the original zero-shot setup.
_CLIP_LOGIT_SCALE = 100.0
_MAX_TOKENS = 77
_PROMPT_TEMPLATE = "a photo of {label}"


def preprocess_clip_image(image: Image.Image, image_size: int) -> np.ndarray:
    """Resize shortest side, center-crop, CLIP-normalize; returns (1,3,S,S)."""
    width, height = image.size
    scale = image_size / min(width, height)
    resized = image.resize(
        (max(image_size, round(width * scale)), max(image_size, round(height * scale))),
        Image.Resampling.BICUBIC,
    )
    left = (resized.width - image_size) // 2
    top = (resized.height - image_size) // 2
    cropped = resized.crop((left, top, left + image_size, top + image_size))
    pixels = np.asarray(cropped, dtype=np.float32) / 255.0
    normalized = (pixels - _CLIP_MEAN) / _CLIP_STD
    return np.ascontiguousarray(normalized.transpose(2, 0, 1)[np.newaxis, ...], dtype=np.float32)


def load_vocabulary(path: Path) -> list[str]:
    labels = [line.strip() for line in path.read_text(encoding="utf-8").splitlines()]
    return [label for label in labels if label and not label.startswith("#")]


def prompt_for(label: str) -> str:
    return _PROMPT_TEMPLATE.format(label=label)


def score_tags(
    image_embedding: np.ndarray,
    label_embeddings: np.ndarray,
    labels: list[str],
    top_k: int,
    min_confidence: float,
) -> list[tuple[str, float]]:
    """Zero-shot label probabilities via softmax over cosine similarities."""
    logits = _CLIP_LOGIT_SCALE * (label_embeddings @ image_embedding)
    logits -= logits.max()
    probabilities = np.exp(logits)
    probabilities /= probabilities.sum()
    order = np.argsort(probabilities)[::-1][:top_k]
    return [
        (labels[index], float(probabilities[index]))
        for index in order
        if probabilities[index] >= min_confidence
    ]


def _l2_normalize(matrix: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(matrix, axis=-1, keepdims=True)
    return matrix / np.maximum(norms, 1e-12)


def _pick_output(session: ort.InferenceSession, preferred: str) -> str:
    names = [output.name for output in session.get_outputs()]
    return preferred if preferred in names else names[0]


class ClipVisionModel:
    """Image encoder producing an L2-normalized embedding."""

    def __init__(self, session: ort.InferenceSession, image_size: int) -> None:
        self._session = session
        self._image_size = image_size
        self._input = session.get_inputs()[0].name
        self._output = _pick_output(session, "image_embeds")

    def embed(self, image: Image.Image) -> np.ndarray:
        blob = preprocess_clip_image(image, self._image_size)
        (embeds,) = self._session.run([self._output], {self._input: blob})
        return _l2_normalize(embeds.astype(np.float32))[0]


class ClipTextModel:
    """Text encoder producing L2-normalized embeddings in the CLIP space."""

    def __init__(self, session: ort.InferenceSession, tokenizer_path: Path) -> None:
        self._session = session
        self._tokenizer = Tokenizer.from_file(str(tokenizer_path))
        input_names = [item.name for item in session.get_inputs()]
        self._ids_input = "input_ids" if "input_ids" in input_names else input_names[0]
        self._wants_attention = "attention_mask" in input_names
        self._output = _pick_output(session, "text_embeds")

    def embed(self, texts: list[str]) -> np.ndarray:
        sequences = [self._token_ids(text) for text in texts]
        max_length = max(len(sequence) for sequence in sequences)
        input_ids = np.zeros((len(sequences), max_length), dtype=np.int64)
        attention = np.zeros((len(sequences), max_length), dtype=np.int64)
        for row, sequence in enumerate(sequences):
            input_ids[row, : len(sequence)] = sequence
            attention[row, : len(sequence)] = 1
        feeds: dict[str, np.ndarray] = {self._ids_input: input_ids}
        if self._wants_attention:
            feeds["attention_mask"] = attention
        (embeds,) = self._session.run([self._output], feeds)
        return _l2_normalize(embeds.astype(np.float32))

    def _token_ids(self, text: str) -> list[int]:
        ids = self._tokenizer.encode(text).ids
        if len(ids) > _MAX_TOKENS:
            # CLIP pools at the EOS token, so keep the final token on truncation.
            ids = ids[: _MAX_TOKENS - 1] + [ids[-1]]
        return ids
