"""Build a display DEM; scientific calculations use separate terrain products."""

import argparse
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling

SOURCE_URL = "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_16_uint.tif"
OUTPUT = Path(__file__).resolve().parent.parent / "web/public/textures"


def build(source: Path, output: Path = OUTPUT) -> None:
    """Reduce 16 to 8 samples per degree, retaining half-meter height units."""
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    if (
        source_hash
        != "45a2b32d56e81ed30db07fead8abc842b249b6511219d9ca2c53f81bc2dc5d62"
    ):
        raise ValueError("SHA-256 does not match the verified NASA product")
    with rasterio.open(source) as dataset:
        if dataset.shape != (2880, 5760) or dataset.dtypes != ("uint16",):
            raise ValueError("Expected ldem_16_uint.tif (5760 × 2880, uint16)")
        values = dataset.read(1, out_shape=(1440, 2880), resampling=Resampling.average)
    # NASA uint16: 0.5 m relative to 1,727,400 m, i.e. -10 km offset.
    heights = (values.astype(np.int32) - 20_000).astype("<i2")
    output.mkdir(parents=True, exist_ok=True)
    payload = gzip.compress(heights.tobytes(), mtime=0)
    (output / "moon_height.bin.gz").write_bytes(payload)
    metadata = {
        "width": 2880,
        "height": 1440,
        "unit_m": 0.5,
        "radius_m": 1_737_400,
        "source_url": SOURCE_URL,
        "source_sha256": source_hash,
        "payload_sha256": hashlib.sha256(payload).hexdigest(),
        "credits": "NASA's Scientific Visualization Studio / LRO LOLA",
        "resampling": "2 × 2 average, rounded to half metres",
        "layout": "little endian int16; north to south; west to east; centered on 0 degrees longitude",
    }
    (output / "moon_height.json").write_text(
        json.dumps(metadata, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="NASA CGI Moon Kit ldem_16_uint.tif")
    build(parser.parse_args().source)
