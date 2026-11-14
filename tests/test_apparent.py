import json
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pytest
import spiceypy as spice

from ilargi.apparent import (
    LUNAR_FRAME,
    apparent_from_lunar_center,
    apparent_from_lunar_surface,
    ephemeris_coverage_et,
    horizontal_angles,
    reference_radius_km,
)
from ilargi.ephemeris import spice_session

EVIDENCE = (
    Path(__file__).resolve().parent.parent
    / "docs"
    / "horizons"
    / "comparacion-2026-11-14.json"
)
INSTANT = datetime(2026, 4, 2, 15, tzinfo=UTC)
# Guardas de regresión, no una cota de exactitud. El 14 de noviembre de 2026 el
# residuo ICRF fue de 2,5 m para la Tierra y 9,4 m para el Sol. En el cielo, la
# mayor componente fue 0,0012 arcsec.
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
    with pytest.raises(ValueError, match="zona horaria"):
        apparent_from_lunar_surface(datetime(2026, 4, 2, 15), 0, 0)
    with pytest.raises(ValueError, match="1972"):
        apparent_from_lunar_surface(datetime(1900, 1, 1, tzinfo=UTC), 0, 0)
    with pytest.raises(ValueError, match="polo"):
        apparent_from_lunar_surface(INSTANT, 90, 0)
    with pytest.raises(ValueError, match="polo"):
        apparent_from_lunar_surface(INSTANT, -90, 10)
    with pytest.raises(ValueError, match="finita"):
        apparent_from_lunar_surface(INSTANT, float("nan"), 0)
    with pytest.raises(ValueError, match="centro lunar"):
        apparent_from_lunar_surface(INSTANT, 0, 0, height_km=-reference_radius_km())
    with pytest.raises(ValueError, match="no admitido"):
        apparent_from_lunar_surface(INSTANT, 0, 0, targets=("MARS",))
    with pytest.raises(TypeError, match="secuencia"):
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
    assert "no está cargado" in on_sphere.provenance.de421_relation
    assert "LOLA" in on_sphere.provenance.terrain
    assert "DEM LOLA" in on_sphere.provenance.terrain


def test_center_observer_is_not_a_surface_point():
    center = apparent_from_lunar_center(INSTANT)
    surface = apparent_from_lunar_surface(INSTANT, 0, 0, 0)
    assert center.provenance.observer_kind == "body-center"
    assert center.provenance.aberration_locus == "body-center"
    assert not hasattr(center.target("EARTH"), "azimuth_deg")
    assert center.provenance.frame == surface.provenance.frame == LUNAR_FRAME
    site = np.array(surface.site.position_km)
    assert np.linalg.norm(site) == pytest.approx(1737.4)
    for name, minimum_km in (("EARTH", 0.01), ("SUN", 1.0)):
        translated = np.array(center.target(name).position_km) - site
        apparent = np.array(surface.target(name).position_km)
        assert np.linalg.norm(translated - apparent) > minimum_km
        assert abs(center.target(name).range_km - surface.target(name).range_km) > 1000


def test_frame_realizations_stay_distinct():
    first = apparent_from_lunar_center(INSTANT)
    second = apparent_from_lunar_center(datetime(2024, 6, 21, 12, tzinfo=UTC))
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


def test_kernel_coverage_contains_the_admitted_interval():
    start, stop = ephemeris_coverage_et()
    assert spice.etcal(start) == "1849 DEC 26 00:00:00.000"
    assert spice.etcal(stop) == "2150 JAN 22 00:00:00.000"


def test_geometric_surface_vector_is_a_translation_and_apparent_vector_is_not():
    with spice_session():
        et = spice.str2et("2026-04-02 15:00:00.000 UTC")
        site = np.array(spice.georec(0.0, 0.0, 0.0, 1737.4, 0.0))
        for target in ("EARTH", "SUN"):
            geometric_center = np.array(
                spice.spkpos(target, et, LUNAR_FRAME, "NONE", "MOON")[0]
            )
            geometric_surface, _light = spice.spkcpo(
                target, et, LUNAR_FRAME, "OBSERVER", "NONE", site, "MOON", LUNAR_FRAME
            )
            assert np.allclose(
                geometric_surface[:3], geometric_center - site, atol=1e-6
            )
        center, _light = spice.spkezr("EARTH", et, LUNAR_FRAME, "LT+S", "MOON")
        shifted, _light = spice.spkcpo(
            "EARTH",
            et,
            LUNAR_FRAME,
            "OBSERVER",
            "LT+S",
            np.zeros(3),
            "MOON",
            LUNAR_FRAME,
        )
        assert np.allclose(center[:3], shifted[:3], atol=1e-9)


def test_apparent_vectors_match_horizons_icrf():
    for case in json.loads(EVIDENCE.read_text(encoding="utf-8"))["vectors"]:
        instant = datetime.fromisoformat(case["utc"])
        if case["locus"] == "center":
            result = apparent_from_lunar_center(instant, (case["target"],))
            position = result.target(case["target"]).position_km
            et = result.et_seconds
        else:
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
    sample = (EVIDENCE.parent / "muestra-observador-tierra.txt").read_text(
        encoding="utf-8"
    )
    assert "MEAN_ME (high precision)" in sample
    assert "Atmos refraction: NO (AIRLESS)" in sample
    assert "gravitational deflection of light" in sample


def _icrf(case: dict) -> np.ndarray:
    return np.array([case["x_km"], case["y_km"], case["z_km"]], dtype=float)
