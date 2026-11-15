import json
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pytest
import spiceypy as spice

from ilargi.apparent import (
    LUNAR_FRAME,
    apparent_from_lunar_surface,
    horizontal_angles,
    reference_radius_km,
)
from ilargi.ephemeris import spice_session

EVIDENCE = (
    Path(__file__).resolve().parent.parent
    / "docs"
    / "horizons"
    / "comparison-2026-11-14.json"
)
INSTANT = datetime(2026, 4, 2, 15, tzinfo=UTC)
EVIDENCE_DATA = json.loads(EVIDENCE.read_text(encoding="utf-8"))
# Regression thresholds, not accuracy bounds. Recorded 2026-11-14 residuals:
# Earth 2.5 m, Sun 9.4 m in ICRF, and at most 0.0012 arcsec per sky component.
VECTOR_TOLERANCE_KM = 0.02
ANGLE_TOLERANCE_ARCSEC = 0.005
RANGE_TOLERANCE_KM = 0.05


def test_local_horizon_uses_north_through_east():
    cases = [
        ((0.0, 1.0, 0.0), 0.0, 0.0, 90.0, 0.0),
        ((0.0, 0.0, 1.0), 0.0, 0.0, 0.0, 0.0),
        ((0.0, -1.0, 0.0), 0.0, 0.0, 270.0, 0.0),
        ((0.0, 0.0, -1.0), 0.0, 0.0, 180.0, 0.0),
        ((1.0, 0.0, 0.0), 0.0, 0.0, None, 90.0),
        ((-1.0, 0.0, 0.0), 0.0, 0.0, None, -90.0),
        ((-1.0, 0.0, 0.0), 0.0, 90.0, 90.0, 0.0),
        ((0.0, 0.0, 1.0), 0.0, 90.0, 0.0, 0.0),
        ((0.0, 1.0, 0.0), 0.0, 90.0, None, 90.0),
    ]
    for direction, latitude, longitude, azimuth, elevation in cases:
        angles = horizontal_angles(np.array(direction), latitude, longitude)
        if azimuth is not None:
            assert angles.azimuth_deg == pytest.approx(azimuth, abs=1e-9)
        assert angles.elevation_deg == pytest.approx(elevation, abs=1e-9)
        rebuilt = np.rad2deg(
            np.arctan2(angles.up_km, np.hypot(angles.north_km, angles.east_km))
        )
        assert rebuilt == pytest.approx(angles.elevation_deg, abs=1e-9)


def test_local_basis_is_stable_very_near_south_pole():
    latitude, longitude = -89.999999999, 43.0
    lat, lon = np.deg2rad([latitude, longitude])
    east = np.array([-np.sin(lon), np.cos(lon), 0.0])
    north = np.array(
        [-np.sin(lat) * np.cos(lon), -np.sin(lat) * np.sin(lon), np.cos(lat)]
    )
    assert horizontal_angles(east, latitude, longitude).azimuth_deg == pytest.approx(
        90.0, abs=1e-8
    )
    assert horizontal_angles(north, latitude, longitude).azimuth_deg == pytest.approx(
        0.0, abs=1e-8
    )


def test_surface_inputs_and_site_geometry():
    with pytest.raises(ValueError, match="timezone-aware"):
        apparent_from_lunar_surface(datetime(2026, 4, 2, 15), 0, 0)
    with pytest.raises(ValueError, match="1972"):
        apparent_from_lunar_surface(datetime(1900, 1, 1, tzinfo=UTC), 0, 0)
    with pytest.raises(ValueError, match="pole"):
        apparent_from_lunar_surface(INSTANT, 90, 0)
    with pytest.raises(ValueError, match="pole"):
        apparent_from_lunar_surface(INSTANT, -90, 10)
    with pytest.raises(ValueError, match="finite"):
        apparent_from_lunar_surface(INSTANT, float("nan"), 0)
    with pytest.raises(ValueError, match="lunar center"):
        apparent_from_lunar_surface(INSTANT, 0, 0, height_km=-reference_radius_km())
    with pytest.raises(ValueError, match="Unsupported"):
        apparent_from_lunar_surface(INSTANT, 0, 0, targets=("MARS",))
    with pytest.raises(TypeError, match="sequence"):
        apparent_from_lunar_surface(INSTANT, 0, 0, targets="EARTH")

    radius = reference_radius_km()
    assert radius == pytest.approx(1737.4)
    on_sphere = apparent_from_lunar_surface(INSTANT, -89.9, 360, height_km=0)
    raised = apparent_from_lunar_surface(INSTANT, -89.9, 0, height_km=2)
    wrapped = apparent_from_lunar_surface(INSTANT, 10, -90, height_km=0.01)
    equivalent = apparent_from_lunar_surface(INSTANT, 10, 270, height_km=0.01)
    assert on_sphere.site.longitude_east_deg == pytest.approx(0.0)
    assert np.linalg.norm(on_sphere.site.position_km) == pytest.approx(radius)
    assert np.linalg.norm(raised.site.position_km) == pytest.approx(radius + 2)
    assert wrapped.site.position_km == pytest.approx(equivalent.site.position_km)
    assert on_sphere.provenance.frame == LUNAR_FRAME
    assert on_sphere.provenance.observer_kind == "ideal-sphere"
    assert on_sphere.provenance.aberration_locus == "OBSERVER"
    assert on_sphere.provenance.abcorr == "LT+S"
    assert "not loaded" in on_sphere.provenance.de421_relation
    assert "LOLA" in on_sphere.provenance.terrain
    assert "LOLA DEM" in on_sphere.provenance.terrain
    assert on_sphere.target("earth") == on_sphere.target("EARTH")
    with pytest.raises(KeyError, match="MARS"):
        on_sphere.target("MARS")


def test_frame_realizations_stay_distinct():
    first = apparent_from_lunar_surface(INSTANT, 0, 0)
    second = apparent_from_lunar_surface(datetime(2024, 6, 21, 12, tzinfo=UTC), 0, 0)
    assert first.provenance.pa_to_frame_deg == pytest.approx(0.028863328214, abs=1e-12)
    assert first.provenance.pa_to_frame_deg == pytest.approx(
        second.provenance.pa_to_frame_deg
    )
    assert 0.001 < first.provenance.iau_moon_to_frame_deg < 0.01
    assert first.provenance.iau_moon_to_frame_deg != pytest.approx(
        first.provenance.pa_to_frame_deg, abs=1e-4
    )
    with spice_session():
        alias = spice.pxform("MOON_ME", LUNAR_FRAME, first.et_seconds)
        assert np.allclose(alias, np.eye(3))


@pytest.mark.parametrize("target", ["EARTH", "SUN"])
def test_surface_apparent_vector_cannot_be_replaced_by_center_translation(target):
    result = apparent_from_lunar_surface(INSTANT, 0, 0)
    with spice_session():
        center, _ = spice.spkpos(target, result.et_seconds, LUNAR_FRAME, "LT+S", "MOON")
    translated = center - np.array(result.site.position_km)
    minimum_difference_km = 0.01 if target == "EARTH" else 1.0
    assert (
        np.linalg.norm(translated - result.target(target).position_km)
        > minimum_difference_km
    )


@pytest.mark.parametrize(
    "instant", [datetime(1972, 1, 1, tzinfo=UTC), datetime(2100, 12, 31, tzinfo=UTC)]
)
def test_surface_calculation_accepts_supported_utc_boundaries(instant):
    result = apparent_from_lunar_surface(instant, 0, 0)
    assert all(
        np.isfinite(target.range_km) and target.range_km > 0
        for target in result.targets
    )


@pytest.mark.parametrize(
    "case", [case for case in EVIDENCE_DATA["vectors"] if case["locus"] == "surface"]
)
def test_surface_vectors_match_horizons_icrf(case):
    instant = datetime.fromisoformat(case["utc"])
    result = apparent_from_lunar_surface(
        instant,
        case["latitude_deg"],
        case["longitude_east_deg"],
        case["height_km"],
        (case["target"],),
    )
    position = result.target(case["target"]).position_km
    et = result.et_seconds
    assert result.provenance.aberration_locus == "OBSERVER"
    with spice_session():
        rotated = spice.mxv(spice.pxform(LUNAR_FRAME, "J2000", et), position)
    residual = np.linalg.norm(np.array(rotated) - _icrf(case))
    assert residual < VECTOR_TOLERANCE_KM


def test_apparent_angles_match_horizons_airless():
    for case in json.loads(EVIDENCE.read_text(encoding="utf-8"))["horizontal"]:
        result = apparent_from_lunar_surface(
            datetime.fromisoformat(case["utc"]),
            case["latitude_deg"],
            case["longitude_east_deg"],
            case["height_km"],
            (case["target"],),
        )
        got = result.target(case["target"])
        azimuth_arcsec = (got.azimuth_deg - case["azimuth_deg"]) * 3600.0
        elevation_arcsec = (got.elevation_deg - case["elevation_deg"]) * 3600.0
        sky_azimuth_arcsec = azimuth_arcsec * np.cos(np.deg2rad(case["elevation_deg"]))
        assert abs(sky_azimuth_arcsec) < ANGLE_TOLERANCE_ARCSEC
        assert abs(elevation_arcsec) < ANGLE_TOLERANCE_ARCSEC
        assert got.range_km == pytest.approx(case["range_km"], abs=RANGE_TOLERANCE_KM)
        assert np.linalg.norm(got.topocentric_km) == pytest.approx(got.range_km)


def test_horizons_evidence_records_the_comparison_conditions():
    text = EVIDENCE.read_text(encoding="utf-8")
    assert "2026-11-14" in text
    assert "DE441" in text
    assert "LT+S" in text
    assert "AIRLESS" in text
    assert "1737.4, 1737.4, 1737.4" in text
    sample = (EVIDENCE.parent / "earth-observer-sample.txt").read_text(encoding="utf-8")
    assert "MEAN_ME (high precision)" in sample
    assert "Atmos refraction: NO (AIRLESS)" in sample
    assert "gravitational deflection of light" in sample


def _icrf(case: dict) -> np.ndarray:
    return np.array([case["x_km"], case["y_km"], case["z_km"]], dtype=float)
