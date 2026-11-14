from datetime import UTC, datetime

import pytest

from ilargi.apparent import apparent_from_lunar_surface
from ilargi.series import sky_series


def test_series_includes_final_instant_and_both_targets():
    result = sky_series(datetime(2026, 4, 2, tzinfo=UTC), 2.5, 60, -89.5, 0, 0)
    assert len(result) == 8
    assert result.utc.max().hour == 2 and result.utc.max().minute == 30
    assert set(result.objetivo) == {"SUN", "EARTH"}
    assert result[result.objetivo == "SUN"].azimut_deg.nunique() == 4


def test_series_rejects_excessive_sampling():
    with pytest.raises(ValueError, match="3000"):
        sky_series(datetime(2026, 4, 2, tzinfo=UTC), 90 * 24, 15, -89.5, 0, 0)


def test_series_uses_surface_height_in_metres_and_apparent_corrections():
    instant = datetime(2026, 4, 2, 15, tzinfo=UTC)
    reference = apparent_from_lunar_surface(instant, -89.5, 0, -0.718)
    result = sky_series(instant, 1, 60, -89.5, 0, -718)
    assert reference.provenance.abcorr == "LT+S"
    for body in ("EARTH", "SUN"):
        row = result[(result.utc == instant) & (result.objetivo == body)].iloc[0]
        assert row.elevacion_deg == pytest.approx(reference.target(body).elevation_deg)
        assert row.azimut_deg == pytest.approx(reference.target(body).azimuth_deg)
