from __future__ import annotations

import hashlib
import zipfile
from pathlib import Path

import pytest

from pina_ml.registry import ArchiveSpec, ArtifactDownloader, ArtifactError, ArtifactSpec


async def test_file_url_download_and_cache_hit(tmp_path: Path) -> None:
    source = tmp_path / "model.bin"
    source.write_bytes(b"hello-weights")
    downloader = ArtifactDownloader(tmp_path / "cache")
    artifact = ArtifactSpec(name="model.onnx", url=source.as_uri())

    path = await downloader.ensure("m", "1.0", artifact)
    assert path.read_bytes() == b"hello-weights"
    assert downloader.is_cached("m", "1.0", artifact)

    source.write_bytes(b"changed-on-source")
    cached_again = await downloader.ensure("m", "1.0", artifact)
    assert cached_again == path
    assert path.read_bytes() == b"hello-weights"


async def test_zip_member_extraction_handles_nested_layout(tmp_path: Path) -> None:
    archive = tmp_path / "pack.zip"
    with zipfile.ZipFile(archive, "w") as zf:
        zf.writestr("buffalo_l/det_10g.onnx", b"det-weights")
        zf.writestr("buffalo_l/w600k_r50.onnx", b"rec-weights")
    downloader = ArtifactDownloader(tmp_path / "cache")
    det = ArtifactSpec(
        name="det_10g.onnx", url=archive.as_uri(), archive=ArchiveSpec(member="det_10g.onnx")
    )
    rec = ArtifactSpec(
        name="w600k_r50.onnx", url=archive.as_uri(), archive=ArchiveSpec(member="w600k_r50.onnx")
    )

    det_path = await downloader.ensure("det", "0.7", det)
    rec_path = await downloader.ensure("rec", "0.7", rec)

    assert det_path.read_bytes() == b"det-weights"
    assert rec_path.read_bytes() == b"rec-weights"
    archives = list((tmp_path / "cache" / "archives").glob("*.zip"))
    assert len(archives) == 1


async def test_sha256_verification(tmp_path: Path) -> None:
    source = tmp_path / "model.bin"
    source.write_bytes(b"verified")
    downloader = ArtifactDownloader(tmp_path / "cache")
    good = ArtifactSpec(
        name="good.onnx", url=source.as_uri(), sha256=hashlib.sha256(b"verified").hexdigest()
    )
    bad = ArtifactSpec(name="bad.onnx", url=source.as_uri(), sha256="0" * 64)

    good_path = await downloader.ensure("m", "1.0", good)
    assert good_path.read_bytes() == b"verified"

    with pytest.raises(ArtifactError, match="SHA-256 mismatch"):
        await downloader.ensure("m", "1.0", bad)
    assert not downloader.is_cached("m", "1.0", bad)


async def test_unsupported_scheme_rejected(tmp_path: Path) -> None:
    downloader = ArtifactDownloader(tmp_path / "cache")
    artifact = ArtifactSpec(name="x.onnx", url="ftp://example.com/x.onnx")
    with pytest.raises(ArtifactError, match="Unsupported artifact URL scheme"):
        await downloader.ensure("m", "1.0", artifact)
