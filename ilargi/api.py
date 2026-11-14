"""API FastAPI de ILARGI para servir efemérides, horizontes LOLA, visibilidad y materiales."""

from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path
from typing import Literal

import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from spiceypy.utils.exceptions import SpiceyError

from ilargi.analysis import (
    SiteAnalysis,
    analyze_site,
    dem_availability,
)
from ilargi.materials import load_regions
from ilargi.sites import HISTORICAL_SITES

WEB_DIST = Path(__file__).resolve().parent.parent / "web" / "dist"


@lru_cache(maxsize=1)
def _cached_regions():
    return load_regions()


class PointInput(BaseModel):
    label: str = Field(min_length=1, max_length=16)
    site_name: str = Field(min_length=1, max_length=120)
    latitude_deg: float = Field(gt=-90.0, lt=90.0)
    longitude_east_deg: float = Field(ge=-180.0, le=360.0)
    start_utc: datetime


class AnalyzeRequest(BaseModel):
    points: list[PointInput] = Field(min_length=1, max_length=10)
    duration_hours: float = Field(default=720.0, gt=0.0, le=2160.0)
    step_minutes: int = Field(default=60, ge=10, le=1440)
    instrument_height_m: float = Field(default=2.0, ge=0.0, le=1000.0)
    search_km: float = Field(default=20.0, ge=1.0, le=500.0)
    azimuth_step_deg: float = Field(default=1.0, gt=0.0, le=10.0)
    dem_mode: Literal["auto", "polar", "global", "sample20", "sample80", "ideal"] = (
        "auto"
    )


def _finite_or_none(value: float | None) -> float | None:
    if value is None:
        return None
    f = float(value)
    return f if np.isfinite(f) else None


def _serialize_analysis(analysis: SiteAnalysis) -> dict:
    horizon = analysis.horizon
    effective_target_m = (
        horizon.requested_m
        if horizon.required_m is None
        else np.minimum(horizon.requested_m, horizon.required_m)
    )
    truncated = (
        horizon.coverage_m < effective_target_m - horizon.pixel_m
    ) & np.isfinite(horizon.elevation_deg)

    def _serialize_track(body: str) -> list[dict]:
        sub = analysis.series[analysis.series["objetivo"] == body].sort_values("utc")
        return [
            {
                "utc": row.utc.isoformat(),
                "azimuth_deg": float(row.azimut_deg),
                "elevation_deg": float(row.elevacion_deg),
                "horizon_deg": float(row.horizonte_efectivo_deg),
                "margin_deg": float(row.margen_efectivo_deg),
                "visible": bool(row.visible),
                "range_km": float(row.distancia_km),
            }
            for row in sub.itertuples()
        ]

    def _serialize_event(ev) -> dict:
        return {
            "body": ev.body,
            "event_type": ev.event_type,
            "utc": ev.utc.isoformat(),
            "azimuth_deg": float(ev.azimuth_deg),
            "horizon_deg": float(ev.horizon_deg),
        }

    def _serialize_span(span) -> dict | None:
        if span is None:
            return None
        return {
            "body": span.body,
            "start_utc": span.start_utc.isoformat(),
            "end_utc": span.end_utc.isoformat(),
            "duration_hours": float(span.duration_hours),
            "bounded_start": bool(span.bounded_start),
            "bounded_end": bool(span.bounded_end),
        }

    inc = analysis.incidence
    mat = analysis.materials
    return {
        "label": analysis.label,
        "site_name": analysis.site_name,
        "latitude_deg": analysis.latitude_deg,
        "longitude_east_deg": analysis.longitude_east_deg,
        "start_utc": analysis.start_utc.isoformat(),
        "duration_hours": analysis.duration_hours,
        "step_minutes": analysis.step_minutes,
        "instrument_height_m": analysis.instrument_height_m,
        "horizon_mode": analysis.horizon_mode,
        "horizon_label": analysis.horizon_label,
        "ground_elevation_m": (
            float(analysis.terrain.elevation_m)
            if analysis.terrain is not None
            else None
        ),
        "pixel_m": float(horizon.pixel_m),
        "horizon_profile": {
            "azimuth_deg": [float(v) for v in horizon.azimuth_deg],
            "elevation_deg": [_finite_or_none(v) for v in horizon.elevation_deg],
            "coverage_km": [float(v / 1000.0) for v in horizon.coverage_m],
            "truncated": [bool(v) for v in truncated],
        },
        "series": {
            "sun": _serialize_track("SUN"),
            "earth": _serialize_track("EARTH"),
        },
        "visibility": {
            "sun_pct": float(analysis.sun_visible_pct),
            "earth_pct": float(analysis.earth_visible_pct),
            "both_pct": float(analysis.both_visible_pct),
            "sun_hours": float(analysis.sun_visible_hours),
            "earth_hours": float(analysis.earth_visible_hours),
            "both_hours": float(analysis.both_visible_hours),
        },
        "events": {
            "sunsets": [_serialize_event(e) for e in analysis.sunsets],
            "sunrises": [_serialize_event(e) for e in analysis.sunrises],
            "earthsets": [_serialize_event(e) for e in analysis.earthsets],
            "earthrises": [_serialize_event(e) for e in analysis.earthrises],
        },
        "nights": {
            "longest": _serialize_span(analysis.longest_night),
            "others": [_serialize_span(s) for s in analysis.other_nights],
            "earth_outages": [_serialize_span(s) for s in analysis.earth_outages],
        },
        "incidence": {
            "min_deg": _finite_or_none(inc.min_incidence_deg),
            "max_deg": _finite_or_none(inc.max_incidence_deg),
            "mean_deg": _finite_or_none(inc.mean_incidence_deg),
            "median_deg": _finite_or_none(inc.median_incidence_deg),
            "std_deg": _finite_or_none(inc.std_incidence_deg),
            "max_sun_elevation_deg": float(inc.max_sun_elevation_deg),
            "min_sun_elevation_deg": float(inc.min_sun_elevation_deg),
            "sunlit_samples": int(inc.sunlit_samples),
            "total_samples": int(inc.total_samples),
        },
        "materials": {
            "in_coverage": mat.in_coverage,
            "region_id": mat.region_id,
            "elements": {
                sym: {
                    "value": _finite_or_none(val),
                    "unit": unit,
                    "category": cat,
                }
                for sym, (val, unit, cat) in mat.elements.items()
            },
            "water_status": mat.water_status,
        },
        "temperature_status": analysis.temperature_status,
    }


def create_app() -> FastAPI:
    app = FastAPI(
        title="ILARGI Scientific API",
        description="Interactive Lunar Analyzer for Radiance, Geometry, and Intervisibility",
        version="0.2.0",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:8000",
            "http://127.0.0.1:8000",
        ],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    def health() -> dict:
        return {
            "status": "ok",
            "kernels": "DE440s",
            "frame": "MOON_ME_DE440_ME421",
            "abcorr": "LT+S",
            "dem": dem_availability(),
        }

    @app.get("/api/sites")
    def list_sites() -> list[dict]:
        return [
            {
                "id": s.id,
                "name": s.name,
                "mission": s.mission,
                "latitude_deg": s.latitude_deg,
                "longitude_east_deg": s.longitude_east_deg,
                "region": s.region,
                "in_lola_sample": s.in_lola_sample,
            }
            for s in HISTORICAL_SITES
        ]

    @app.post("/api/analyze")
    async def analyze_points(payload: AnalyzeRequest) -> dict:
        if payload.step_minutes % 10 != 0:
            raise HTTPException(
                status_code=422,
                detail="step_minutes debe ser múltiplo de 10 minutos (mínimo 10).",
            )

        def _run_batch() -> list[dict]:
            regions = _cached_regions()
            out: list[dict] = []
            for pt in payload.points:
                start = (
                    pt.start_utc.replace(tzinfo=UTC)
                    if pt.start_utc.tzinfo is None
                    else pt.start_utc.astimezone(UTC)
                )
                analysis = analyze_site(
                    label=pt.label,
                    site_name=pt.site_name,
                    latitude_deg=pt.latitude_deg,
                    longitude_east_deg=pt.longitude_east_deg,
                    start_utc=start,
                    duration_hours=payload.duration_hours,
                    step_minutes=payload.step_minutes,
                    instrument_height_m=payload.instrument_height_m,
                    search_km=payload.search_km,
                    azimuth_step_deg=payload.azimuth_step_deg,
                    dem_mode=payload.dem_mode,
                    regions=regions,
                )
                out.append(_serialize_analysis(analysis))
            return out

        try:
            results = await run_in_threadpool(_run_batch)
        except (ValueError, OSError, SpiceyError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return {"results": results}

    if WEB_DIST.is_dir():
        app.mount("/", StaticFiles(directory=str(WEB_DIST), html=True), name="web")

    return app


app = create_app()


def serve(host: str = "127.0.0.1", port: int = 8000) -> None:
    uvicorn.run(app, host=host, port=port)
