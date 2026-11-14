"""Posiciones geométricas simultáneas en J2000, en kilómetros."""

from contextlib import contextmanager
from datetime import UTC, datetime
from threading import RLock

import numpy as np
import spiceypy as spice

from ilargi.kernels import KERNEL_DIR, KERNELS, verify

_lock = RLock()
_loaded = False


def load_kernels() -> None:
    global _loaded
    with _lock:
        if not _loaded:
            verify()
            for name in KERNELS:
                spice.furnsh(str(KERNEL_DIR / name))
            _loaded = True


@contextmanager
def spice_session():
    """Carga los kernels verificados y reserva SPICE durante el bloque."""
    with _lock:
        load_kernels()
        yield


def require_aware_utc(instant: datetime) -> datetime:
    """Devuelve el instante en UTC o rechaza una fecha ambigua o fuera de cobertura."""
    if instant.tzinfo is None or instant.utcoffset() is None:
        raise ValueError("Se requiere una fecha con zona horaria explícita")
    utc = instant.astimezone(UTC)
    if not 1972 <= utc.year <= 2100:
        raise ValueError("El intervalo admitido es 1972–2100 UTC")
    return utc


def utc_to_et(utc: datetime) -> float:
    """Segundos ET/TDB desde J2000. Los kernels, incluido el LSK, deben estar cargados."""
    return float(spice.str2et(utc.strftime("%Y-%m-%d %H:%M:%S.%f UTC")))


def positions(instant: datetime, origin: str = "SUN") -> dict[str, np.ndarray]:
    """Vectores geométricos de los centros de masa, relativos a origin.

    J2000 en SPICE está alineado con ICRF para estas efemérides JPL.
    No son posiciones aparentes ni observaciones desde la superficie.
    """
    if instant.tzinfo is None or instant.utcoffset() is None:
        raise ValueError("Se requiere una fecha con zona horaria explícita")
    origin = origin.upper()
    if origin not in {"SUN", "EARTH", "MOON"}:
        raise ValueError("Origen no admitido")
    utc = instant.astimezone(UTC)
    if not 1972 <= utc.year <= 2100:
        raise ValueError("El intervalo admitido es 1972–2100 UTC")
    with spice_session():
        et = utc_to_et(utc)
        return {
            body: np.zeros(3)
            if body == origin
            else spice.spkpos(body, et, "J2000", "NONE", origin)[0]
            for body in ("SUN", "EARTH", "MOON")
        }
