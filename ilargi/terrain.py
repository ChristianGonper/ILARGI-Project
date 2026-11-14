"""Muestra regional LOLA: consulta de alturas, sin cálculo de horizontes."""

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import rasterio
from pyproj import CRS, Transformer

SAMPLE = (
    Path(__file__).resolve().parent.parent
    / "data/terrain/lola_80m_south_pole_sample.tif"
)
RADIUS_M = 1_737_400.0
POLAR = SAMPLE.with_name("LDEM_80S_80MPP_ADJ.TIF")
GLOBAL = SAMPLE.with_name("ldem_128.vrt")


class TerrainCoverageError(ValueError):
    """The DEM has no usable terrain at or around the requested location."""


def raster_indices(dataset, x, y):
    """Índices proyectados; los mapas cilíndricos completos cierran en longitud."""
    cols = np.floor((np.asarray(x) - dataset.transform.c) / dataset.transform.a).astype(
        int
    )
    rows = np.floor((np.asarray(y) - dataset.transform.f) / dataset.transform.e).astype(
        int
    )
    if np.isclose(dataset.width * dataset.transform.a, 2 * np.pi * RADIUS_M, rtol=1e-5):
        cols = cols % dataset.width
    return rows, cols


def dem_metadata(dataset):
    """Valida la referencia y devuelve CRS, escala vertical y desplazamiento en metros.

    Para GeoTIFF sin unidad vertical explícita se exige por contrato altura en metros.
    """
    if dataset.crs is None:
        raise ValueError("El DEM debe indicar su sistema de coordenadas")
    crs = CRS.from_user_input(dataset.crs)
    if not crs.is_projected or crs.geodetic_crs is None:
        raise ValueError("El DEM debe usar una proyección lunar")
    ellipsoid = crs.geodetic_crs.ellipsoid
    if (
        abs(ellipsoid.semi_major_metre - RADIUS_M) > 0.1
        or abs(ellipsoid.semi_minor_metre - RADIUS_M) > 0.1
    ):
        raise ValueError("El DEM debe usar la esfera lunar de 1737400 m")
    if len(crs.axis_info) < 2 or any(
        not np.isclose(axis.unit_conversion_factor, 1) for axis in crs.axis_info[:2]
    ):
        raise ValueError("Las coordenadas proyectadas del DEM deben estar en metros")
    transform = dataset.transform
    if (
        abs(transform.b) > 1e-9
        or abs(transform.d) > 1e-9
        or transform.a <= 0
        or transform.e >= 0
    ):
        raise ValueError(
            "El DEM debe tener orientación norte arriba y píxeles sin rotar"
        )
    if not np.isclose(transform.a, -transform.e):
        raise ValueError("El DEM debe tener píxeles cuadrados")
    unit = (dataset.units[0] or "m").lower()
    units = {
        "m": 1.0,
        "metre": 1.0,
        "meter": 1.0,
        "km": 1000.0,
        "kilometre": 1000.0,
        "kilometer": 1000.0,
    }
    if unit not in units:
        raise ValueError(f"Unidad vertical del DEM no admitida: {unit}")
    return crs, dataset.scales[0] * units[unit], dataset.offsets[0] * units[unit]


@dataclass(frozen=True)
class TerrainSample:
    elevation_m: float
    x_m: float
    y_m: float
    pixel_size_m: float


def sample_elevation(
    latitude_deg: float, longitude_deg: float, path: Path = SAMPLE
) -> TerrainSample:
    """Obtiene el píxel que contiene el punto, en coordenadas planetocéntricas DE421 ME.

    No transforma entre la realización de DE421 y la aproximación ME de DE440.
    """
    if not (np.isfinite(latitude_deg) and np.isfinite(longitude_deg)):
        raise ValueError("Las coordenadas deben ser finitas")
    if not -90 <= latitude_deg <= 90 or not -180 <= longitude_deg <= 180:
        raise ValueError("Coordenadas fuera de rango")
    with rasterio.open(path) as dataset:
        crs, scale, offset = dem_metadata(dataset)
        transform = Transformer.from_crs(crs.geodetic_crs, crs, always_xy=True)
        x, y = transform.transform(longitude_deg, latitude_deg)
        row, col = raster_indices(dataset, x, y)
        if not (0 <= row < dataset.height and 0 <= col < dataset.width):
            raise TerrainCoverageError(
                "La ubicación queda fuera del recorte LOLA disponible"
            )
        pixel = dataset.read(1, window=((row, row + 1), (col, col + 1)), masked=True)
        if np.ma.is_masked(pixel[0, 0]) or not np.isfinite(pixel[0, 0]):
            raise TerrainCoverageError("El recorte LOLA no contiene datos en ese punto")
        return TerrainSample(
            float(pixel[0, 0]) * scale + offset, x, y, abs(dataset.transform.a)
        )
