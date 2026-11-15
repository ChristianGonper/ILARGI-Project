from datetime import UTC, datetime, timedelta, timezone

import pytest

from ilargi.ephemeris import require_aware_utc


def test_timezone_offsets_are_normalized_to_the_same_instant():
    instant = datetime(2026, 4, 2, 15, tzinfo=timezone(timedelta(hours=2)))
    normalized = require_aware_utc(instant)
    assert normalized == datetime(2026, 4, 2, 13, tzinfo=UTC)
    assert normalized.tzinfo is UTC


@pytest.mark.parametrize("year", [1900, 1971, 2101])
def test_dates_outside_supported_civil_utc_are_rejected(year):
    with pytest.raises(ValueError, match="1972"):
        require_aware_utc(datetime(year, 1, 1, tzinfo=UTC))


def test_naive_dates_are_rejected():
    with pytest.raises(ValueError, match="timezone-aware"):
        require_aware_utc(datetime(2026, 4, 2))
