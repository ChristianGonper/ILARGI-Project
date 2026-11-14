"""Malla local LOLA para visualización; no altera el terreno de los análisis."""

import numpy as np
import rasterio
from pyproj import CRS, Transformer

from ilargi.terrain import (
    GLOBAL,
    POLAR,
    RADIUS_M,
    SAMPLE,
    dem_metadata,
    raster_indices,
    sample_elevation,
)


def terrain_patch(latitude: float, longitude: float, width_km: float = 10) -> dict:
    """Cuadrícula equidistante local, con huecos explícitos y un único DEM.

    Coordenadas planetocéntricas ME DE421. La proyección conserva distancia y
    dirección desde el centro; no se presenta como una transformación DE440.
    Muestrea el píxel original más cercano, sin inventar detalle intermedio.
    """
    if not np.isfinite([latitude, longitude, width_km]).all():
        raise ValueError("Las coordenadas y el tamaño deben ser finitos")
    if not -90 <= latitude <= 90 or not -180 <= longitude <= 360:
        raise ValueError("Coordenadas fuera de rango")
    if not 2 <= width_km <= 20:
        raise ValueError("El tamaño debe estar entre 2 y 20 km")
    longitude = (longitude + 180) % 360 - 180
    candidates = [
        SAMPLE.with_name("lola_20m_south_pole_sample.tif"),
        SAMPLE,
        POLAR,
        GLOBAL,
    ]
    for path in candidates:
        try:
            center = sample_elevation(latitude, longitude, path)
        except (ValueError, rasterio.errors.RasterioIOError):
            continue
        with rasterio.open(path) as dataset:
            crs, scale, offset = dem_metadata(dataset)
            local = CRS.from_proj4(
                f"+proj=aeqd +lat_0={latitude} +lon_0={longitude} +R={RADIUS_M} +units=m"
            )
            # Limit transfer and mesh size; never imply finer sampling than source.
            count = min(129, max(3, int(width_km * 1000 / center.pixel_size_m) + 1))
            count -= (
                count + 1
            ) % 2  # Odd grid places the selected point at its center.
            axis = np.linspace(-width_km * 500, width_km * 500, count)
            east, north = np.meshgrid(axis, axis[::-1])
            x, y = Transformer.from_crs(local, crs, always_xy=True).transform(
                east, north
            )
            rows, cols = raster_indices(dataset, x, y)
            valid = (
                (rows >= 0)
                & (rows < dataset.height)
                & (cols >= 0)
                & (cols < dataset.width)
            )
            heights = np.full(east.shape, np.nan)
            # Sampling pixel centers also handles the cylindrical longitude seam.
            xs, ys = rasterio.transform.xy(dataset.transform, rows[valid], cols[valid])
            values = np.ma.array(
                list(dataset.sample(zip(xs, ys, strict=True), masked=True))
            )[:, 0]
            heights[valid] = np.ma.filled(values.astype(float), np.nan) * scale + offset
            finite = np.isfinite(heights)
            return {
                "source": path.name,
                "frame": "MOON_ME_DE421",
                "pixel_size_m": center.pixel_size_m,
                "width_km": width_km,
                "size": count,
                "spacing_m": float(axis[1] - axis[0]),
                "center_elevation_m": center.elevation_m,
                "min_elevation_m": float(np.min(heights[finite])),
                "max_elevation_m": float(np.max(heights[finite])),
                "coverage_fraction": float(np.mean(finite)),
                "heights_m": [
                    float(h) if np.isfinite(h) else None for h in heights.flat
                ],
            }
    raise ValueError(
        "No hay un DEM disponible para esta ubicación. Prueba la muestra LOLA del polo sur o descarga los DEM completos."
    )
