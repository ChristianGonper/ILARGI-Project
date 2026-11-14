import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin

from ilargi.terrain import SAMPLE, sample_elevation


def test_sample_matches_source_pixel_and_crs():
    sample = sample_elevation(-89.5, 0)
    with rasterio.open(SAMPLE) as ds:
        row, col = ds.index(sample.x_m, sample.y_m)
        assert sample.elevation_m == pytest.approx(
            float(ds.read(1, window=((row, row + 1), (col, col + 1)))[0, 0])
        )
        assert ds.crs is not None
        assert sample.pixel_size_m == 80
    assert -3000 < sample.elevation_m < 2000


def test_rejects_outside_or_invalid_sample():
    with pytest.raises(ValueError, match="fuera del recorte"):
        sample_elevation(-80, 0)
    with pytest.raises(ValueError, match="finitas"):
        sample_elevation(float("nan"), 0)


def test_scaled_integer_dem_is_converted_to_metres(tmp_path):
    path = tmp_path / "scaled.tif"
    with rasterio.open(SAMPLE) as source:
        crs = source.crs
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        height=10,
        width=10,
        count=1,
        dtype="int16",
        crs=crs,
        transform=from_origin(-400, 15161.771431773632 + 400, 80, 80),
    ) as ds:
        ds.write(np.full((10, 10), 10, dtype="int16"), 1)
        ds.scales = (0.5,)
        ds.offsets = (2.0,)
        ds.set_band_unit(1, "km")
    assert sample_elevation(-89.5, 0, path).elevation_m == pytest.approx(7000)


def test_missing_crs_is_rejected(tmp_path):
    path = tmp_path / "no-crs.tif"
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        height=2,
        width=2,
        count=1,
        dtype="float32",
        transform=from_origin(0, 16000, 80, 80),
    ) as ds:
        ds.write(np.zeros((2, 2), dtype="float32"), 1)
    with pytest.raises(ValueError, match="sistema de coordenadas"):
        sample_elevation(-89.5, 0, path)


def test_projected_coordinates_must_use_metres(tmp_path):
    path = tmp_path / "kilometres.tif"
    crs = "+proj=stere +lat_0=-90 +lon_0=0 +R=1737400 +units=km +type=crs"
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        height=2,
        width=2,
        count=1,
        dtype="float32",
        crs=crs,
        transform=from_origin(0, 20, 1, 1),
    ) as ds:
        ds.write(np.zeros((2, 2), dtype="float32"), 1)
    with pytest.raises(ValueError, match="deben estar en metros"):
        sample_elevation(-89.5, 0, path)
