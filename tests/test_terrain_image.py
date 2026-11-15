from io import BytesIO

import pytest
import rasterio
from PIL import Image

from ilargi.terrain import SAMPLE, TerrainSample, sample_elevation
from ilargi.terrain_image import crop_window, render_terrain_png


def test_export_creates_high_resolution_png_for_both_styles():
    point = sample_elevation(-89.5, 0, SAMPLE)
    normal = render_terrain_png(SAMPLE, point)
    relief = render_terrain_png(SAMPLE, point, relief=True)
    with Image.open(BytesIO(normal)) as image:
        assert image.format == "PNG"
        assert image.width >= 2000
        assert image.height >= 2000
    assert normal != relief


def test_window_can_be_rendered_and_cannot_exceed_source():
    point = sample_elevation(-89.5, 0, SAMPLE)
    assert render_terrain_png(SAMPLE, point, window_km=5).startswith(b"\x89PNG")
    with pytest.raises(ValueError, match="exceeds"):
        render_terrain_png(SAMPLE, point, window_km=100)


def test_window_respects_exact_pixel_edges_and_small_shading_is_rejected():
    path = SAMPLE.with_name("lola_20m_south_pole_sample.tif")
    point = sample_elevation(-89.5, 0, path)
    with rasterio.open(path) as ds:
        window = crop_window(ds, point, 5)
        bounds = ds.window_bounds(window)
    assert window.width == 250
    assert bounds[0] == pytest.approx(-2500)
    assert bounds[2] == pytest.approx(2500)
    centered = TerrainSample(point.elevation_m, 10, 15170, 20)
    with pytest.raises(ValueError, match="two pixels"):
        render_terrain_png(path, centered, relief=True, window_km=0.005)
