"""Direcciones aparentes de la Tierra y el Sol vistas desde la Luna.

Hay dos observadores distintos. El centro lunar es el punto de las efemérides
``MOON`` (301). El observador de superficie es un punto de una esfera ideal,
con latitud, longitud este y altura radial, y su dirección aparente se calcula
con ``spkcpo`` en el locus ``OBSERVER``. Ninguno de los dos lee un DEM.
"""

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
    "MOON_ME_DE440_ME421 es el giro fijo de NAIF desde MOON_PA_DE440 hacia el "
    "marco ME de DE421. No es la orientación de un kernel DE421: ese kernel no "
    "está cargado. LOLA referencia el ME de DE421. En moon_de440_250416.tf NAIF "
    "publica, entre ambas realizaciones, un giro máximo de 3.071e-7 rad "
    "(unos 53 cm de arco) en 2000–2040 y de 5.820e-7 rad (poco más de 1 m) en "
    "1900–2051. Esas cifras no se han recalculado aquí."
)
TERRAIN_STATEMENT = (
    "Esfera ideal tomada de BODY301_RADII en pck00011.tpc. La altura es radial "
    "sobre esa esfera. No se usa un DEM LOLA ni se calcula un horizonte topográfico."
)

_coverage: tuple[float, float] | None = None
_radius_km: float | None = None


@dataclass(frozen=True)
class Provenance:
    """Condiciones que acompañan a cada resultado y no deben separarse de él."""

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
class CenterTarget:
    """Estado aparente de un cuerpo respecto al centro de la Luna, en el marco lunar."""

    target: str
    position_km: tuple[float, float, float]
    light_time_s: float
    range_km: float


@dataclass(frozen=True)
class LunarCenterApparent:
    utc: datetime
    et_seconds: float
    targets: tuple[CenterTarget, ...]
    provenance: Provenance

    def target(self, name: str) -> CenterTarget:
        return _select(self.targets, name)


@dataclass(frozen=True)
class SurfaceSite:
    latitude_deg: float
    longitude_east_deg: float
    height_km: float
    radius_km: float
    position_km: tuple[float, float, float]


@dataclass(frozen=True)
class SurfaceTarget:
    """Dirección aparente respecto al punto de superficie, no respecto al centro."""

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
        return _select(self.targets, name)


@dataclass(frozen=True)
class HorizontalAngles:
    """Acimut desde el norte hacia el este y elevación sobre el horizonte local."""

    azimuth_deg: float
    elevation_deg: float
    north_km: float
    east_km: float
    up_km: float


def reference_radius_km() -> float:
    """Radio de la esfera lunar de ``pck00011``, en kilómetros."""
    global _radius_km
    with spice_session():
        if _radius_km is None:
            _radius_km = _read_spherical_radius()
        return _radius_km


def ephemeris_coverage_et() -> tuple[float, float]:
    """Intersección de la cobertura de DE440s y de la orientación lunar, en ET."""
    with spice_session():
        return _coverage_bounds()


def horizontal_angles(
    direction_km: np.ndarray, latitude_deg: float, longitude_east_deg: float
) -> HorizontalAngles:
    """Proyecta un vector del marco lunar al horizonte local de la esfera.

    El cenit es la normal exterior de la esfera en esa latitud y longitud.
    El acimut vale 0 hacia el norte y crece hacia el este. No admite los polos.
    """
    latitude = _latitude(latitude_deg)
    longitude = _longitude(longitude_east_deg)
    vector = np.array(direction_km, dtype=float)
    if (
        vector.shape != (3,)
        or not np.all(np.isfinite(vector))
        or np.linalg.norm(vector) == 0
    ):
        raise ValueError("La dirección debe ser un vector finito y no nulo")
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


def apparent_from_lunar_center(
    instant: datetime, targets: Sequence[str] = ADMITTED_TARGETS
) -> LunarCenterApparent:
    """Vectores aparentes LT+S de los objetivos vistos desde el centro de la Luna.

    Las componentes están en ``MOON_ME_DE440_ME421``. No hay acimut ni elevación:
    el centro no define un horizonte local. No es un punto de la superficie.
    """
    utc = require_aware_utc(instant)
    names = _targets(targets)
    with spice_session():
        et = utc_to_et(utc)
        _require_coverage(et)
        radius = _read_spherical_radius()
        rows = []
        for name in names:
            vector, light_time = spice.spkpos(
                name, et, LUNAR_FRAME, ABCORR, OBSERVER_BODY
            )
            position = _triplet(vector)
            rows.append(
                CenterTarget(
                    target=name,
                    position_km=position,
                    light_time_s=float(light_time),
                    range_km=float(np.linalg.norm(position)),
                )
            )
        provenance = _provenance(et, radius, "body-center", "body-center")
    return LunarCenterApparent(utc, et, tuple(rows), provenance)


def apparent_from_lunar_surface(
    instant: datetime,
    latitude_deg: float,
    longitude_east_deg: float,
    height_km: float = 0.0,
    targets: Sequence[str] = ADMITTED_TARGETS,
) -> LunarSurfaceApparent:
    """Acimut y elevación aparentes desde un punto de la esfera ideal.

    ``spkcpo`` evalúa el tiempo de luz y la aberración estelar en el punto, con
    locus ``OBSERVER``. La altura cero está sobre la esfera, a un radio lunar
    del centro; no reproduce al observador del centro.
    """
    utc = require_aware_utc(instant)
    names = _targets(targets)
    latitude = _latitude(latitude_deg)
    longitude = _longitude(longitude_east_deg)
    if not np.isfinite(height_km):
        raise ValueError("La altura debe ser finita")
    with spice_session():
        et = utc_to_et(utc)
        _require_coverage(et)
        radius = _read_spherical_radius()
        if height_km <= -radius:
            raise ValueError(
                "La altura alcanza el centro lunar o lo sobrepasa; "
                "ese observador es apparent_from_lunar_center"
            )
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
        provenance = _provenance(et, radius, "ideal-sphere", OBSERVER_LOCUS)
    return LunarSurfaceApparent(utc, et, site, tuple(rows), provenance)


def _provenance(et: float, radius: float, kind: str, locus: str) -> Provenance:
    return Provenance(
        frame=LUNAR_FRAME,
        abcorr=ABCORR,
        aberration_locus=locus,
        observer_kind=kind,
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
        raise RuntimeError(
            "BODY301_RADII no es una esfera; no se interpretará como esfera ideal"
        )
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
        raise RuntimeError(f"Cobertura inesperada en {name} para {ident}")
    start, stop = spice.wnfetd(cover, 0)
    return float(start), float(stop)


def _require_coverage(et: float) -> None:
    start, stop = _coverage_bounds()
    if not start <= et <= stop:
        raise ValueError("El instante queda fuera de la cobertura común de los kernels")


def _targets(targets: Sequence[str]) -> tuple[str, ...]:
    if isinstance(targets, str):
        raise TypeError(
            "Los objetivos se indican con una secuencia de nombres, no con una cadena"
        )
    names = tuple(name.upper() for name in targets)
    if not names:
        raise ValueError("Se requiere al menos un objetivo")
    if len(set(names)) != len(names):
        raise ValueError("Objetivo repetido")
    unknown = [name for name in names if name not in ADMITTED_TARGETS]
    if unknown:
        raise ValueError("Objetivo no admitido")
    return names


def _latitude(value: float) -> float:
    if not np.isfinite(value):
        raise ValueError("La latitud debe ser finita")
    if abs(value) >= 90.0:
        raise ValueError(
            "La latitud debe estar en el intervalo abierto (-90, 90); "
            "en el polo el norte local no es único"
        )
    return float(value)


def _longitude(value: float) -> float:
    if not np.isfinite(value):
        raise ValueError("La longitud debe ser finita")
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


def _select(targets: tuple[CenterTarget, ...] | tuple[SurfaceTarget, ...], name: str):
    key = name.upper()
    for target in targets:
        if target.target == key:
            return target
    raise KeyError(key)
