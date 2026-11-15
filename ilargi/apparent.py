"""Apparent Sun and Earth directions from ideal lunar surface observers."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime

import numpy as np
import spiceypy as spice

from ilargi.ephemeris import require_aware_utc, spice_session, utc_to_et
from ilargi.kernels import KERNEL_DIR

LUNAR_FRAME = "MOON_ME_DE440_ME421"
PA_FRAME = "MOON_PA_DE440"
IAU_FRAME = "IAU_MOON"
ABCORR = "LT+S"
OBSERVER_LOCUS = "OBSERVER"
OBSERVER_BODY = "MOON"
ADMITTED_TARGETS = ("EARTH", "SUN")
PA_FRAME_ID = 31008

DE421_RELATION = (
    "MOON_ME_DE440_ME421 approximates DE421 ME using a fixed NAIF rotation from "
    "MOON_PA_DE440. A DE421 orientation kernel is not loaded. LOLA uses DE421 ME. "
    "The lunar FK reports maximum frame differences of 3.071e-7 rad over 2000–2040 "
    "and 5.820e-7 rad over 1900–2051; these bounds were not recomputed here."
)
TERRAIN_STATEMENT = (
    "Ideal sphere from BODY301_RADII in pck00011.tpc; radial height above that sphere. "
    "This geometry module does not read a LOLA DEM or calculate a terrain horizon."
)

_coverage: tuple[float, float] | None = None
_radius_km: float | None = None


@dataclass(frozen=True)
class Provenance:
    """Frame, correction and model assumptions accompanying each result."""

    frame: str
    abcorr: str
    aberration_locus: str
    observer_kind: str
    reference_radius_km: float
    pa_to_frame_deg: float
    iau_moon_to_frame_deg: float
    terrain: str
    de421_relation: str


@dataclass(frozen=True)
class SurfaceSite:
    latitude_deg: float
    longitude_east_deg: float
    height_km: float
    radius_km: float
    position_km: tuple[float, float, float]


@dataclass(frozen=True)
class SurfaceTarget:
    """Apparent target direction relative to the surface observer."""

    target: str
    azimuth_deg: float
    elevation_deg: float
    position_km: tuple[float, float, float]
    topocentric_km: tuple[float, float, float]
    light_time_s: float
    range_km: float


@dataclass(frozen=True)
class LunarSurfaceApparent:
    utc: datetime
    et_seconds: float
    site: SurfaceSite
    targets: tuple[SurfaceTarget, ...]
    provenance: Provenance

    def target(self, name: str) -> SurfaceTarget:
        key = name.upper()
        for target in self.targets:
            if target.target == key:
                return target
        raise KeyError(key)


@dataclass(frozen=True)
class HorizontalAngles:
    """North-through-east azimuth and elevation above the spherical tangent plane."""

    azimuth_deg: float
    elevation_deg: float
    north_km: float
    east_km: float
    up_km: float


def reference_radius_km() -> float:
    """Return the spherical lunar radius from the constants PCK, in kilometers."""
    with spice_session():
        return _read_spherical_radius()


def horizontal_angles(
    direction_km: np.ndarray, latitude_deg: float, longitude_east_deg: float
) -> HorizontalAngles:
    """Project a lunar-frame vector onto analytic north/east/zenith axes; reject poles."""
    latitude = _latitude(latitude_deg)
    longitude = _longitude(longitude_east_deg)
    vector = np.array(direction_km, dtype=float)
    if (
        vector.shape != (3,)
        or not np.all(np.isfinite(vector))
        or np.linalg.norm(vector) == 0
    ):
        raise ValueError("Direction must be a finite nonzero vector")
    north, east, up = _topocentric_components(vector, latitude, longitude)
    horizontal = float(np.hypot(north, east))
    azimuth = float(np.rad2deg(np.arctan2(east, north)) % 360.0)
    if azimuth >= 360.0:
        azimuth = 0.0
    return HorizontalAngles(
        azimuth_deg=azimuth,
        elevation_deg=float(np.rad2deg(np.arctan2(up, horizontal))),
        north_km=north,
        east_km=east,
        up_km=up,
    )


def apparent_from_lunar_surface(
    instant: datetime,
    latitude_deg: float,
    longitude_east_deg: float,
    height_km: float = 0.0,
    targets: Sequence[str] = ADMITTED_TARGETS,
) -> LunarSurfaceApparent:
    """Compute LT+S directions with spkcpo at the body-fixed surface observer. Height is radial kilometers above the reference sphere."""
    utc = require_aware_utc(instant)
    names = _targets(targets)
    latitude = _latitude(latitude_deg)
    longitude = _longitude(longitude_east_deg)
    if not np.isfinite(height_km):
        raise ValueError("Height must be finite")
    with spice_session():
        et = utc_to_et(utc)
        _require_coverage(et)
        radius = _read_spherical_radius()
        if height_km <= -radius:
            raise ValueError("Height reaches or crosses the lunar center.")
        site_position = np.array(
            spice.georec(
                np.deg2rad(longitude), np.deg2rad(latitude), height_km, radius, 0.0
            ),
            dtype=float,
        )
        rows = []
        for name in names:
            state, light_time = spice.spkcpo(
                name,
                et,
                LUNAR_FRAME,
                OBSERVER_LOCUS,
                ABCORR,
                site_position,
                OBSERVER_BODY,
                LUNAR_FRAME,
            )
            position = np.array(state[:3], dtype=float)
            angles = horizontal_angles(position, latitude, longitude)
            rows.append(
                SurfaceTarget(
                    target=name,
                    azimuth_deg=angles.azimuth_deg,
                    elevation_deg=angles.elevation_deg,
                    position_km=_triplet(position),
                    topocentric_km=(angles.north_km, angles.east_km, angles.up_km),
                    light_time_s=float(light_time),
                    range_km=float(np.linalg.norm(position)),
                )
            )
        site = SurfaceSite(
            latitude,
            longitude,
            float(height_km),
            radius,
            _triplet(site_position),
        )
        provenance = _provenance(et, radius)
    return LunarSurfaceApparent(utc, et, site, tuple(rows), provenance)


def _provenance(et: float, radius: float) -> Provenance:
    return Provenance(
        frame=LUNAR_FRAME,
        abcorr=ABCORR,
        aberration_locus=OBSERVER_LOCUS,
        observer_kind="ideal-sphere",
        reference_radius_km=radius,
        pa_to_frame_deg=_rotation_deg(PA_FRAME, LUNAR_FRAME, et),
        iau_moon_to_frame_deg=_rotation_deg(IAU_FRAME, LUNAR_FRAME, et),
        terrain=TERRAIN_STATEMENT,
        de421_relation=DE421_RELATION,
    )


def _rotation_deg(origin: str, destination: str, et: float) -> float:
    _axis, angle = spice.raxisa(spice.pxform(origin, destination, et))
    return float(np.rad2deg(abs(angle)))


def _read_spherical_radius() -> float:
    global _radius_km
    if _radius_km is not None:
        return _radius_km
    _count, radii = spice.bodvrd(OBSERVER_BODY, "RADII", 3)
    radii = np.array(radii, dtype=float)
    if radii.shape != (3,) or not np.allclose(radii, radii[0], rtol=0.0, atol=1e-9):
        raise RuntimeError("BODY301_RADII is not spherical")
    _radius_km = float(radii[0])
    return _radius_km


def _coverage_bounds() -> tuple[float, float]:
    global _coverage
    if _coverage is not None:
        return _coverage
    starts: list[float] = []
    stops: list[float] = []
    spk = KERNEL_DIR / "de440s.bsp"
    for body in (10, 399, 301):
        start, stop = _single_window(spice.spkcov(str(spk), body), spk.name, body)
        starts.append(start)
        stops.append(stop)
    pck = KERNEL_DIR / "moon_pa_de440_200625.bpc"
    start, stop = _single_window(
        spice.pckcov(str(pck), PA_FRAME_ID), pck.name, PA_FRAME_ID
    )
    starts.append(start)
    stops.append(stop)
    _coverage = (max(starts), min(stops))
    return _coverage


def _single_window(cover: object, name: str, ident: int) -> tuple[float, float]:
    if spice.wncard(cover) != 1:
        raise RuntimeError(f"Unexpected coverage in {name} for {ident}")
    start, stop = spice.wnfetd(cover, 0)
    return float(start), float(stop)


def _require_coverage(et: float) -> None:
    start, stop = _coverage_bounds()
    if not start <= et <= stop:
        raise ValueError("Instant is outside common kernel coverage")


def _targets(targets: Sequence[str]) -> tuple[str, ...]:
    if isinstance(targets, str):
        raise TypeError("Targets must be a sequence of names, not a string")
    names = tuple(name.upper() for name in targets)
    if not names:
        raise ValueError("At least one target is required")
    if len(set(names)) != len(names):
        raise ValueError("Duplicate target")
    unknown = [name for name in names if name not in ADMITTED_TARGETS]
    if unknown:
        raise ValueError("Unsupported target")
    return names


def _latitude(value: float) -> float:
    if not np.isfinite(value):
        raise ValueError("Latitude must be finite")
    if abs(value) >= 90.0:
        raise ValueError(
            "Latitude must be in the open interval (-90, 90); "
            "local north is not unique at the pole"
        )
    return float(value)


def _longitude(value: float) -> float:
    if not np.isfinite(value):
        raise ValueError("Longitude must be finite")
    return float(value % 360.0)


def _topocentric_components(
    vector: np.ndarray, latitude_deg: float, longitude_east_deg: float
) -> tuple[float, float, float]:
    longitude = np.deg2rad(longitude_east_deg)
    latitude = np.deg2rad(latitude_deg)
    sin_lon, cos_lon = np.sin(longitude), np.cos(longitude)
    sin_lat, cos_lat = np.sin(latitude), np.cos(latitude)
    east = np.array([-sin_lon, cos_lon, 0.0])
    north = np.array([-sin_lat * cos_lon, -sin_lat * sin_lon, cos_lat])
    up = np.array([cos_lat * cos_lon, cos_lat * sin_lon, sin_lat])
    return (
        float(np.dot(north, vector)),
        float(np.dot(east, vector)),
        float(np.dot(up, vector)),
    )


def _triplet(vector: np.ndarray) -> tuple[float, float, float]:
    return (float(vector[0]), float(vector[1]), float(vector[2]))
