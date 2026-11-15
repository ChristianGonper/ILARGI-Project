from dataclasses import replace
from datetime import UTC, datetime

import numpy as np
from fastapi.testclient import TestClient

from ilargi.analysis import analyze_site, dem_availability
from ilargi.api import _serialize_analysis, create_app

client = TestClient(create_app())


def test_health_and_sites_endpoints():
    health = client.get("/api/health")
    assert health.status_code == 200
    body = health.json()
    assert body["status"] == "ok"
    assert body["kernels"] == "DE440s"

    sites = client.get("/api/sites")
    assert sites.status_code == 200
    data = sites.json()
    assert len(data) >= 8
    assert any(s["id"] == "lola-center" for s in data)

    overlay = client.get("/api/materials-overlay")
    assert overlay.status_code == 200
    ov = overlay.json()
    elem_ids = [e["id"] for e in ov["elements"]]
    assert elem_ids == ["Al", "Ca", "FeO", "Th", "WEH"]
    weh = next(e for e in ov["elements"] if e["id"] == "WEH")
    assert weh["available"] is True
    assert len(ov["regions"]) == 1790


def test_analyze_single_and_multipoint_payload():
    resp = client.post(
        "/api/analyze",
        json={
            "points": [
                {
                    "label": "P1",
                    "site_name": "South Pole · LOLA Sample Center",
                    "latitude_deg": -89.5,
                    "longitude_east_deg": 0.0,
                    "start_utc": "2026-04-02T15:00:00Z",
                },
                {
                    "label": "P2",
                    "site_name": "Apollo 11",
                    "latitude_deg": 0.674,
                    "longitude_east_deg": 23.473,
                    "start_utc": "2026-04-02T15:00:00Z",
                },
            ],
            "duration_hours": 48,
            "step_minutes": 60,
            "instrument_height_m": 2.0,
            "azimuth_step_deg": 2.0,
            "dem_mode": "auto",
        },
    )
    assert resp.status_code == 200
    results = resp.json()["results"]
    assert len(results) == 2

    p1, p2 = results
    assert p1["label"] == "P1"
    assert p1["search_radius_km"] > 100.0
    assert p1["materials"]["in_coverage"] is True
    assert "Al" in p1["materials"]["elements"]
    assert "ppm H₂O equivalent" in p1["materials"]["water_status"]
    assert len(p1["series"]["sun"]) == 49
    assert len(p1["series"]["earth"]) == 49
    assert p1["series"]["sun"][0]["angular_radius_deg"] > 0.2
    assert "direct_visible_fraction" in p1["series"]["sun"][0]
    assert "max_eclipse_pct" in p1["visibility"]

    assert p2["label"] == "P2"
    assert p2["search_radius_km"] > 100.0
    assert p2["materials"]["in_coverage"] is True
    assert "No thermal model" in p2["temperature_status"]
    assert p2["series"]["sun"][0]["above_horizon_fraction"] is not None
    assert p2["series"]["sun"][0]["eclipsed_fraction"] is not None
    assert p2["series"]["sun"][0]["direct_visible_fraction"] is not None
    assert p2["series"]["sun"][0]["horizon_source"] == (
        "terrain" if dem_availability()["global_240m"] else "ideal"
    )


def test_serialized_track_identifies_missing_terrain_horizon():
    analysis = analyze_site(
        label="P1",
        site_name="Test",
        latitude_deg=0,
        longitude_east_deg=0,
        start_utc=datetime(2026, 4, 2, tzinfo=UTC),
        duration_hours=1,
        dem_mode="ideal",
    )
    series = analysis.series.copy()
    series.loc[series.index[0], "sampled_horizon_deg"] = np.nan
    data = _serialize_analysis(replace(analysis, horizon_mode="lola", series=series))
    samples = data["series"]["sun"] + data["series"]["earth"]
    assert sorted(sample["horizon_source"] for sample in samples) == [
        "ideal_fallback",
        "terrain",
        "terrain",
        "terrain",
    ]


def test_analyze_enforces_max_10_points_and_step_validation():
    eleven = [
        {
            "label": f"P{i + 1}",
            "site_name": f"Site {i + 1}",
            "latitude_deg": -89.5,
            "longitude_east_deg": float(i),
            "start_utc": "2026-04-02T15:00:00Z",
        }
        for i in range(11)
    ]
    resp = client.post("/api/analyze", json={"points": eleven})
    assert resp.status_code == 422

    bad_step = client.post(
        "/api/analyze",
        json={
            "points": [eleven[0]],
            "step_minutes": 15,
        },
    )
    assert bad_step.status_code == 422


def test_education_sites_and_cycle_endpoint():
    sites_resp = client.get("/api/education/sites")
    assert sites_resp.status_code == 200
    edu_sites = sites_resp.json()
    categories = {s["category"] for s in edu_sites}
    assert {"landing", "eternal_light", "psr", "mirror"}.issubset(categories)

    cycle_resp = client.post(
        "/api/education/cycle",
        json={
            "latitude_deg": -84.678,
            "longitude_east_deg": -48.693,
            "start_utc": "2026-04-02T15:00:00Z",
            "duration_hours": 709.0,
            "step_minutes": 360,
        },
    )
    assert cycle_resp.status_code == 200
    data = cycle_resp.json()
    avail = dem_availability()
    expected_edu_mode = (
        "lola" if (avail["polar_80m"] or avail["global_240m"]) else "ideal"
    )
    assert data["site"]["horizon_mode"] == expected_edu_mode
    assert data["lunar_day_hours"] > 700.0
    assert len(data["frames"]) >= 100
    first = data["frames"][0]
    assert len(first["sun_me_unit"]) == 3
    assert len(first["earth_me_unit"]) == 3
    assert len(first["sun_earth_km"]) == 3
    assert len(first["sun_moon_km"]) == 3
    assert len(first["earth_moon_km"]) == 3
    assert 350_000.0 <= first["earth_moon_dist_km"] <= 415_000.0
    assert 140_000_000.0 <= first["sun_earth_dist_km"] <= 155_000_000.0


def test_api_respects_terrain_dir_override(tmp_path, monkeypatch):
    monkeypatch.setenv("ILARGI_TERRAIN_DIR", str(tmp_path))
    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["dem"] == {
        "polar_80m": False,
        "global_240m": False,
        "sample_20m": True,
        "sample_80m": True,
    }
    cycle_resp = client.post(
        "/api/education/cycle",
        json={
            "latitude_deg": -84.678,
            "longitude_east_deg": -48.693,
            "start_utc": "2026-04-02T15:00:00Z",
            "duration_hours": 12.0,
            "step_minutes": 180,
        },
    )
    assert cycle_resp.status_code == 200
    assert cycle_resp.json()["site"]["horizon_mode"] == "ideal"
