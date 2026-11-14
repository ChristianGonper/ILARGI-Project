"""Descarga y verificación de un conjunto explícito de kernels NAIF."""

from hashlib import sha256
from pathlib import Path
from urllib.request import urlopen

KERNEL_DIR = Path(__file__).resolve().parent.parent / "data" / "kernels"
BASE = "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/"
KERNELS = {
    "de440s.bsp": (
        "spk/planets/de440s.bsp",
        "c1c7feeab882263fc493a9d5a5b2ddd71b54826cdf65d8d17a76126b260a49f2",
    ),
    "naif0012.tls": (
        "lsk/naif0012.tls",
        "678e32bdb5a744117a467cd9601cd6b373f0e9bc9bbde1371d5eee39600a039b",
    ),
    "moon_pa_de440_200625.bpc": (
        "pck/moon_pa_de440_200625.bpc",
        "60cd55aa401ea2ea97360636f567554bfe4e37bb829f901b4460a455dfaf783f",
    ),
    "moon_de440_250416.tf": (
        "fk/satellites/moon_de440_250416.tf",
        "a47c71e9c9f33796bdafb2c9d69a7ee447b6016ecad80f71cd6f3e479f9cf768",
    ),
    "pck00011.tpc": (
        "pck/pck00011.tpc",
        "3dff7b1dbeceaa01f25467767d3fa25816051c85d162d1edf04acb310ee28bb1",
    ),
}


def digest(path: Path) -> str:
    with path.open("rb") as f:
        return sha256(f.read()).hexdigest()


def verify() -> None:
    for name, (_, expected) in KERNELS.items():
        path = KERNEL_DIR / name
        if not path.is_file() or digest(path) != expected:
            raise ValueError(
                f"Kernel ausente o incorrecto: {path}. Ejecuta uv run python -m ilargi.kernels"
            )


def download() -> None:
    KERNEL_DIR.mkdir(parents=True, exist_ok=True)
    for name, (url, expected) in KERNELS.items():
        path = KERNEL_DIR / name
        if path.is_file() and digest(path) == expected:
            print(f"Verificado: {name}")
            continue
        tmp = path.with_suffix(path.suffix + ".part")
        try:
            print(f"Descargando: {name}")
            with urlopen(BASE + url, timeout=120) as source, tmp.open("wb") as dest:
                while chunk := source.read(1024 * 1024):
                    dest.write(chunk)
            if digest(tmp) != expected:
                raise ValueError(f"SHA-256 incorrecto: {name}")
            tmp.replace(path)
        finally:
            tmp.unlink(missing_ok=True)


if __name__ == "__main__":
    download()
