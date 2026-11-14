from datetime import UTC, datetime

import numpy as np
import pytest

from ilargi.ephemeris import positions


def test_positions_are_consistent_between_origins():
    instant = datetime(2026, 4, 2, 15, tzinfo=UTC)
    solar = positions(instant, "SUN")
    earth = positions(instant, "EARTH")
    np.testing.assert_allclose(solar["MOON"] - solar["EARTH"], earth["MOON"], atol=1e-6)
    assert 350_000 < np.linalg.norm(earth["MOON"]) < 410_000
    assert 145_000_000 < np.linalg.norm(solar["EARTH"]) < 155_000_000


def test_inputs_are_explicit():
    with pytest.raises(ValueError, match="zona horaria"):
        positions(datetime(2026, 1, 1))
    with pytest.raises(ValueError, match="Origen"):
        positions(datetime(2026, 1, 1, tzinfo=UTC), "MARS")
    with pytest.raises(ValueError, match="1972"):
        positions(datetime(1900, 1, 1, tzinfo=UTC))


def test_moon_vector_against_saved_horizons_reference():
    # Horizons DE441, ICRF, geometric, Moon relative to Earth, 2026-04-02 15:00 UTC.
    reference = [-373910.6664632003, -106746.2116582052, -71540.67909399251]
    result = positions(datetime(2026, 4, 2, 15, tzinfo=UTC), "EARTH")["MOON"]
    assert (
        np.linalg.norm(result - reference) < 0.01
    )  # km; comparison tolerance, not an accuracy claim


@pytest.mark.parametrize(
    ("target", "origin", "reference"),
    [
        ("SUN", "MOON", [146351412.6839307, 29839385.53201974, 12958906.31222463]),
        ("EARTH", "SUN", [-145977502.0174675, -29732639.32036154, -12887365.63313064]),
    ],
)
def test_other_vectors_against_horizons(target, origin, reference):
    result = positions(datetime(2026, 4, 2, 15, tzinfo=UTC), origin)[target]
    assert np.linalg.norm(result - reference) < 0.01
