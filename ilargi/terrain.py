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
        crs = CRS.from_user_input(dataset.crs)
        transform = Transformer.from_crs(crs.geodetic_crs, crs, always_xy=True)
        x, y = transform.transform(longitude_deg, latitude_deg)
        row, col = dataset.index(x, y)
        if not (0 <= row < dataset.height and 0 <= col < dataset.width):
            raise ValueError("La ubicación queda fuera del recorte LOLA disponible")
        pixel = dataset.read(1, window=((row, row + 1), (col, col + 1)), masked=True)
        if np.ma.is_masked(pixel[0, 0]) or not np.isfinite(pixel[0, 0]):
            raise ValueError("El recorte LOLA no contiene datos en ese punto")
        return TerrainSample(float(pixel[0, 0]), x, y, abs(dataset.transform.a))
