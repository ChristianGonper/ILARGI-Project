from io import BytesIO

import pytest
from PIL import Image

from ilargi.terrain import SAMPLE, sample_elevation
from ilargi.terrain_image import render_terrain_png


def test_export_creates_high_resolution_png_for_both_styles():
    point = sample_elevation(-89.5, 0, SAMPLE)
    normal = render_terrain_png(SAMPLE, point)
    relief = render_terrain_png(SAMPLE, point, relief=True)
    with Image.open(BytesIO(normal)) as image:
        assert image.format == "PNG"
        assert image.width >= 2000 and image.height >= 2000
    assert normal != relief


def test_window_can_be_rendered_and_cannot_exceed_source():
    point = sample_elevation(-89.5, 0, SAMPLE)
    assert render_terrain_png(SAMPLE, point, window_km=5).startswith(b"\x89PNG")
    with pytest.raises(ValueError, match="rebasa"):
        render_terrain_png(SAMPLE, point, window_km=100)
