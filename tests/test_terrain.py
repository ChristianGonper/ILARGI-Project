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
    with pytest.raises(ValueError, match="outside the available"):
        sample_elevation(-80, 0)
    with pytest.raises(ValueError, match="finite"):
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
    with pytest.raises(ValueError, match="coordinate reference system"):
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
    with pytest.raises(ValueError, match="must be in meters"):
        sample_elevation(-89.5, 0, path)


def test_resolves_shared_and_env_terrain_caches_and_syncs_vrt(tmp_path, monkeypatch):
    import hashlib

    import ilargi.analysis as analysis
    import ilargi.download_terrain as download_terrain
    import ilargi.terrain as terrain

    local_dir = tmp_path / "worktree" / "data" / "terrain"
    shared_dir = tmp_path / "home" / ".ilargi" / "terrain"
    env_dir = tmp_path / "custom_terrain"
    local_dir.mkdir(parents=True)
    shared_dir.mkdir(parents=True)
    env_dir.mkdir(parents=True)

    vrt_content = "<VRTDataset rasterXSize='1' rasterYSize='1'></VRTDataset>\n"
    (local_dir / terrain.GLOBAL_VRT_FILENAME).write_text(vrt_content, encoding="utf-8")

    polar_bytes = b"polar-dem"
    global_bytes = b"global-dem"
    (shared_dir / terrain.POLAR_FILENAME).write_bytes(polar_bytes)
    (shared_dir / terrain.GLOBAL_IMG_FILENAME).write_bytes(global_bytes)

    monkeypatch.delenv("ILARGI_TERRAIN_DIR", raising=False)
    monkeypatch.setattr(terrain, "LOCAL_TERRAIN_DIR", local_dir)
    monkeypatch.setattr(terrain, "SHARED_TERRAIN_DIR", shared_dir)
    monkeypatch.setattr(terrain, "POLAR_SIZE_BYTES", len(polar_bytes))
    monkeypatch.setattr(terrain, "GLOBAL_IMG_SIZE_BYTES", len(global_bytes))

    assert terrain.resolve_polar_dem() == shared_dir / terrain.POLAR_FILENAME
    resolved_global = terrain.resolve_global_dem()
    assert resolved_global == shared_dir / terrain.GLOBAL_VRT_FILENAME
    assert resolved_global.read_text(encoding="utf-8") == vrt_content

    avail = analysis.dem_availability()
    assert avail["polar_80m"] is True
    assert avail["global_240m"] is True
    assert analysis._resolve_dem_candidates(-89.5, "auto", None) == [
        shared_dir / terrain.POLAR_FILENAME,
        terrain.SAMPLE,
        shared_dir / terrain.GLOBAL_VRT_FILENAME,
    ]

    # Local worktree directory takes precedence over shared cache.
    (local_dir / terrain.POLAR_FILENAME).write_bytes(polar_bytes)
    assert terrain.resolve_polar_dem() == local_dir / terrain.POLAR_FILENAME

    # ILARGI_TERRAIN_DIR overrides both local and shared directories.
    (env_dir / terrain.POLAR_FILENAME).write_bytes(polar_bytes)
    monkeypatch.setenv("ILARGI_TERRAIN_DIR", str(env_dir))
    assert terrain.resolve_polar_dem() == env_dir / terrain.POLAR_FILENAME
    assert terrain.resolve_global_dem() is None

    # download_terrain copies verified local files into target cache without HTTP.
    monkeypatch.setattr(download_terrain, "LOCAL_TERRAIN_DIR", local_dir)
    out = download_terrain.download(
        terrain.POLAR_FILENAME,
        "https://example.invalid/unreachable",
        len(polar_bytes),
        hashlib.sha256(polar_bytes).hexdigest(),
        target_dir=tmp_path / "target_cache",
    )
    assert out == tmp_path / "target_cache" / terrain.POLAR_FILENAME
    assert out.read_bytes() == polar_bytes
