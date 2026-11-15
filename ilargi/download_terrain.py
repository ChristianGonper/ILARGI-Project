"""Download and verify official LOLA terrain products."""

import hashlib
import os
import shutil
from pathlib import Path
from urllib.request import urlopen

from ilargi.terrain import (
    GLOBAL_IMG_FILENAME,
    GLOBAL_IMG_SIZE_BYTES,
    GLOBAL_VRT_FILENAME,
    LOCAL_TERRAIN_DIR,
    POLAR_FILENAME,
    POLAR_SIZE_BYTES,
    SHARED_TERRAIN_DIR,
)

PRODUCTS = (
    (
        POLAR_FILENAME,
        "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF",
        POLAR_SIZE_BYTES,
        "82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a",
    ),
    (
        GLOBAL_IMG_FILENAME,
        "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_128.img",
        GLOBAL_IMG_SIZE_BYTES,
        "0e4fea9b863e3255f58de15ccbd2bb8b1e248cb09217fd55d23ed37489f764b4",
    ),
)


def target_terrain_dir() -> Path:
    """Return the destination directory for downloaded full LOLA DEMs."""
    env_dir = os.environ.get("ILARGI_TERRAIN_DIR")
    if env_dir:
        return Path(env_dir)
    return SHARED_TERRAIN_DIR


def digest(path: Path) -> str:
    sha = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            sha.update(chunk)
    return sha.hexdigest()


def download(
    filename: str,
    url: str,
    size: int,
    expected_hash: str,
    target_dir: Path | None = None,
) -> Path:
    dest_dir = target_dir or target_terrain_dir()
    dest_dir.mkdir(parents=True, exist_ok=True)
    path = dest_dir / filename
    if path.is_file() and path.stat().st_size == size and digest(path) == expected_hash:
        print(f"Already available: {path}")
        return path

    local_path = LOCAL_TERRAIN_DIR / filename
    if (
        local_path != path
        and local_path.is_file()
        and local_path.stat().st_size == size
        and digest(local_path) == expected_hash
    ):
        part = path.with_suffix(path.suffix + ".part")
        try:
            shutil.copy2(local_path, part)
            os.replace(part, path)
        finally:
            part.unlink(missing_ok=True)
        print(f"Copied from local directory: {path}")
        return path

    part = path.with_suffix(path.suffix + ".part")
    print(f"Downloading {filename} ({size / 1e9:.2f} GB) to {dest_dir}...", flush=True)
    try:
        with urlopen(url, timeout=60) as response, part.open("wb") as output:
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
        if part.stat().st_size != size or digest(part) != expected_hash:
            raise ValueError(f"Incomplete download or invalid SHA-256: {part}")
        os.replace(part, path)
    finally:
        part.unlink(missing_ok=True)
    return path


def main() -> None:
    dest_dir = target_terrain_dir()
    for product in PRODUCTS:
        download(*product, target_dir=dest_dir)
    local_vrt = LOCAL_TERRAIN_DIR / GLOBAL_VRT_FILENAME
    dest_vrt = dest_dir / GLOBAL_VRT_FILENAME
    if (
        dest_dir != LOCAL_TERRAIN_DIR
        and local_vrt.is_file()
        and (not dest_vrt.is_file() or dest_vrt.read_bytes() != local_vrt.read_bytes())
    ):
        shutil.copy2(local_vrt, dest_vrt)


if __name__ == "__main__":
    main()
