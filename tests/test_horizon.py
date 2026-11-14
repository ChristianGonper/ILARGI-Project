import numpy as np
import pytest
import rasterio
from pyproj import CRS, Geod, Transformer
from rasterio.transform import from_origin

from ilargi.horizon import RADIUS_M, Horizon, calculate_horizon, coverage_at, horizon_at
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


def test_ray_stops_at_nodata_even_when_later_pixels_are_valid(tmp_path):
    path = tmp_path / "hole.tif"
    make_dem(path)
    with rasterio.open(path, "r+") as dataset:
        pixels = dataset.read(1)
        pixels[105:110, 110:130] = np.nan
        dataset.write(pixels, 1)
    result = calculate_horizon(-89.5, 0, 2, 5000, 10, path)
    assert result.coverage_m[0] < 1600
    assert result.coverage_m[18] >= 4960


def test_east_and_south_pole_crossing_are_not_reversed(tmp_path):
    path = tmp_path / "cardinal.tif"
    with rasterio.open(SAMPLE) as source:
        crs = source.crs
    data = np.zeros((625, 625), dtype="float32")
    transform = from_origin(-25000, 40000, 80, 80)
    projection = CRS.from_user_input(crs)
    project = Transformer.from_crs(projection.geodetic_crs, projection, always_xy=True)
    geod = Geod(a=RADIUS_M, b=RADIUS_M)
    for azimuth, distance, height in ((90, 2000, 400), (180, 18000, 4000)):
        lon, lat, _ = geod.fwd(0, -89.5, azimuth, distance)
        x, y = project.transform(lon, lat)
        row, col = rasterio.transform.rowcol(transform, x, y)
        data[row - 3 : row + 4, col - 3 : col + 4] = height
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        height=625,
        width=625,
        count=1,
        dtype="float32",
        crs=crs,
        transform=transform,
        nodata=np.nan,
    ) as ds:
        ds.write(data, 1)
    result = calculate_horizon(-89.5, 0, 2, 20000, 10, path)
    assert result.elevation_deg[9] > 5
    assert result.elevation_deg[27] < 0
    assert result.elevation_deg[18] > 5
    assert result.elevation_deg[0] < 0


def test_own_pixel_is_not_treated_as_obstacle(tmp_path):
    path = tmp_path / "peak.tif"
    make_dem(path)
    with rasterio.open(path, "r+") as dataset:
        pixels = dataset.read(1)
        row, col = dataset.index(0, 15161.771431773632)
        pixels[row, col] = 1000
        dataset.write(pixels, 1)
    result = calculate_horizon(-89.5, 0, 2, 5000, 10, path)
    assert np.max(result.elevation_deg) < -5


def test_missing_neighbour_never_produces_a_finite_interpolated_horizon():
    profile = Horizon(
        np.array([0.0, 90.0, 180.0, 270.0]),
        np.array([1.0, np.nan, 3.0, 4.0]),
        np.array([1000.0, 0.0, 600.0, 900.0]),
        1000.0,
        80.0,
        0.0,
        2.0,
    )
    angles = np.array([0.0, 90.0, 180.0, 270.0])
    result = horizon_at(profile, angles)
    assert np.isnan(result[:2]).all()
    np.testing.assert_allclose(result[2:], [3.0, 4.0])
    np.testing.assert_allclose(coverage_at(profile, angles), [0.0, 0.0, 600.0, 900.0])


def test_excessive_ray_arrays_are_refused_before_allocation():
    with pytest.raises(ValueError, match="Demasiadas muestras"):
        calculate_horizon(-89.5, 0, 2, 100_000, 0.001, SAMPLE)
