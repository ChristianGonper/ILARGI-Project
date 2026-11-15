"""Download and verify official LOLA terrain products."""

import hashlib
import os
from pathlib import Path
from urllib.request import urlopen

from ilargi.terrain import GLOBAL, POLAR

PRODUCTS = (
    (
        POLAR,
        "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF",
        189158392,
        "82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a",
    ),
    (
        GLOBAL.with_suffix(".img"),
        "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_128.img",
        2123366400,
        "0e4fea9b863e3255f58de15ccbd2bb8b1e248cb09217fd55d23ed37489f764b4",
    ),
)


def digest(path: Path) -> str:
    sha = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            sha.update(chunk)
    return sha.hexdigest()


def download(path: Path, url: str, size: int, expected_hash: str) -> None:
    if path.exists() and path.stat().st_size == size and digest(path) == expected_hash:
        print(f"Already available: {path}")
        return
    part = path.with_suffix(path.suffix + ".part")
    print(f"Downloading {path.name} ({size / 1e9:.2f} GB)...", flush=True)
    with urlopen(url, timeout=60) as response, part.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    if part.stat().st_size != size or digest(part) != expected_hash:
        raise ValueError(f"Incomplete download or invalid SHA-256: {part}")
    os.replace(part, path)


def main() -> None:
    for product in PRODUCTS:
        download(*product)


if __name__ == "__main__":
    main()
