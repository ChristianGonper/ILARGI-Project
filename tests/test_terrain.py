import pytest
import rasterio

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
