import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin

from ilargi.horizon import calculate_horizon
from ilargi.terrain import RADIUS_M, sample_elevation


def test_global_map_wraps_longitude_and_horizon_crosses_seam(tmp_path):
    path = tmp_path / "global.tif"
    pixel = 2 * np.pi * RADIUS_M / 3600
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=3600,
        height=1800,
        count=1,
        dtype="int16",
        crs="+proj=eqc +lon_0=180 +R=1737400 +units=m +type=crs",
        transform=from_origin(-np.pi * RADIUS_M, np.pi * RADIUS_M / 2, pixel, pixel),
    ) as ds:
        ds.write(np.zeros((1800, 3600), dtype="int16"), 1)
        ds.scales = (0.5,)
    assert sample_elevation(0, -0.01, path).elevation_m == 0
    assert sample_elevation(0, 0.01, path).elevation_m == 0
    profile = calculate_horizon(0, 0, 2, 20000, 10, path)
    assert np.all(profile.coverage_m >= 20000 - pixel)
    assert np.isfinite(profile.elevation_deg).all()
    assert profile.pixel_m == pytest.approx(pixel)
