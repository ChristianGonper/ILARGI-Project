"""Site visibility, events, incidence and regional materials."""

from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

from ilargi.discs import angular_radius, disc_visibility
from ilargi.events import (
    _extract_body_events_and_spans,
    _intersect_hours,
    _intervals_hours,
)
from ilargi.horizon import (
    Horizon,
    calculate_horizon,
    calculate_multiresolution_horizon,
    estimate_search_radius,
    horizon_at,
)
from ilargi.materials import MATERIALS, load_regions, region_at, weh_at
from ilargi.models import IncidenceStats, MaterialsSummary, SiteAnalysis
from ilargi.series import sky_series
from ilargi.terrain import (
    GLOBAL,
    POLAR,
    SAMPLE,
    TerrainCoverageError,
    TerrainSample,
    sample_elevation,
)

SAMPLE_20 = SAMPLE.with_name("lola_20m_south_pole_sample.tif")


def ideal_horizon(observer_m: float = 2.0, azimuth_step_deg: float = 2.0) -> Horizon:
    """Construct the explicit ideal 0° horizon used without terrain coverage."""
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


def compute_incidence_stats(sun_track: pd.DataFrame) -> IncidenceStats:
    """Summarize incidence relative to the ideal spherical normal at visible samples."""
    elevations = sun_track["elevation_deg"].to_numpy(dtype=float)
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
    """Query regional LP-GRS abundances and water-equivalent hydrogen."""
    weh = weh_at(latitude_deg, longitude_east_deg)
    water_status = (
        f"{weh:.0f} ppm H₂O equivalent (Lawrence et al. 2022)"
        if weh is not None
        else "No WEH data"
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
    """Report which supported LOLA products are present on disk."""
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
    # Automatic selection: finest available resolution covering the latitude.
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
    """Combine terrain, apparent tracks, visibility intervals and material context."""
    if not np.isfinite(longitude_east_deg) or not -180 <= longitude_east_deg <= 360:
        raise ValueError("Longitude must be finite and in [-180, 360]")
    # The API accepts east longitudes up to 360°; raster queries use [-180, 180).
    longitude_east_deg = (longitude_east_deg + 180) % 360 - 180
    terrain: TerrainSample | None = None
    horizon: Horizon | None = None
    horizon_mode = "ideal"
    horizon_label = "Ideal sphere (0°) — no DEM coverage"
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
                f"LOLA {res_tag} m/pixel + Global"
                if coarse_path == GLOBAL
                else f"LOLA {res_tag} m/pixel ({candidate.stem})"
            )
            break
        except TerrainCoverageError:
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
    sampled_h = horizon_at(horizon, series["azimuth_deg"])
    effective_h = np.where(np.isfinite(sampled_h), sampled_h, 0.0)
    series["sampled_horizon_deg"] = sampled_h
    series["effective_horizon_deg"] = effective_h
    series["effective_margin_deg"] = series["elevation_deg"] - effective_h
    series["visible"] = series["effective_margin_deg"] > 0.0
    series["angular_radius_deg"] = [
        float(np.rad2deg(angular_radius(row.body, row.range_km)))
        for row in series.itertuples()
    ]
    earth_by_utc = {
        row.utc: row for row in series[series["body"] == "EARTH"].itertuples()
    }
    above_frac: list[float] = []
    eclipsed_frac: list[float] = []
    visible_frac: list[float] = []
    for row in series.itertuples():
        above, eclipsed, visible = disc_visibility(
            row.body, row, horizon, earth_by_utc.get(row.utc)
        )
        above_frac.append(above)
        eclipsed_frac.append(eclipsed)
        visible_frac.append(visible)
    series["above_horizon_fraction"] = above_frac
    series["eclipsed_fraction"] = eclipsed_frac
    series["direct_visible_fraction"] = visible_frac

    sun_track = series[series["body"] == "SUN"].sort_values("utc")
    earth_track = series[series["body"] == "EARTH"].sort_values("utc")

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
