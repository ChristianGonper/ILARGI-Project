import numpy as np
import pytest
import rasterio
from fastapi.testclient import TestClient

from ilargi import terrain_mesh
from ilargi.api import create_app
from ilargi.terrain import SAMPLE, sample_elevation


def test_real_patch_center_matches_lola_and_wraps_longitude():
    patch = terrain_mesh.terrain_patch(-89.5, 360, 5)
    size = patch["size"]
    assert size % 2 == 1
    assert len(patch["heights_m"]) == size * size
    expected = sample_elevation(-89.5, 0, SAMPLE.with_name(patch["source"]))
    assert patch["heights_m"][size * size // 2] == expected.elevation_m
    assert patch["center_elevation_m"] == expected.elevation_m
    assert patch["spacing_m"] >= patch["pixel_size_m"]
    assert patch["coverage_fraction"] == 1


def test_partial_patch_keeps_missing_pixels_and_vertical_units(tmp_path, monkeypatch):
    path = tmp_path / "sample.tif"
    with rasterio.open(SAMPLE) as source:
        profile = source.profile
        values = source.read(1)
    profile.update(nodata=-9999)
    values[: values.shape[0] // 2 - 2] = -9999
    with rasterio.open(path, "w", **profile) as target:
        target.write(values, 1)
        target.scales = (0.5,)
        target.offsets = (10,)
    monkeypatch.setattr(terrain_mesh, "SAMPLE", path)
    patch = terrain_mesh.terrain_patch(-89.5, 0, 20)
    assert patch["source"] == path.name
    assert 0 < patch["coverage_fraction"] < 1
    assert None in patch["heights_m"]
    assert patch["center_elevation_m"] == sample_elevation(-89.5, 0, path).elevation_m
    assert all(h is None or np.isfinite(h) for h in patch["heights_m"])


@pytest.mark.parametrize(
    ("latitude", "longitude", "width"),
    [(91, 0, 10), (0, 361, 10), (0, 0, 21), (float("nan"), 0, 10)],
)
def test_patch_rejects_invalid_inputs(latitude, longitude, width):
    with pytest.raises(ValueError, match="fuera de rango|entre 2 y 20|finitos"):
        terrain_mesh.terrain_patch(latitude, longitude, width)


def test_api_patch_and_unavailable_location(monkeypatch):
    client = TestClient(create_app())
    response = client.post(
        "/api/terrain/patch",
        json={"latitude_deg": -89.5, "longitude_east_deg": 0, "width_km": 5},
    )
    assert response.status_code == 200
    assert response.json()["frame"] == "MOON_ME_DE421"
    monkeypatch.setattr(terrain_mesh, "GLOBAL", SAMPLE.with_name("missing.vrt"))
    monkeypatch.setattr(terrain_mesh, "POLAR", SAMPLE.with_name("missing.tif"))
    response = client.post(
        "/api/terrain/patch", json={"latitude_deg": 0, "longitude_east_deg": 0}
    )
    assert response.status_code == 422
    assert "No hay un DEM" in response.json()["detail"]
