"""Geometric J2000 mass-center vectors and serialized SPICE access."""

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
    """Load verified kernels and reserve SPICE for the duration of the block."""
    with _lock:
        load_kernels()
        yield


def require_aware_utc(instant: datetime) -> datetime:
    """Normalize timezone-aware input to the supported civil UTC interval."""
    if instant.tzinfo is None or instant.utcoffset() is None:
        raise ValueError("A timezone-aware date is required")
    utc = instant.astimezone(UTC)
    if not 1972 <= utc.year <= 2100:
        raise ValueError("Supported interval is 1972–2100 UTC")
    return utc


def utc_to_et(utc: datetime) -> float:
    """Convert UTC to ET/TDB seconds past J2000; kernels must already be loaded."""
    return float(spice.str2et(utc.strftime("%Y-%m-%d %H:%M:%S.%f UTC")))


def positions(instant: datetime, origin: str = "SUN") -> dict[str, np.ndarray]:
    """Return geometric mass-center vectors in J2000/ICRF with NONE correction."""
    utc = require_aware_utc(instant)
    origin = origin.upper()
    if origin not in {"SUN", "EARTH", "MOON"}:
        raise ValueError("Unsupported origin")
    with spice_session():
        et = utc_to_et(utc)
        return {
            body: np.zeros(3)
            if body == origin
            else spice.spkpos(body, et, "J2000", "NONE", origin)[0]
            for body in ("SUN", "EARTH", "MOON")
        }
