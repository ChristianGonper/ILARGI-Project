"""Compare deployed full-terrain results with the same local scientific engine."""

import argparse
import json
import time
from datetime import UTC, datetime
from pathlib import Path
from urllib.request import Request, urlopen

import numpy as np

from ilargi.analysis import analyze_site
from ilargi.api import _serialize_analysis
from ilargi.ephemeris import load_kernels


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-url", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    load_kernels()
    summaries = []
    for name, lat, lon in [
        ("South Pole sample center", -89.5, 0.0),
        ("Malapert", -86.0, 2.0),
        ("Apollo 11", 0.67408, 23.47297),
    ]:
        payload = {
            "points": [
                {
                    "label": "P1",
                    "site_name": name,
                    "latitude_deg": lat,
                    "longitude_east_deg": lon,
                    "start_utc": "2026-04-02T15:00:00Z",
                }
            ],
            "duration_hours": 720,
            "step_minutes": 60,
            "instrument_height_m": 2,
            "azimuth_step_deg": 0.25,
            "dem_mode": "auto",
        }
        start = time.monotonic()
        request = Request(
            args.api_url.rstrip("/") + "/api/analyze",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
        )
        with urlopen(request, timeout=175) as response:
            remote = json.load(response)["results"][0]
        remote_seconds = time.monotonic() - start
        local = _serialize_analysis(
            analyze_site(
                label="P1",
                site_name=name,
                latitude_deg=lat,
                longitude_east_deg=lon,
                start_utc=datetime(2026, 4, 2, 15, tzinfo=UTC),
                duration_hours=720,
                step_minutes=60,
                instrument_height_m=2,
                azimuth_step_deg=0.25,
                dem_mode="auto",
            )
        )
        for field in ("elevation_deg", "coverage_km"):
            np.testing.assert_allclose(
                remote["horizon_profile"][field],
                local["horizon_profile"][field],
                rtol=0,
                atol=1e-8,
            )
        assert remote["horizon_mode"] == local["horizon_mode"] == "lola"
        assert (
            remote["horizon_profile"]["truncated"]
            == local["horizon_profile"]["truncated"]
        )
        for key, value in local["visibility"].items():
            np.testing.assert_allclose(
                remote["visibility"][key], value, rtol=0, atol=1e-6
            )
        summary = {
            "site": name,
            "remote_seconds": round(remote_seconds, 3),
            "horizon": remote["horizon_label"],
            "truncated_azimuths": sum(remote["horizon_profile"]["truncated"]),
            "sun_pct": remote["visibility"]["sun_pct"],
            "matches_local": True,
        }
        summaries.append(summary)
        print(json.dumps(summary), flush=True)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(summaries, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
