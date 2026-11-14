from fastapi.testclient import TestClient

from ilargi.api import create_app

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
    assert weh["available"] is False
    assert len(ov["regions"]) == 1790


def test_analyze_single_and_multipoint_payload():
    resp = client.post(
        "/api/analyze",
        json={
            "points": [
                {
                    "label": "P1",
                    "site_name": "Polo Sur · Muestra LOLA Centro",
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
    assert "Sin datos" in p1["materials"]["water_status"]
    assert len(p1["series"]["sun"]) == 49
    assert len(p1["series"]["earth"]) == 49

    assert p2["label"] == "P2"
    assert p2["search_radius_km"] > 100.0
    assert p2["materials"]["in_coverage"] is False
    assert "Sin modelo" in p2["temperature_status"]


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
