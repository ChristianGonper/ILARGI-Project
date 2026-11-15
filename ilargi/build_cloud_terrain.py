"""Build a lossless tiled LOLA global DEM for efficient remote window reads."""

import argparse
import os
from pathlib import Path

import numpy as np
import rasterio
from rasterio.shutil import copy
from rasterio.windows import Window

from ilargi.download_terrain import digest
from ilargi.terrain import GLOBAL_COG_FILENAME, dem_metadata, resolve_global_dem


def build_cloud_dem(source: Path, output: Path) -> None:
    """Preserve every source pixel and all geometry/height metadata, without overviews."""
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".part.tif")
    try:
        copy(
            source,
            temporary,
            driver="COG",
            compress="DEFLATE",
            predictor="STANDARD",
            blocksize=256,
            overviews="NONE",
            num_threads="2",
        )
        with rasterio.open(source) as original, rasterio.open(temporary) as tiled:
            dem_metadata(tiled)
            for attr in (
                "shape",
                "crs",
                "transform",
                "dtypes",
                "scales",
                "offsets",
                "units",
                "nodata",
            ):
                if getattr(original, attr) != getattr(tiled, attr):
                    raise ValueError(f"Cloud DEM changed source {attr}")
            # Compare every pixel in bounded strips, not just a sample/checksum of metadata.
            for row in range(0, original.height, 256):
                window = Window(0, row, original.width, min(256, original.height - row))
                np.testing.assert_array_equal(
                    original.read(1, window=window), tiled.read(1, window=window)
                )
        os.replace(temporary, output)
    finally:
        temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path)
    parser.add_argument(
        "--output", type=Path, default=Path("outputs/terrain") / GLOBAL_COG_FILENAME
    )
    args = parser.parse_args()
    source = args.source or resolve_global_dem()
    if source is None:
        parser.error(
            "Download official LOLA products with python -m ilargi.download_terrain first"
        )
    build_cloud_dem(source, args.output)
    print(f"Verified all pixels: {args.output} ({args.output.stat().st_size} bytes)")
    print(f"SHA-256: {digest(args.output)}")


if __name__ == "__main__":
    main()
