import json
from hashlib import sha256
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from ilargi.api import AnalyzeRequest, create_app

DEMO = Path(__file__).resolve().parent.parent / "web" / "public" / "demo"


def test_saved_catalog_integrity_and_coverage():
    manifest = json.loads((DEMO / "manifest.json").read_text(encoding="utf-8"))
    for filename, digest in manifest["files_sha256"].items():
        assert sha256((DEMO / filename).read_bytes()).hexdigest() == digest
    assert len(manifest["analyses"]) == 11
    assert len(manifest["cycles"]) == 23
    for entry in manifest["analyses"]:
        result = json.loads((DEMO / entry["file"]).read_text(encoding="utf-8"))
        assert result["latitude_deg"] == entry["latitude_deg"]
        assert result["duration_hours"] == manifest["analysis"]["duration_hours"]
        assert len(result["series"]["sun"]) >= 720
    for entry in manifest["cycles"]:
        result = json.loads((DEMO / entry["file"]).read_text(encoding="utf-8"))
        assert len(result["frames"]) >= 237
        assert result["site"]["latitude_deg"] == entry["latitude_deg"]


def test_configured_cors_is_explicit(monkeypatch):
    monkeypatch.setenv("ILARGI_CORS_ORIGINS", "https://ilargi.pages.dev")
    with TestClient(create_app()) as client:
        allowed = client.options(
            "/api/analyze",
            headers={
                "Origin": "https://ilargi.pages.dev",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert (
            allowed.headers["access-control-allow-origin"] == "https://ilargi.pages.dev"
        )
        denied = client.options(
            "/api/analyze",
            headers={
                "Origin": "https://other.example",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert "access-control-allow-origin" not in denied.headers


def test_public_api_rejects_excessive_batch_before_computing():
    point = {
        "label": "P1",
        "site_name": "test",
        "latitude_deg": 0,
        "longitude_east_deg": 0,
        "start_utc": "2026-04-02T15:00:00Z",
    }
    with pytest.raises(ValueError, match="25,000"):
        AnalyzeRequest(points=[point] * 10, duration_hours=2160, step_minutes=10)
