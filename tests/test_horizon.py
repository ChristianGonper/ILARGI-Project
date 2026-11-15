import numpy as np
import pytest
import rasterio
from pyproj import CRS, Geod, Transformer
from rasterio.transform import from_origin

from ilargi.horizon import (
    LUNAR_MAX_ELEVATION_M,
    LUNAR_MIN_ELEVATION_M,
    RADIUS_M,
    Horizon,
    calculate_horizon,
    calculate_multiresolution_horizon,
    estimate_search_radius,
    horizon_at,
    max_search_distance_m,
)
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


def test_excessive_ray_arrays_are_refused_before_allocation():
    with pytest.raises(ValueError, match="Too many horizon samples"):
        calculate_horizon(-89.5, 0, 2, 100_000, 0.001, SAMPLE)


def test_tangent_plane_zero_degree_bound_matches_exact_spherical_cut():
    obs_m = -714.0
    d_zero = max_search_distance_m(obs_m, min_elevation_deg=0.0)
    expected = RADIUS_M * np.arccos(
        (RADIUS_M + obs_m) / (RADIUS_M + LUNAR_MAX_ELEVATION_M)
    )
    assert d_zero == pytest.approx(expected, rel=1e-12)

    theta = d_zero / RADIUS_M
    up = (RADIUS_M + LUNAR_MAX_ELEVATION_M) * np.cos(theta) - (RADIUS_M + obs_m)
    horiz = (RADIUS_M + LUNAR_MAX_ELEVATION_M) * np.sin(theta)
    assert np.rad2deg(np.arctan2(up, horiz)) == pytest.approx(0.0, abs=1e-12)


def test_negative_horizon_requires_larger_radius_than_tangent_plane():
    obs_m = 5_000.0
    summary = estimate_search_radius(obs_m)
    assert summary.spherical_horizon_m > summary.tangent_plane_m

    # Maximum-height mountain beyond the 0° tangent-plane cutoff:
    # still below 0° but above the minimum spherical horizon.
    d_beyond = 0.5 * (summary.tangent_plane_m + summary.spherical_horizon_m)
    theta = d_beyond / RADIUS_M
    elev_mountain = np.rad2deg(
        np.arctan2(
            (RADIUS_M + LUNAR_MAX_ELEVATION_M) * np.cos(theta) - (RADIUS_M + obs_m),
            (RADIUS_M + LUNAR_MAX_ELEVATION_M) * np.sin(theta),
        )
    )
    horizon_min_sphere = -np.rad2deg(
        np.arccos((RADIUS_M + LUNAR_MIN_ELEVATION_M) / (RADIUS_M + obs_m))
    )
    assert horizon_min_sphere < elev_mountain < 0.0


def test_elevated_observer_above_max_terrain_still_has_positive_spherical_horizon():
    obs_m = LUNAR_MAX_ELEVATION_M + 1_500.0
    assert max_search_distance_m(obs_m, min_elevation_deg=0.0) == 0.0
    assert max_search_distance_m(obs_m, min_elevation_deg=30.0) == 0.0

    # Exact tangent to r_max from above: the single point lies at R * |alpha|
    alpha_tan_max = -np.rad2deg(
        np.arccos((RADIUS_M + LUNAR_MAX_ELEVATION_M) / (RADIUS_M + obs_m))
    )
    d_tan = max_search_distance_m(obs_m, min_elevation_deg=alpha_tan_max)
    assert d_tan == pytest.approx(RADIUS_M * np.deg2rad(-alpha_tan_max), rel=1e-12)

    d_full = max_search_distance_m(obs_m, min_elevation_deg=None)
    expected = RADIUS_M * (
        np.arccos((RADIUS_M + LUNAR_MIN_ELEVATION_M) / (RADIUS_M + obs_m))
        + np.arccos(
            (RADIUS_M + LUNAR_MIN_ELEVATION_M) / (RADIUS_M + LUNAR_MAX_ELEVATION_M)
        )
    )
    assert d_full == pytest.approx(expected, rel=1e-12)


def test_vector_search_distance_monotonic_and_handles_nan_and_floor():
    angles = np.array([15.0, 2.0, 0.0, -2.0, np.nan, -12.0])
    dists = max_search_distance_m(0.0, min_elevation_deg=angles)
    assert dists.shape == angles.shape
    # Monotonically decreasing between 15° and -2°
    assert dists[0] < dists[1] < dists[2] < dists[3]
    # NaN uses the absolute physical bound
    worst = max_search_distance_m(0.0, min_elevation_deg=None)
    assert dists[4] == pytest.approx(worst)
    # A ray below the grazing angle (-12°) saturates at the absolute bound
    assert dists[5] == pytest.approx(worst)


def test_calculate_horizon_auto_distance_uses_physical_bound(tmp_path):
    path = tmp_path / "bounded.tif"
    make_dem(path)
    result = calculate_horizon(
        -89.5,
        0.0,
        instrument_height_m=2.0,
        max_distance_m=None,
        azimuth_step_deg=10.0,
        path=path,
        max_terrain_m=50.0,
        min_terrain_m=0.0,
    )
    expected_phys = max_search_distance_m(2.0, max_terrain_m=50.0, min_terrain_m=0.0)
    assert result.physical_max_m == pytest.approx(expected_phys)
    assert result.requested_m == pytest.approx(expected_phys)
    assert result.required_m is not None


def test_multiresolution_horizon_combines_near_fine_and_far_coarse(tmp_path):
    with rasterio.open(SAMPLE) as source:
        crs = source.crs
    projection = CRS.from_user_input(crs)
    project = Transformer.from_crs(projection.geodetic_crs, projection, always_xy=True)
    geod = Geod(a=RADIUS_M, b=RADIUS_M)

    # Fine 50 m/pixel grid over ±5 km with a nearby northern ridge (+12°)
    fine_path = tmp_path / "fine.tif"
    fine_data = np.zeros((201, 201), dtype="float32")
    fine_transform = from_origin(-5025, 15161.771431773632 + 5025, 50, 50)
    lon_n, lat_n, _ = geod.fwd(0, -89.5, 0, 2000)
    x_n, y_n = project.transform(lon_n, lat_n)
    r_n, c_n = rasterio.transform.rowcol(fine_transform, x_n, y_n)
    fine_data[r_n - 2 : r_n + 3, c_n - 2 : c_n + 3] = 430.0
    with rasterio.open(
        fine_path,
        "w",
        driver="GTiff",
        height=201,
        width=201,
        count=1,
        dtype="float32",
        crs=crs,
        transform=fine_transform,
        nodata=np.nan,
    ) as ds:
        ds.write(fine_data, 1)

    # Coarse 400 m/pixel grid over ±40 km with a southern mountain (15 km, 2500 m)
    # and an artificial northern peak at 25 km beyond the ridge physical cutoff.
    coarse_path = tmp_path / "coarse.tif"
    coarse_data = np.zeros((201, 201), dtype="float32")
    coarse_transform = from_origin(-40200, 15161.771431773632 + 40200, 400, 400)
    lon_s, lat_s, _ = geod.fwd(0, -89.5, 180, 15_000)
    x_s, y_s = project.transform(lon_s, lat_s)
    r_s, c_s = rasterio.transform.rowcol(coarse_transform, x_s, y_s)
    coarse_data[r_s - 2 : r_s + 3, c_s - 2 : c_s + 3] = 2_500.0

    lon_n2, lat_n2, _ = geod.fwd(0, -89.5, 0, 25_000)
    x_n2, y_n2 = project.transform(lon_n2, lat_n2)
    r_n2, c_n2 = rasterio.transform.rowcol(coarse_transform, x_n2, y_n2)
    coarse_data[r_n2 - 2 : r_n2 + 3, c_n2 - 2 : c_n2 + 3] = 3_000.0

    with rasterio.open(
        coarse_path,
        "w",
        driver="GTiff",
        height=201,
        width=201,
        count=1,
        dtype="float32",
        crs=crs,
        transform=coarse_transform,
        nodata=np.nan,
    ) as ds:
        ds.write(coarse_data, 1)

    result = calculate_multiresolution_horizon(
        -89.5,
        0.0,
        instrument_height_m=2.0,
        fine_distance_m=5_000.0,
        max_distance_m=30_000.0,
        azimuth_step_deg=10.0,
        fine_path=fine_path,
        coarse_path=coarse_path,
        max_terrain_m=3_000.0,
        min_terrain_m=0.0,
    )
    # North (index 0, 0°): captured by the fine grid (> 11°), closed early (< 20 km)
    assert result.elevation_deg[0] > 11.0
    assert result.required_m is not None
    assert result.required_m[0] < 20_000.0
    assert result.coverage_m[0] <= result.required_m[0] + 400.0
    # South (index 18, 180°): captured by the coarse grid at 15 km (> 8°)
    assert result.elevation_deg[18] > 8.0
    assert result.coverage_m[18] > 14_000.0


def test_max_search_distance_rejects_invalid_bounds():
    with pytest.raises(ValueError, match="below min_terrain_m"):
        max_search_distance_m(-10_000.0)
    with pytest.raises(ValueError, match="min_terrain_m cannot exceed"):
        max_search_distance_m(0.0, max_terrain_m=100.0, min_terrain_m=200.0)
    with pytest.raises(ValueError, match=r"\(-90, 90\)"):
        max_search_distance_m(0.0, min_elevation_deg=90.0)


def test_multiresolution_horizon_stops_at_coarse_nodata(tmp_path):
    with rasterio.open(SAMPLE) as source:
        crs = source.crs
    projection = CRS.from_user_input(crs)
    project = Transformer.from_crs(projection.geodetic_crs, projection, always_xy=True)
    geod = Geod(a=RADIUS_M, b=RADIUS_M)

    fine_path = tmp_path / "fine_flat.tif"
    fine_data = np.zeros((201, 201), dtype="float32")
    fine_transform = from_origin(-5025, 15161.771431773632 + 5025, 50, 50)
    with rasterio.open(
        fine_path,
        "w",
        driver="GTiff",
        height=201,
        width=201,
        count=1,
        dtype="float32",
        crs=crs,
        transform=fine_transform,
        nodata=np.nan,
    ) as ds:
        ds.write(fine_data, 1)

    # Coarse grid with a southern nodata gap at 10 km and a mountain behind it at 18 km
    coarse_path = tmp_path / "coarse_hole.tif"
    coarse_data = np.zeros((201, 201), dtype="float32")
    coarse_transform = from_origin(-40200, 15161.771431773632 + 40200, 400, 400)
    lon_gap, lat_gap, _ = geod.fwd(0, -89.5, 180, 10_000)
    x_g, y_g = project.transform(lon_gap, lat_gap)
    r_g, c_g = rasterio.transform.rowcol(coarse_transform, x_g, y_g)
    coarse_data[r_g - 2 : r_g + 3, c_g - 2 : c_g + 3] = np.nan

    lon_mtn, lat_mtn, _ = geod.fwd(0, -89.5, 180, 18_000)
    x_m, y_m = project.transform(lon_mtn, lat_mtn)
    r_m, c_m = rasterio.transform.rowcol(coarse_transform, x_m, y_m)
    coarse_data[r_m - 2 : r_m + 3, c_m - 2 : c_m + 3] = 3_000.0

    with rasterio.open(
        coarse_path,
        "w",
        driver="GTiff",
        height=201,
        width=201,
        count=1,
        dtype="float32",
        crs=crs,
        transform=coarse_transform,
        nodata=np.nan,
    ) as ds:
        ds.write(coarse_data, 1)

    result = calculate_multiresolution_horizon(
        -89.5,
        0.0,
        instrument_height_m=2.0,
        fine_distance_m=5_000.0,
        max_distance_m=25_000.0,
        azimuth_step_deg=10.0,
        fine_path=fine_path,
        coarse_path=coarse_path,
        max_terrain_m=3_000.0,
        min_terrain_m=0.0,
    )
    # South (index 18, 180°): the ray stops before the gap and does not jump to the mountain
    assert result.coverage_m[18] < 10_000.0
    assert result.elevation_deg[18] < 0.0
