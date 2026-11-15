import numpy as np
import rasterio

from ilargi.build_cloud_terrain import build_cloud_dem
from ilargi.terrain import SAMPLE, resolve_global_dem


def test_cloud_dem_preserves_pixels_geometry_and_scaled_heights(tmp_path, monkeypatch):
    source = tmp_path / "source.tif"
    with rasterio.open(SAMPLE) as original:
        profile = original.profile
    profile.update(width=35, height=19, dtype="int16", nodata=-32768)
    values = np.arange(35 * 19, dtype=np.int16).reshape(19, 35) - 300
    values[0, 0] = -32768
    with rasterio.open(source, "w", **profile) as dataset:
        dataset.write(values, 1)
        dataset.scales = (0.5,)
        dataset.offsets = (1.0,)
        dataset.set_band_unit(1, "m")
    output = tmp_path / "ldem_128_cog.tif"
    build_cloud_dem(source, output)
    with rasterio.open(output) as dataset:
        np.testing.assert_array_equal(dataset.read(1), values)
        assert dataset.scales == (0.5,)
        assert dataset.offsets == (1.0,)
        assert dataset.block_shapes == [(256, 256)]
        assert dataset.overviews(1) == []
    monkeypatch.setenv("ILARGI_TERRAIN_DIR", str(tmp_path))
    assert resolve_global_dem() == output
