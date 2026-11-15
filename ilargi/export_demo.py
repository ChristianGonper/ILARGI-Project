"""Export real API responses for the standalone jury demonstration."""

import json
import os
import subprocess
from datetime import UTC, datetime
from hashlib import sha256
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Make exports independent of a developer's optional, multi-GB terrain cache.
os.environ["ILARGI_TERRAIN_DIR"] = str(ROOT / "data" / "terrain")

from ilargi.analysis import analyze_site, dem_availability  # noqa: E402
from ilargi.api import _cached_materials_overlay, _serialize_analysis  # noqa: E402
from ilargi.education import compute_education_cycle  # noqa: E402
from ilargi.kernels import KERNELS, verify  # noqa: E402
from ilargi.sites import EDUCATION_SITES, HISTORICAL_SITES  # noqa: E402

START = "2026-04-02T15:00:00Z"
OUTPUT = ROOT / "web" / "public" / "demo"


def export_demo(output: Path = OUTPUT) -> None:
    verify()
    output.mkdir(parents=True, exist_ok=True)
    files = {}

    def write(name: str, value) -> str:
        raw = json.dumps(
            value, ensure_ascii=False, allow_nan=False, separators=(",", ":")
        )
        (output / name).write_bytes((raw + "\n").encode("utf-8"))
        files[name] = sha256((raw + "\n").encode()).hexdigest()
        return name

    from dataclasses import asdict

    write("sites.json", [asdict(s) for s in HISTORICAL_SITES])
    write("education-sites.json", [asdict(s) for s in EDUCATION_SITES])
    write("materials-overlay.json", _cached_materials_overlay())
    analyses = []
    cycles = []
    start = datetime.fromisoformat(START)
    for site in HISTORICAL_SITES:
        print(f"Analysis: {site.id}", flush=True)
        result = analyze_site(
            label="P1",
            site_name=site.name,
            latitude_deg=site.latitude_deg,
            longitude_east_deg=site.longitude_east_deg,
            start_utc=start,
            duration_hours=720,
            step_minutes=60,
            instrument_height_m=2,
            azimuth_step_deg=0.25,
            dem_mode="auto",
        )
        analyses.append(
            {
                "id": site.id,
                "latitude_deg": site.latitude_deg,
                "longitude_east_deg": site.longitude_east_deg,
                "file": write(f"analysis-{site.id}.json", _serialize_analysis(result)),
            }
        )
    for site in EDUCATION_SITES:
        print(f"Education: {site.id}", flush=True)
        result = compute_education_cycle(
            latitude_deg=site.latitude_deg,
            longitude_east_deg=site.longitude_east_deg,
            start_utc=start,
            duration_hours=709,
            step_minutes=180,
        )
        cycles.append(
            {
                "id": site.id,
                "latitude_deg": site.latitude_deg,
                "longitude_east_deg": site.longitude_east_deg,
                "file": write(f"education-{site.id}.json", result),
            }
        )
    manifest = {
        "schema_version": 1,
        "generated_utc": datetime.now(UTC).isoformat(),
        "engine_commit": subprocess.check_output(
            ["git", "rev-parse", "HEAD"],
            cwd=ROOT,
            text=True,
        ).strip(),
        "start_utc": START,
        "analysis": {
            "duration_hours": 720,
            "step_minutes": 60,
            "instrument_height_m": 2,
            "azimuth_step_deg": 0.25,
            "dem_mode": "auto",
        },
        "education": {"duration_hours": 709, "step_minutes": 180},
        "terrain": dem_availability(),
        "kernels_sha256": {name: expected for name, (_, expected) in KERNELS.items()},
        "sources": "/sources.md",
        "analyses": analyses,
        "cycles": cycles,
        "files_sha256": files,
    }
    write("manifest.json", manifest)
    (output.parent / "sources.md").write_bytes(
        (ROOT / "docs" / "sources.md").read_bytes()
    )


if __name__ == "__main__":
    export_demo()
