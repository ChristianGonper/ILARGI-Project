"""Read lunar DEM metadata and elevations."""

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
SHARED_TERRAIN = Path.home() / ".ilargi" / "terrain"
_SHARED_POLAR = SHARED_TERRAIN / "LDEM_80S_80MPP_ADJ.TIF"
_SHARED_GLOBAL = SHARED_TERRAIN / "ldem_128.vrt"
POLAR = (
    _SHARED_POLAR if _SHARED_POLAR.is_file() else SAMPLE.with_name(_SHARED_POLAR.name)
)
GLOBAL = (
    _SHARED_GLOBAL
    if _SHARED_GLOBAL.is_file() and _SHARED_GLOBAL.with_suffix(".img").is_file()
    else SAMPLE.with_name(_SHARED_GLOBAL.name)
)


class TerrainCoverageError(ValueError):
    """The DEM has no usable terrain at or around the requested location."""


def raster_indices(dataset, x, y):
    """Return raster indices, wrapping longitude for complete cylindrical maps."""
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
    """Validate the lunar CRS and return vertical scale/offset in meters. GeoTIFFs without explicit vertical units must contain meter heights."""
    if dataset.crs is None:
        raise ValueError("DEM must declare a coordinate reference system")
    crs = CRS.from_user_input(dataset.crs)
    if not crs.is_projected or crs.geodetic_crs is None:
        raise ValueError("DEM must use a lunar projection")
    ellipsoid = crs.geodetic_crs.ellipsoid
    if (
        abs(ellipsoid.semi_major_metre - RADIUS_M) > 0.1
        or abs(ellipsoid.semi_minor_metre - RADIUS_M) > 0.1
    ):
        raise ValueError("DEM must use the 1737400 m lunar sphere")
    if len(crs.axis_info) < 2 or any(
        not np.isclose(axis.unit_conversion_factor, 1) for axis in crs.axis_info[:2]
    ):
        raise ValueError("DEM projected coordinates must be in meters")
    transform = dataset.transform
    if (
        abs(transform.b) > 1e-9
        or abs(transform.d) > 1e-9
        or transform.a <= 0
        or transform.e >= 0
    ):
        raise ValueError("DEM must be north-up with unrotated pixels")
    if not np.isclose(transform.a, -transform.e):
        raise ValueError("DEM pixels must be square")
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
        raise ValueError(f"Unsupported DEM vertical unit: {unit}")
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
    """Read the containing pixel in DE421 ME coordinates; no DE421-to-DE440 frame transformation is applied."""
    if not (np.isfinite(latitude_deg) and np.isfinite(longitude_deg)):
        raise ValueError("Coordinates must be finite")
    if not -90 <= latitude_deg <= 90 or not -180 <= longitude_deg <= 180:
        raise ValueError("Coordinates out of range")
    with rasterio.open(path) as dataset:
        crs, scale, offset = dem_metadata(dataset)
        transform = Transformer.from_crs(crs.geodetic_crs, crs, always_xy=True)
        x, y = transform.transform(longitude_deg, latitude_deg)
        row, col = raster_indices(dataset, x, y)
        if not (0 <= row < dataset.height and 0 <= col < dataset.width):
            raise TerrainCoverageError("Location is outside the available LOLA crop")
        pixel = dataset.read(1, window=((row, row + 1), (col, col + 1)), masked=True)
        if np.ma.is_masked(pixel[0, 0]) or not np.isfinite(pixel[0, 0]):
            raise TerrainCoverageError("LOLA crop has no data at this point")
        return TerrainSample(
            float(pixel[0, 0]) * scale + offset, x, y, abs(dataset.transform.a)
        )
