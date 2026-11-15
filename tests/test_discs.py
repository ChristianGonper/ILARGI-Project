import numpy as np
import pandas as pd
import pytest

from ilargi.discs import angular_radius, disc_visibility
from ilargi.horizon import Horizon


def profile(height):
    return Horizon(
        azimuth_deg=np.arange(0, 360, 10),
        elevation_deg=np.full(36, height),
        coverage_m=np.full(36, 10000.0),
        requested_m=10000,
        pixel_m=80,
        observer_m=0,
        ground_m=0,
    )


def row(az, el, distance):
    return pd.Series({"azimuth_deg": az, "elevation_deg": el, "range_km": distance})


def test_angular_radius_uses_center_distance():
    assert angular_radius("EARTH", 384400) == pytest.approx(np.arcsin(6371 / 384400))


def test_horizon_and_eclipse_combined():
    sun = row(0, 10, 149600000)
    earth = row(0, 10, 384400)
    assert disc_visibility("SUN", sun, profile(0), earth) == (1, 1, 0)
    assert disc_visibility("SUN", sun, profile(20), row(90, 10, 384400)) == (0, 0, 0)
    above, eclipse, visible = disc_visibility(
        "SUN", sun, profile(10), row(90, 10, 384400)
    )
    assert above == pytest.approx(0.5, abs=0.02)
    assert visible == above
    assert eclipse == 0


def test_unknown_horizon_is_not_clear_sky():
    above, eclipse, visible = disc_visibility(
        "EARTH", row(0, 10, 384400), profile(float("nan"))
    )
    assert np.isnan(above)
    assert np.isnan(visible)
    assert eclipse == 0


def test_real_total_eclipse_from_surface():
    from datetime import UTC, datetime

    from ilargi.apparent import apparent_from_lunar_surface

    result = apparent_from_lunar_surface(datetime(2025, 3, 14, 6, 58, tzinfo=UTC), 0, 0)
    sun, earth = result.target("SUN"), result.target("EARTH")
    solar = row(sun.azimuth_deg, sun.elevation_deg, sun.range_km)
    terrestrial = row(earth.azimuth_deg, earth.elevation_deg, earth.range_km)
    assert disc_visibility("SUN", solar, profile(-90), terrestrial)[1] == 1
