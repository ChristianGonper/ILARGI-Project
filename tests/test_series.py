from datetime import UTC, datetime

import pytest

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
