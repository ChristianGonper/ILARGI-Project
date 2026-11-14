import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin

from ilargi.horizon import RADIUS_M, calculate_horizon, horizon_at
from ilargi.terrain import SAMPLE


def make_dem(path, ridge=False):
    with rasterio.open(SAMPLE) as src:
        crs = src.crs
    data = np.zeros((240, 240), dtype="float32")
    if ridge:
        data[80:100, 115:125] = 200.0
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        height=240,
        width=240,
        count=1,
        dtype="float32",
        crs=crs,
        transform=from_origin(-9600, 15161.771431773632 + 9600, 80, 80),
        nodata=np.nan,
    ) as ds:
        ds.write(data, 1)


def test_flat_sphere_matches_spherical_geometry(tmp_path):
    path = tmp_path / "flat.tif"
    make_dem(path)
    result = calculate_horizon(-89.5, 0, 2, 5000, 10, path)
    dist = np.arange(80, 5000.001, 80)
    expected = np.rad2deg(
        np.arctan2(
            RADIUS_M * np.cos(dist / RADIUS_M) - (RADIUS_M + 2),
            RADIUS_M * np.sin(dist / RADIUS_M),
        )
    ).max()
    np.testing.assert_allclose(result.elevation_deg, expected, atol=1e-8)
    assert np.all(result.coverage_m >= 4960)


def test_ridge_blocks_north_and_small_dem_reports_short_coverage(tmp_path):
    path = tmp_path / "ridge.tif"
    make_dem(path, ridge=True)
    result = calculate_horizon(-89.5, 0, 2, 20_000, 10, path)
    assert result.elevation_deg[0] > 2.0
    assert result.elevation_deg[18] < 0
    assert np.all(result.coverage_m < result.requested_m)
    assert horizon_at(result, np.array([0, 360]))[0] == pytest.approx(
        result.elevation_deg[0]
    )
