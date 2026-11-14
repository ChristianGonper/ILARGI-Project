"""Convierte figure6.txt de Lawrence et al. (2022) en datos y textura reproducibles."""

import argparse
import io
import struct
import zlib
from pathlib import Path
from zipfile import ZipFile

import numpy as np

ROOT = Path(__file__).resolve().parent.parent


def png_chunk(kind: bytes, data: bytes) -> bytes:
    payload = kind + data
    return (
        struct.pack(">I", len(data)) + payload + struct.pack(">I", zlib.crc32(payload))
    )


def main(archive: Path) -> None:
    with ZipFile(archive) as source:
        rows = np.loadtxt(io.BytesIO(source.read("figure6.txt")))
    lon = np.arange(-179.75, 180, 0.5)
    lat = np.arange(-89.75, 90, 0.5)
    if rows.shape != (360 * 720, 3):
        raise ValueError("La malla no tiene las dimensiones esperadas")
    if not np.array_equal(rows[:, 0], np.tile(lon, 360)) or not np.array_equal(
        rows[:, 1], np.repeat(lat, 720)
    ):
        raise ValueError("Las coordenadas de la malla no son las esperadas")
    hydrogen = rows[:, 2].reshape(360, 720).astype(np.float32)
    if not np.isfinite(hydrogen).all() or (hydrogen < 0).any():
        raise ValueError("Abundancias de hidrógeno inválidas")
    np.savez_compressed(
        ROOT / "data/materials/lawrence2022_hydrogen.npz", hydrogen=hydrogen
    )

    # El alfa representa intervalos uniformes de 0–120 ppm H; el norte va arriba.
    alpha = np.rint(255 * (0.12 + 0.58 * np.clip(hydrogen[::-1] / 120, 0, 1))).astype(
        np.uint8
    )
    rgba = np.empty((360, 720, 4), dtype=np.uint8)
    rgba[:, :, :3] = (34, 211, 238)
    rgba[:, :, 3] = alpha
    scanlines = b"".join(b"\x00" + row.tobytes() for row in rgba)
    png = b"\x89PNG\r\n\x1a\n" + png_chunk(
        b"IHDR", struct.pack(">IIBBBBB", 720, 360, 8, 6, 0, 0, 0)
    )
    png += png_chunk(b"IDAT", zlib.compress(scanlines, 9)) + png_chunk(b"IEND", b"")
    (ROOT / "web/public/textures/weh_lawrence2022.png").write_bytes(png)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path)
    main(parser.parse_args().archive)
