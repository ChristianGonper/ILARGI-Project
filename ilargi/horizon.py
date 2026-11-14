"""Horizonte experimental de un DEM esférico lunar, con cobertura explícita."""

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import rasterio
from pyproj import CRS, Transformer
from rasterio.windows import Window

from ilargi.terrain import SAMPLE, sample_elevation

RADIUS_M = 1_737_400.0


@dataclass(frozen=True)
class Horizon:
    azimuth_deg: np.ndarray
    elevation_deg: np.ndarray
    coverage_m: np.ndarray
    requested_m: float
    pixel_m: float
    ground_m: float
    observer_m: float


def calculate_horizon(
    latitude: float,
    longitude: float,
    instrument_height_m: float = 2.0,
    max_distance_m: float = 20_000.0,
    azimuth_step_deg: float = 2.0,
    path: Path = SAMPLE,
) -> Horizon:
    """Muestrea rayos radiales sobre la esfera; no extrapola más allá del DEM.

    Las coordenadas se tratan en DE421 ME como aproximación de DE440 ME421.
    Las cotas son m sobre la esfera de 1737400 m; no interpolamos el DEM.
    """
    if not 0 <= instrument_height_m <= 1000 or not 500 <= max_distance_m <= 100_000:
        raise ValueError("Altura o distancia de búsqueda fuera de rango")
    if not 0 < azimuth_step_deg <= 10 or abs(latitude) >= 90:
        raise ValueError("Paso angular o latitud fuera de rango")
    ground = sample_elevation(latitude, longitude, path)
    with rasterio.open(path) as ds:
        crs = CRS.from_user_input(ds.crs)
        if (
            not crs.is_projected
            or abs(crs.geodetic_crs.ellipsoid.semi_major_metre - RADIUS_M) > 0.1
        ):
            raise ValueError("El DEM debe usar proyección lunar y esfera de 1737400 m")
        if abs(ds.transform.b) > 1e-9 or abs(ds.transform.d) > 1e-9:
            raise ValueError("No se admiten DEM con píxeles girados")
        pixel = abs(ds.transform.a)
        if not np.isclose(pixel, abs(ds.transform.e)) or pixel <= 0:
            raise ValueError("El DEM debe tener píxeles cuadrados")
        n_az = int(np.ceil(360 / azimuth_step_deg))
        az = np.arange(n_az) * 360 / n_az
        distance = np.arange(pixel, max_distance_m + 0.001, pixel)
        if distance.size == 0:
            raise ValueError("La distancia debe superar la resolución del DEM")
        a = np.deg2rad(az)[:, None]
        theta = distance[None, :] / RADIUS_M
        lat = np.deg2rad(latitude)
        lon = np.deg2rad(longitude)
        lat2 = np.arcsin(
            np.clip(
                np.sin(lat) * np.cos(theta) + np.cos(lat) * np.sin(theta) * np.cos(a),
                -1,
                1,
            )
        )
        lon2 = lon + np.arctan2(
            np.sin(a) * np.sin(theta) * np.cos(lat),
            np.cos(theta) - np.sin(lat) * np.sin(lat2),
        )
        transformer = Transformer.from_crs(crs.geodetic_crs, crs, always_xy=True)
        x, y = transformer.transform(np.rad2deg(lon2), np.rad2deg(lat2))
        cols = np.floor((x - ds.transform.c) / ds.transform.a).astype(int)
        rows = np.floor((y - ds.transform.f) / ds.transform.e).astype(int)
        in_bounds = (rows >= 0) & (rows < ds.height) & (cols >= 0) & (cols < ds.width)
        if not np.any(in_bounds):
            raise ValueError("El DEM no cubre los rayos alrededor del lugar")
        r0, r1 = rows[in_bounds].min(), rows[in_bounds].max() + 1
        c0, c1 = cols[in_bounds].min(), cols[in_bounds].max() + 1
        if (r1 - r0) * (c1 - c0) > 16_000_000:
            raise ValueError(
                "El área solicitada supera el límite de memoria; reduce la distancia o usa un DEM más grueso"
            )
        grid = ds.read(1, window=Window(c0, r0, c1 - c0, r1 - r0), masked=True).filled(
            np.nan
        )
        heights = np.full(rows.shape, np.nan)
        heights[in_bounds] = grid[rows[in_bounds] - r0, cols[in_bounds] - c0]
    # Un hueco de datos interrumpe el rayo: no tratar terreno posterior como continuo.
    valid = np.isfinite(heights) & np.logical_and.accumulate(
        np.isfinite(heights), axis=1
    )
    observer = ground.elevation_m + instrument_height_m
    up = (RADIUS_M + heights) * np.cos(theta) - (RADIUS_M + observer)
    horizontal = (RADIUS_M + heights) * np.sin(theta)
    angles = np.where(valid, np.rad2deg(np.arctan2(up, horizontal)), -np.inf)
    horizon = angles.max(axis=1)
    horizon[~np.isfinite(horizon)] = np.nan
    coverage = np.where(valid, distance[None, :], 0).max(axis=1)
    return Horizon(
        az, horizon, coverage, max_distance_m, pixel, ground.elevation_m, observer
    )


def horizon_at(profile: Horizon, azimuth_deg: np.ndarray) -> np.ndarray:
    """Interpolación circular, únicamente donde ambos rayos vecinos tienen datos."""
    az = np.append(profile.azimuth_deg, 360.0)
    elev = np.append(profile.elevation_deg, profile.elevation_deg[0])
    return np.interp(np.asarray(azimuth_deg) % 360, az, elev)
