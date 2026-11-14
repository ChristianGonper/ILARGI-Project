"""Horizonte experimental de un DEM esférico lunar, con cobertura explícita."""

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.windows import Window

from ilargi.terrain import (
    RADIUS_M,
    SAMPLE,
    TerrainCoverageError,
    dem_metadata,
    raster_indices,
    sample_elevation,
)

# Extremos globales LOLA respecto a la esfera de referencia de 1 737 400 m:
# cumbre selene (+10 792 m, borde de Engel'gardt) y suelo de Antoniadi (-9 129 m).
LUNAR_MAX_ELEVATION_M = 10_792.0
LUNAR_MIN_ELEVATION_M = -9_129.0


@dataclass(frozen=True)
class Horizon:
    azimuth_deg: np.ndarray
    elevation_deg: np.ndarray
    coverage_m: np.ndarray
    requested_m: float
    pixel_m: float
    ground_m: float
    observer_m: float
    physical_max_m: float | None = None
    required_m: np.ndarray | None = None


@dataclass(frozen=True)
class SearchRadiusEstimate:
    observer_m: float
    max_terrain_m: float
    min_terrain_m: float
    tangent_plane_m: float
    spherical_horizon_m: float
    required_m: float | np.ndarray


def max_search_distance_m(
    observer_m: float,
    max_terrain_m: float = LUNAR_MAX_ELEVATION_M,
    min_elevation_deg: float | np.ndarray | None = None,
    min_terrain_m: float = LUNAR_MIN_ELEVATION_M,
    radius_m: float = RADIUS_M,
) -> float | np.ndarray:
    """Distancia máxima de arco sobre la esfera más allá de la cual ningún obstáculo <= max_terrain_m ocluye.

    Sin ``min_elevation_deg`` devuelve la cota física absoluta: el rayo rasante
    a ``min_terrain_m`` hasta cortar ``max_terrain_m``. Con ``min_elevation_deg``
    resuelve exactamente la intersección esférica ``r * cos(alpha + theta) = r_obs * cos(alpha)``
    (que a 0° coincide con el plano tangente) y, si ``alpha`` queda por debajo
    del ángulo rasante a ``min_terrain_m``, satura monótonamente en la cota física absoluta.
    """
    if not (
        np.isfinite(radius_m)
        and radius_m > 0
        and np.isfinite(observer_m)
        and np.isfinite(max_terrain_m)
        and np.isfinite(min_terrain_m)
    ):
        raise ValueError("Parámetros geométricos no finitos o radio no positivo")
    r_obs = float(radius_m + observer_m)
    r_max = float(radius_m + max_terrain_m)
    r_min = float(radius_m + min_terrain_m)
    if r_obs <= 0 or r_max <= 0 or r_min <= 0:
        raise ValueError("Los radios del observador y del relieve deben ser positivos")
    if r_min > r_max:
        raise ValueError("min_terrain_m no puede superar a max_terrain_m")

    def _worst_case_theta() -> float:
        if r_obs < r_min:
            raise ValueError(
                "La altura del observador no puede ser inferior a min_terrain_m"
            )
        theta_1 = float(np.arccos(np.clip(r_min / r_obs, -1.0, 1.0)))
        theta_2 = float(np.arccos(np.clip(r_min / r_max, -1.0, 1.0)))
        return min(theta_1 + theta_2, float(np.pi))

    if min_elevation_deg is None:
        return float(radius_m * _worst_case_theta())

    scalar_input = np.ndim(min_elevation_deg) == 0
    angles_deg = np.asarray(min_elevation_deg, dtype=float)
    non_nan = ~np.isnan(angles_deg)
    if np.any(
        non_nan
        & ((~np.isfinite(angles_deg)) | (angles_deg <= -90.0) | (angles_deg >= 90.0))
    ):
        raise ValueError("min_elevation_deg debe estar en (-90, 90)")

    alpha = np.deg2rad(angles_deg)
    r_peri = r_obs * np.cos(alpha)
    min_forward_r = np.where(alpha >= 0.0, r_obs, r_peri)
    theta = np.zeros_like(alpha, dtype=float)

    needs_worst = np.isnan(angles_deg)
    if np.any(needs_worst):
        theta[needs_worst] = _worst_case_theta()

    active = non_nan & ((min_forward_r < r_max) | ((alpha < 0.0) & (r_peri <= r_max)))
    below_grazing = active & (alpha < 0.0) & (r_peri < r_min)
    if np.any(below_grazing):
        theta[below_grazing] = _worst_case_theta()
    reaches_max = active & (~below_grazing)

    if np.any(reaches_max):
        theta[reaches_max] = (
            np.arccos(np.clip(r_peri[reaches_max] / r_max, -1.0, 1.0))
            - alpha[reaches_max]
        )

    distances = radius_m * np.clip(theta, 0.0, np.pi)
    if scalar_input:
        return float(distances)
    return distances


def estimate_search_radius(
    observer_m: float,
    max_terrain_m: float = LUNAR_MAX_ELEVATION_M,
    min_elevation_deg: float | np.ndarray | None = None,
    min_terrain_m: float = LUNAR_MIN_ELEVATION_M,
    radius_m: float = RADIUS_M,
) -> SearchRadiusEstimate:
    """Resume la cota del plano tangente (0°), la cota esférica completa y la requerida."""
    tangent_plane = float(
        max_search_distance_m(
            observer_m,
            max_terrain_m=max_terrain_m,
            min_elevation_deg=0.0,
            min_terrain_m=min_terrain_m,
            radius_m=radius_m,
        )
    )
    spherical_horizon = float(
        max_search_distance_m(
            observer_m,
            max_terrain_m=max_terrain_m,
            min_elevation_deg=None,
            min_terrain_m=min_terrain_m,
            radius_m=radius_m,
        )
    )
    required = (
        spherical_horizon
        if min_elevation_deg is None
        else max_search_distance_m(
            observer_m,
            max_terrain_m=max_terrain_m,
            min_elevation_deg=min_elevation_deg,
            min_terrain_m=min_terrain_m,
            radius_m=radius_m,
        )
    )
    return SearchRadiusEstimate(
        observer_m=float(observer_m),
        max_terrain_m=float(max_terrain_m),
        min_terrain_m=float(min_terrain_m),
        tangent_plane_m=tangent_plane,
        spherical_horizon_m=spherical_horizon,
        required_m=required,
    )


def _sample_dem_rays(
    latitude: float,
    longitude: float,
    observer_m: float,
    max_distance_m: float,
    azimuth_step_deg: float,
    path: Path,
    min_distance_by_az: np.ndarray | None = None,
    max_distance_by_az: np.ndarray | None = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, float, float]:
    """Evalúa rayos radiales sobre un único DEM para una posición observadora dada."""
    with rasterio.open(path) as ds:
        crs, scale, offset = dem_metadata(ds)
        pixel = abs(ds.transform.a)
        if not np.isclose(pixel, abs(ds.transform.e)) or pixel <= 0:
            raise ValueError("El DEM debe tener píxeles cuadrados")
        n_az = int(np.ceil(360 / azimuth_step_deg))
        n_distance = int(np.floor((max_distance_m + 0.001) / pixel))
        if n_distance == 0:
            raise ValueError("La distancia debe superar la resolución del DEM")
        if n_az * n_distance > 4_000_000:
            raise ValueError(
                "Demasiadas muestras de horizonte; aumenta el paso angular o reduce la distancia"
            )
        az = np.arange(n_az) * 360 / n_az
        distance = np.arange(1, n_distance + 1) * pixel
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
        rows, cols = raster_indices(ds, x, y)

        in_ring = np.ones((n_az, n_distance), dtype=bool)
        if min_distance_by_az is not None:
            in_ring &= distance[None, :] > min_distance_by_az[:, None]
        if max_distance_by_az is not None:
            in_ring &= distance[None, :] <= max_distance_by_az[:, None] + 0.001

        in_bounds = (
            in_ring & (rows >= 0) & (rows < ds.height) & (cols >= 0) & (cols < ds.width)
        )
        if not np.any(in_bounds):
            empty = np.full(n_az, np.nan)
            return az, empty, np.zeros(n_az), pixel, np.nan
        # Leer bloques visitados evita una ventana global al cruzar 0°/360°.
        heights = np.full(rows.shape, np.nan)
        block_h, block_w = ds.block_shapes[0]
        # Limitar bloques de imágenes sin teselas (como VRT de datos PDS).
        block_h, block_w = min(block_h, 256), min(block_w, 256)
        rr, cc = rows[in_bounds], cols[in_bounds]
        block_ids = (rr // block_h) * (
            (ds.width + block_w - 1) // block_w
        ) + cc // block_w
        values = np.empty(len(rr), dtype=float)
        for block in np.unique(block_ids):
            selected = block_ids == block
            r0 = int(rr[selected][0] // block_h * block_h)
            c0 = int(cc[selected][0] // block_w * block_w)
            grid = (
                ds.read(
                    1,
                    window=Window(
                        c0,
                        r0,
                        min(block_w, ds.width - c0),
                        min(block_h, ds.height - r0),
                    ),
                    masked=True,
                )
                .astype(float)
                .filled(np.nan)
            )
            values[selected] = (
                grid[rr[selected] - r0, cc[selected] - c0] * scale + offset
            )
        heights[in_bounds] = values
        obs_x, obs_y = transformer.transform(longitude, latitude)
        observer_row, observer_col = raster_indices(ds, obs_x, obs_y)

    # Un hueco de datos interrumpe el rayo: no tratar terreno posterior como continuo.
    # Las celdas fuera del anillo solicitado (antes de min_distance) no interrumpen el rayo.
    if min_distance_by_az is not None:
        active_or_past = distance[None, :] > min_distance_by_az[:, None]
        if max_distance_by_az is not None:
            active_or_past &= distance[None, :] <= max_distance_by_az[:, None] + 0.001
        step_ok = np.where(active_or_past, np.isfinite(heights), True)
        valid = active_or_past & np.logical_and.accumulate(step_ok, axis=1)
    else:
        valid = np.isfinite(heights) & np.logical_and.accumulate(
            np.isfinite(heights), axis=1
        )
    up = (RADIUS_M + heights) * np.cos(theta) - (RADIUS_M + observer_m)
    horizontal = (RADIUS_M + heights) * np.sin(theta)
    obstacle = valid & ((rows != observer_row) | (cols != observer_col))
    angles = np.where(obstacle, np.rad2deg(np.arctan2(up, horizontal)), -np.inf)
    horizon = angles.max(axis=1)
    horizon[~np.isfinite(horizon)] = np.nan
    coverage = np.where(valid, distance[None, :], 0.0).max(axis=1)
    return az, horizon, coverage, pixel, float(observer_m)


def calculate_horizon(
    latitude: float,
    longitude: float,
    instrument_height_m: float = 2.0,
    max_distance_m: float | None = 20_000.0,
    azimuth_step_deg: float = 2.0,
    path: Path = SAMPLE,
    max_terrain_m: float = LUNAR_MAX_ELEVATION_M,
    min_terrain_m: float = LUNAR_MIN_ELEVATION_M,
) -> Horizon:
    """Muestrea rayos radiales sobre la esfera; no extrapola más allá del DEM.

    Las coordenadas se tratan en DE421 ME como aproximación de DE440 ME421.
    Las cotas son m sobre la esfera de 1737400 m; no interpolamos el DEM.
    Si ``max_distance_m`` es ``None`` o supera el radio físico máximo de oclusión
    para ``[min_terrain_m, max_terrain_m]``, la búsqueda se acota automáticamente
    a ese radio físico.
    """
    if not 0 <= instrument_height_m <= 1000:
        raise ValueError("Altura o distancia de búsqueda fuera de rango")
    if max_distance_m is not None and not 500 <= max_distance_m <= 1_000_000:
        raise ValueError("Altura o distancia de búsqueda fuera de rango")
    if not 0 < azimuth_step_deg <= 10 or abs(latitude) >= 90:
        raise ValueError("Paso angular o latitud fuera de rango")
    ground = sample_elevation(latitude, longitude, path)
    observer = ground.elevation_m + instrument_height_m
    eff_min = min(float(min_terrain_m), observer)
    eff_max = max(float(max_terrain_m), observer)
    physical_max = float(
        max_search_distance_m(
            observer,
            max_terrain_m=eff_max,
            min_terrain_m=eff_min,
        )
    )
    effective_requested = (
        physical_max
        if max_distance_m is None
        else min(float(max_distance_m), physical_max)
    )
    az, horizon, coverage, pixel, _ = _sample_dem_rays(
        latitude, longitude, observer, effective_requested, azimuth_step_deg, path
    )
    if np.all(np.isnan(horizon)):
        raise TerrainCoverageError("El DEM no cubre los rayos alrededor del lugar")
    required = np.asarray(
        max_search_distance_m(
            observer,
            max_terrain_m=eff_max,
            min_elevation_deg=horizon,
            min_terrain_m=eff_min,
        ),
        dtype=float,
    )
    return Horizon(
        az,
        horizon,
        coverage,
        effective_requested,
        pixel,
        ground.elevation_m,
        observer,
        physical_max_m=physical_max,
        required_m=required,
    )


def calculate_multiresolution_horizon(
    latitude: float,
    longitude: float,
    instrument_height_m: float = 2.0,
    fine_distance_m: float | None = None,
    max_distance_m: float | None = None,
    azimuth_step_deg: float = 2.0,
    fine_path: Path = SAMPLE,
    coarse_path: Path = SAMPLE,
    max_terrain_m: float = LUNAR_MAX_ELEVATION_M,
    min_terrain_m: float = LUNAR_MIN_ELEVATION_M,
) -> Horizon:
    """Combina un DEM fino cercano con uno más grueso hasta el radio físico por acimut.

    Primero evalúa el DEM fino para obtener la cota del observador y una cota
    inferior garantizada de elevación por acimut. Con esa cota calcula el radio
    restante ``max_search_distance_m`` más allá del cual ningún relieve <= ``max_terrain_m``
    puede superar el obstáculo ya hallado, y prolonga en el DEM grueso solo las
    direcciones aún abiertas.
    """
    if not 0 <= instrument_height_m <= 1000:
        raise ValueError("Altura o distancia de búsqueda fuera de rango")
    if fine_distance_m is not None and not 500 <= fine_distance_m <= 1_000_000:
        raise ValueError("Altura o distancia de búsqueda fuera de rango")
    if max_distance_m is not None and not 500 <= max_distance_m <= 1_000_000:
        raise ValueError("Altura o distancia de búsqueda fuera de rango")
    if not 0 < azimuth_step_deg <= 10 or abs(latitude) >= 90:
        raise ValueError("Paso angular o latitud fuera de rango")

    ground = sample_elevation(latitude, longitude, fine_path)
    observer = ground.elevation_m + instrument_height_m
    eff_min = min(float(min_terrain_m), observer)
    eff_max = max(float(max_terrain_m), observer)
    physical_max = float(
        max_search_distance_m(
            observer,
            max_terrain_m=eff_max,
            min_terrain_m=eff_min,
        )
    )
    overall_requested = (
        physical_max
        if max_distance_m is None
        else min(float(max_distance_m), physical_max)
    )
    fine_requested = (
        overall_requested
        if fine_distance_m is None
        else min(float(fine_distance_m), overall_requested)
    )

    az, fine_elev, fine_cov, fine_pixel, _ = _sample_dem_rays(
        latitude, longitude, observer, fine_requested, azimuth_step_deg, fine_path
    )
    if np.all(np.isnan(fine_elev)):
        raise TerrainCoverageError("El DEM fino no cubre los rayos alrededor del lugar")

    az_cutoff = np.asarray(
        max_search_distance_m(
            observer,
            max_terrain_m=eff_max,
            min_elevation_deg=fine_elev,
            min_terrain_m=eff_min,
        ),
        dtype=float,
    )
    az_cutoff = np.minimum(az_cutoff, overall_requested)

    need_far = fine_cov < az_cutoff
    if np.any(need_far):
        far_max = float(np.max(az_cutoff[need_far]))
        _, coarse_elev, coarse_cov, _, _ = _sample_dem_rays(
            latitude,
            longitude,
            observer,
            far_max,
            azimuth_step_deg,
            coarse_path,
            min_distance_by_az=np.where(need_far, fine_cov, far_max + 1.0),
            max_distance_by_az=np.where(need_far, az_cutoff, 0.0),
        )
        merged_elev = np.fmax(fine_elev, coarse_elev)
        merged_cov = np.maximum(fine_cov, coarse_cov)
    else:
        merged_elev = fine_elev
        merged_cov = fine_cov

    required = np.asarray(
        max_search_distance_m(
            observer,
            max_terrain_m=eff_max,
            min_elevation_deg=merged_elev,
            min_terrain_m=eff_min,
        ),
        dtype=float,
    )
    return Horizon(
        az,
        merged_elev,
        merged_cov,
        overall_requested,
        fine_pixel,
        ground.elevation_m,
        observer,
        physical_max_m=physical_max,
        required_m=required,
    )


def horizon_at(profile: Horizon, azimuth_deg: np.ndarray) -> np.ndarray:
    """Interpolación circular, únicamente donde ambos rayos vecinos tienen datos."""
    az = np.append(profile.azimuth_deg, 360.0)
    elev = np.append(profile.elevation_deg, profile.elevation_deg[0])
    values = np.asarray(azimuth_deg) % 360
    left = np.minimum(
        np.searchsorted(az, values, side="right") - 1, len(profile.azimuth_deg) - 1
    )
    interpolated = np.interp(values, az, elev)
    return np.where(
        np.isfinite(elev[left]) & np.isfinite(elev[left + 1]), interpolated, np.nan
    )


def coverage_at(profile: Horizon, azimuth_deg: np.ndarray) -> np.ndarray:
    """Alcance común conservador de los rayos que rodean cada dirección."""
    az = np.append(profile.azimuth_deg, 360.0)
    coverage = np.append(profile.coverage_m, profile.coverage_m[0])
    left = np.minimum(
        np.searchsorted(az, np.asarray(azimuth_deg) % 360, side="right") - 1,
        len(profile.azimuth_deg) - 1,
    )
    return np.minimum(coverage[left], coverage[left + 1])
