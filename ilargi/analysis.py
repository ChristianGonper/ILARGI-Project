"""Análisis científico por emplazamiento: visibilidad, eventos, noches, incidencia y materiales."""

from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

from ilargi.discs import angular_radius, disc_visibility
from ilargi.horizon import (
    Horizon,
    calculate_horizon,
    calculate_multiresolution_horizon,
    estimate_search_radius,
    horizon_at,
)
from ilargi.materials import MATERIALS, load_regions, region_at, weh_at
from ilargi.series import sky_series
from ilargi.terrain import GLOBAL, POLAR, SAMPLE, TerrainSample, sample_elevation

SAMPLE_20 = SAMPLE.with_name("lola_20m_south_pole_sample.tif")


@dataclass(frozen=True)
class VisibilityEvent:
    body: str
    event_type: str  # "sunset" | "sunrise" | "earthset" | "earthrise"
    utc: datetime
    azimuth_deg: float
    horizon_deg: float


@dataclass(frozen=True)
class ShadowSpan:
    body: str
    start_utc: datetime
    end_utc: datetime
    duration_hours: float
    bounded_start: bool
    bounded_end: bool


@dataclass(frozen=True)
class IncidenceStats:
    min_incidence_deg: float | None
    max_incidence_deg: float | None
    mean_incidence_deg: float | None
    median_incidence_deg: float | None
    std_incidence_deg: float | None
    max_sun_elevation_deg: float
    min_sun_elevation_deg: float
    sunlit_samples: int
    total_samples: int


@dataclass(frozen=True)
class MaterialsSummary:
    in_coverage: bool
    region_id: int | None
    elements: dict[str, tuple[float | None, str, str]]  # symbol -> (val, unit, cat)
    water_status: str


@dataclass(frozen=True)
class SiteAnalysis:
    label: str
    site_name: str
    latitude_deg: float
    longitude_east_deg: float
    start_utc: datetime
    duration_hours: float
    step_minutes: int
    instrument_height_m: float
    horizon_mode: str  # "lola" | "ideal"
    horizon_label: str
    search_radius_km: float
    terrain: TerrainSample | None
    horizon: Horizon
    series: pd.DataFrame
    sun_visible_pct: float
    earth_visible_pct: float
    both_visible_pct: float
    sun_visible_hours: float
    earth_visible_hours: float
    both_visible_hours: float
    sunsets: tuple[VisibilityEvent, ...]
    sunrises: tuple[VisibilityEvent, ...]
    earthsets: tuple[VisibilityEvent, ...]
    earthrises: tuple[VisibilityEvent, ...]
    longest_night: ShadowSpan | None
    other_nights: tuple[ShadowSpan, ...]
    earth_outages: tuple[ShadowSpan, ...]
    incidence: IncidenceStats
    materials: MaterialsSummary
    temperature_status: str = "Sin modelo térmico en esta versión"


def ideal_horizon(observer_m: float = 2.0, azimuth_step_deg: float = 2.0) -> Horizon:
    """Horizonte esférico ideal a 0° para ubicaciones fuera del recorte LOLA."""
    n_az = int(np.ceil(360.0 / azimuth_step_deg))
    azimuth = np.arange(n_az, dtype=float) * (360.0 / n_az)
    elevation = np.zeros(n_az, dtype=float)
    coverage = np.zeros(n_az, dtype=float)
    return Horizon(
        azimuth_deg=azimuth,
        elevation_deg=elevation,
        coverage_m=coverage,
        requested_m=0.0,
        pixel_m=0.0,
        ground_m=0.0,
        observer_m=float(observer_m),
        physical_max_m=None,
        required_m=None,
    )


def _circular_interp_deg(az0: float, az1: float, frac: float) -> float:
    delta = ((az1 - az0 + 180.0) % 360.0) - 180.0
    return float((az0 + frac * delta) % 360.0)


def _extract_body_events_and_spans(
    track: pd.DataFrame,
    body: str,
) -> tuple[
    tuple[VisibilityEvent, ...],
    tuple[VisibilityEvent, ...],
    tuple[ShadowSpan, ...],
    list[tuple[float, float]],
]:
    """Detecta cruces de visibilidad y tramos continuos de oclusión e iluminación."""
    if track.empty:
        return (), (), (), []

    times = track["utc"].tolist()
    margins = track["margen_efectivo_deg"].to_numpy(dtype=float)
    azimuths = track["azimut_deg"].to_numpy(dtype=float)
    horizons = track["horizonte_efectivo_deg"].to_numpy(dtype=float)
    visible = margins > 0.0

    t0 = times[0]
    total_s = max(1e-9, (times[-1] - t0).total_seconds())
    set_name = "sunset" if body == "SUN" else "earthset"
    rise_name = "sunrise" if body == "SUN" else "earthrise"

    sets: list[VisibilityEvent] = []
    rises: list[VisibilityEvent] = []
    spans: list[ShadowSpan] = []
    lit_intervals: list[tuple[float, float]] = []

    span_start: datetime | None = None
    span_bounded_start = False
    lit_start: float | None = 0.0 if visible[0] else None

    if not visible[0]:
        span_start = times[0]
        span_bounded_start = False

    for idx in range(len(times) - 1):
        v0, v1 = bool(visible[idx]), bool(visible[idx + 1])
        if v0 == v1:
            continue
        m0, m1 = float(margins[idx]), float(margins[idx + 1])
        denom = m0 - m1
        frac = 0.5 if denom == 0.0 else float(np.clip(m0 / denom, 0.0, 1.0))
        dt_s = (times[idx + 1] - times[idx]).total_seconds()
        t_cross = times[idx] + timedelta(seconds=dt_s * frac)
        az_cross = _circular_interp_deg(
            float(azimuths[idx]), float(azimuths[idx + 1]), frac
        )
        h_cross = float(horizons[idx] + frac * (horizons[idx + 1] - horizons[idx]))
        rel_cross = (t_cross - t0).total_seconds()

        if v0 and not v1:
            sets.append(
                VisibilityEvent(
                    body=body,
                    event_type=set_name,
                    utc=t_cross,
                    azimuth_deg=az_cross,
                    horizon_deg=h_cross,
                )
            )
            if lit_start is not None:
                lit_intervals.append((lit_start, rel_cross))
                lit_start = None
            span_start = t_cross
            span_bounded_start = True
        else:
            rises.append(
                VisibilityEvent(
                    body=body,
                    event_type=rise_name,
                    utc=t_cross,
                    azimuth_deg=az_cross,
                    horizon_deg=h_cross,
                )
            )
            if span_start is not None:
                dur_h = (t_cross - span_start).total_seconds() / 3600.0
                spans.append(
                    ShadowSpan(
                        body=body,
                        start_utc=span_start,
                        end_utc=t_cross,
                        duration_hours=dur_h,
                        bounded_start=span_bounded_start,
                        bounded_end=True,
                    )
                )
                span_start = None
            lit_start = rel_cross

    if lit_start is not None:
        lit_intervals.append((lit_start, total_s))
    if span_start is not None:
        dur_h = (times[-1] - span_start).total_seconds() / 3600.0
        spans.append(
            ShadowSpan(
                body=body,
                start_utc=span_start,
                end_utc=times[-1],
                duration_hours=dur_h,
                bounded_start=span_bounded_start,
                bounded_end=False,
            )
        )

    return tuple(sets), tuple(rises), tuple(spans), lit_intervals


def _intervals_hours(intervals: list[tuple[float, float]]) -> float:
    return sum(max(0.0, b - a) for a, b in intervals) / 3600.0


def _intersect_hours(
    a_list: list[tuple[float, float]], b_list: list[tuple[float, float]]
) -> float:
    total_s = 0.0
    i = j = 0
    while i < len(a_list) and j < len(b_list):
        a0, a1 = a_list[i]
        b0, b1 = b_list[j]
        lo = max(a0, b0)
        hi = min(a1, b1)
        if hi > lo:
            total_s += hi - lo
        if a1 < b1:
            i += 1
        else:
            j += 1
    return total_s / 3600.0


def compute_incidence_stats(sun_track: pd.DataFrame) -> IncidenceStats:
    """Calcula estadísticas del ángulo de incidencia solar respecto a la normal local."""
    elevations = sun_track["elevacion_deg"].to_numpy(dtype=float)
    sunlit = sun_track["visible"].to_numpy(dtype=bool)
    sunlit_elev = elevations[sunlit]
    if sunlit_elev.size == 0:
        return IncidenceStats(
            min_incidence_deg=None,
            max_incidence_deg=None,
            mean_incidence_deg=None,
            median_incidence_deg=None,
            std_incidence_deg=None,
            max_sun_elevation_deg=float(np.max(elevations)),
            min_sun_elevation_deg=float(np.min(elevations)),
            sunlit_samples=0,
            total_samples=int(elevations.size),
        )
    incidence = 90.0 - sunlit_elev
    return IncidenceStats(
        min_incidence_deg=float(np.min(incidence)),
        max_incidence_deg=float(np.max(incidence)),
        mean_incidence_deg=float(np.mean(incidence)),
        median_incidence_deg=float(np.median(incidence)),
        std_incidence_deg=float(np.std(incidence)),
        max_sun_elevation_deg=float(np.max(elevations)),
        min_sun_elevation_deg=float(np.min(elevations)),
        sunlit_samples=int(sunlit_elev.size),
        total_samples=int(elevations.size),
    )


def summarize_materials(
    latitude_deg: float, longitude_east_deg: float, regions: pd.DataFrame | None = None
) -> MaterialsSummary:
    """Consulta abundancias regionales globales de LP-GRS y el estado de WEH."""
    weh = weh_at(latitude_deg, longitude_east_deg)
    water_status = (
        f"{weh:.0f} ppm H₂O equivalente (Lawrence et al. 2022)"
        if weh is not None
        else "Sin datos WEH"
    )
    if regions is None:
        regions = load_regions()
    row = region_at(regions, latitude_deg, longitude_east_deg)
    if row is None:
        return MaterialsSummary(
            in_coverage=False,
            region_id=None,
            elements={},
            water_status=water_status,
        )
    elements: dict[str, tuple[float | None, str, str]] = {}
    for _, (col, unit) in MATERIALS.items():
        val = float(row[col]) if np.isfinite(row[col]) else None
        cat = str(row[f"{col}_category"])
        elements[col] = (val, unit, cat)
    return MaterialsSummary(
        in_coverage=True,
        region_id=int(row["id"]),
        elements=elements,
        water_status=water_status,
    )


def dem_availability() -> dict[str, bool]:
    """Indica qué productos topográficos LOLA están presentes en disco."""
    return {
        "polar_80m": POLAR.is_file() and POLAR.stat().st_size == 189158392,
        "global_240m": (
            GLOBAL.is_file()
            and GLOBAL.with_suffix(".img").is_file()
            and GLOBAL.with_suffix(".img").stat().st_size == 2123366400
        ),
        "sample_20m": SAMPLE_20.is_file(),
        "sample_80m": SAMPLE.is_file(),
    }


def _resolve_dem_candidates(
    latitude_deg: float, dem_mode: str, dem_path: Path | None
) -> list[Path]:
    if dem_path is not None:
        return [dem_path]
    avail = dem_availability()
    if dem_mode == "ideal":
        return []
    if dem_mode == "polar":
        return (
            [POLAR] if avail["polar_80m"] else ([SAMPLE] if avail["sample_80m"] else [])
        )
    if dem_mode == "global":
        return [GLOBAL] if avail["global_240m"] else []
    if dem_mode == "sample20":
        return [SAMPLE_20] if avail["sample_20m"] else []
    if dem_mode == "sample80":
        return [SAMPLE] if avail["sample_80m"] else []
    # Modo automático: mejor resolución disponible que cubra la latitud.
    candidates: list[Path] = []
    if latitude_deg <= -80.0:
        if avail["polar_80m"]:
            candidates.append(POLAR)
        if avail["sample_80m"]:
            candidates.append(SAMPLE)
    if avail["global_240m"]:
        candidates.append(GLOBAL)
    return candidates


def _safe_fine_distance_m(
    target_m: float, pixel_m: float, azimuth_step_deg: float
) -> float:
    n_az = max(1, int(np.ceil(360.0 / azimuth_step_deg)))
    max_safe_m = (3_800_000 / n_az) * pixel_m
    return float(min(target_m, max_safe_m))


def analyze_site(
    *,
    label: str,
    site_name: str,
    latitude_deg: float,
    longitude_east_deg: float,
    start_utc: datetime,
    duration_hours: float = 720.0,
    step_minutes: int = 60,
    instrument_height_m: float = 2.0,
    azimuth_step_deg: float = 1.0,
    dem_path: Path | None = None,
    dem_mode: str = "auto",
    regions: pd.DataFrame | None = None,
) -> SiteAnalysis:
    """Ejecuta el análisis completo de un punto lunar con radio del plano tangente."""
    terrain: TerrainSample | None = None
    horizon: Horizon | None = None
    horizon_mode = "ideal"
    horizon_label = "Esfera ideal (0°) — sin cobertura DEM"
    avail = dem_availability()
    search_radius_km = (
        estimate_search_radius(
            instrument_height_m, min_elevation_deg=0.0
        ).tangent_plane_m
        / 1000.0
    )

    for candidate in _resolve_dem_candidates(latitude_deg, dem_mode, dem_path):
        try:
            terrain = sample_elevation(latitude_deg, longitude_east_deg, candidate)
            observer_m = terrain.elevation_m + instrument_height_m
            tangent_m = estimate_search_radius(
                observer_m, min_elevation_deg=0.0
            ).tangent_plane_m

            coarse_path: Path | None = None
            if candidate in (SAMPLE_20, SAMPLE) and avail["polar_80m"]:
                coarse_path = POLAR
            elif candidate != GLOBAL and avail["global_240m"]:
                coarse_path = GLOBAL

            if coarse_path is not None:
                fine_limit = (
                    min(tangent_m, 15_000.0)
                    if candidate == SAMPLE_20
                    else _safe_fine_distance_m(
                        tangent_m, terrain.pixel_size_m, azimuth_step_deg
                    )
                )
                horizon = calculate_multiresolution_horizon(
                    latitude_deg,
                    longitude_east_deg,
                    instrument_height_m=instrument_height_m,
                    fine_distance_m=fine_limit,
                    max_distance_m=tangent_m,
                    azimuth_step_deg=azimuth_step_deg,
                    fine_path=candidate,
                    coarse_path=coarse_path,
                )
            else:
                single_limit = _safe_fine_distance_m(
                    tangent_m, terrain.pixel_size_m, azimuth_step_deg
                )
                horizon = calculate_horizon(
                    latitude_deg,
                    longitude_east_deg,
                    instrument_height_m=instrument_height_m,
                    max_distance_m=single_limit,
                    azimuth_step_deg=azimuth_step_deg,
                    path=candidate,
                )

            horizon_mode = "lola"
            search_radius_km = float(horizon.requested_m / 1000.0)
            res_tag = (
                "≈237" if candidate == GLOBAL else f"{int(round(horizon.pixel_m))}"
            )
            horizon_label = (
                f"LOLA {res_tag} m/píxel + Global"
                if coarse_path == GLOBAL
                else f"LOLA {res_tag} m/píxel ({candidate.stem})"
            )
            break
        except ValueError:
            terrain = None
            horizon = None

    if horizon is None:
        horizon = ideal_horizon(
            observer_m=instrument_height_m, azimuth_step_deg=azimuth_step_deg
        )

    observer_height_m = (
        terrain.elevation_m + instrument_height_m
        if terrain is not None
        else instrument_height_m
    )
    series = sky_series(
        start_utc,
        duration_hours,
        step_minutes,
        latitude_deg,
        longitude_east_deg,
        observer_height_m,
    )
    sampled_h = horizon_at(horizon, series["azimut_deg"])
    effective_h = np.where(np.isfinite(sampled_h), sampled_h, 0.0)
    series["horizonte_parcial_deg"] = sampled_h
    series["horizonte_efectivo_deg"] = effective_h
    series["margen_efectivo_deg"] = series["elevacion_deg"] - effective_h
    series["visible"] = series["margen_efectivo_deg"] > 0.0
    series["radio_angular_deg"] = [
        float(np.rad2deg(angular_radius(row.objetivo, row.distancia_km)))
        for row in series.itertuples()
    ]
    earth_by_utc = {
        row.utc: row for row in series[series["objetivo"] == "EARTH"].itertuples()
    }
    above_frac: list[float] = []
    eclipsed_frac: list[float] = []
    visible_frac: list[float] = []
    for row in series.itertuples():
        above, eclipsed, visible = disc_visibility(
            row.objetivo, row, horizon, earth_by_utc.get(row.utc)
        )
        above_frac.append(above)
        eclipsed_frac.append(eclipsed)
        visible_frac.append(visible)
    series["fraccion_sobre_horizonte"] = above_frac
    series["fraccion_eclipsada"] = eclipsed_frac
    series["fraccion_visible_directa"] = visible_frac

    sun_track = series[series["objetivo"] == "SUN"].sort_values("utc")
    earth_track = series[series["objetivo"] == "EARTH"].sort_values("utc")

    sunsets, sunrises, sun_spans, sun_lit = _extract_body_events_and_spans(
        sun_track, "SUN"
    )
    earthsets, earthrises, earth_spans, earth_lit = _extract_body_events_and_spans(
        earth_track, "EARTH"
    )

    sorted_nights = sorted(sun_spans, key=lambda s: s.duration_hours, reverse=True)
    longest_night = sorted_nights[0] if sorted_nights else None
    other_nights = tuple(sorted_nights[1:]) if len(sorted_nights) > 1 else ()

    sorted_outages = tuple(
        sorted(earth_spans, key=lambda s: s.duration_hours, reverse=True)
    )

    sun_h = _intervals_hours(sun_lit)
    earth_h = _intervals_hours(earth_lit)
    both_h = _intersect_hours(sun_lit, earth_lit)
    total_h = (
        (sun_track["utc"].iloc[-1] - sun_track["utc"].iloc[0]).total_seconds() / 3600.0
        if len(sun_track) >= 2
        else float(duration_hours)
    )
    denom_h = max(1e-9, total_h)

    incidence = compute_incidence_stats(sun_track)
    materials = summarize_materials(latitude_deg, longitude_east_deg, regions=regions)

    return SiteAnalysis(
        label=label,
        site_name=site_name,
        latitude_deg=float(latitude_deg),
        longitude_east_deg=float(longitude_east_deg),
        start_utc=start_utc,
        duration_hours=float(duration_hours),
        step_minutes=int(step_minutes),
        instrument_height_m=float(instrument_height_m),
        horizon_mode=horizon_mode,
        horizon_label=horizon_label,
        search_radius_km=search_radius_km,
        terrain=terrain,
        horizon=horizon,
        series=series,
        sun_visible_pct=100.0 * sun_h / denom_h,
        earth_visible_pct=100.0 * earth_h / denom_h,
        both_visible_pct=100.0 * both_h / denom_h,
        sun_visible_hours=sun_h,
        earth_visible_hours=earth_h,
        both_visible_hours=both_h,
        sunsets=sunsets,
        sunrises=sunrises,
        earthsets=earthsets,
        earthrises=earthrises,
        longest_night=longest_night,
        other_nights=other_nights,
        earth_outages=sorted_outages,
        incidence=incidence,
        materials=materials,
    )


def format_events_summary(events: tuple[VisibilityEvent, ...]) -> str:
    """Resume todos los eventos de puesta detectados o indica ausencia."""
    if not events:
        return "Sin evento en el periodo evaluado"
    parts = [
        f"{ev.utc.strftime('%Y-%m-%d %H:%M')} UTC ({ev.azimuth_deg:.1f}°)"
        for ev in events
    ]
    return " · ".join(parts)


def format_span(span: ShadowSpan) -> str:
    """Formatea un intervalo de sombra o pérdida con marcas de borde si aplica."""
    flags = []
    if not span.bounded_start:
        flags.append("inicio ventana")
    if not span.bounded_end:
        flags.append("fin ventana")
    suffix = f" [{', '.join(flags)}]" if flags else ""
    return (
        f"{span.duration_hours:.1f} h "
        f"({span.start_utc.strftime('%m-%d %H:%M')} → {span.end_utc.strftime('%m-%d %H:%M')} UTC){suffix}"
    )
