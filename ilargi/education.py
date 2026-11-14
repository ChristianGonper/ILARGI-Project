"""Cálculo rápido de ciclos lunares completos y órbitas de 3 cuerpos para Modo Educación."""

from datetime import UTC, datetime, timedelta

import numpy as np
import spiceypy as spice

from ilargi.apparent import (
    ABCORR,
    LUNAR_FRAME,
    OBSERVER_BODY,
    OBSERVER_LOCUS,
    horizontal_angles,
    reference_radius_km,
)
from ilargi.ephemeris import require_aware_utc, spice_session, utc_to_et
from ilargi.horizon import calculate_horizon, estimate_search_radius, horizon_at
from ilargi.terrain import GLOBAL, POLAR, SAMPLE, sample_elevation

SYNODIC_LUNAR_DAY_HOURS = 708.734


def compute_education_cycle(
    *,
    latitude_deg: float,
    longitude_east_deg: float,
    start_utc: datetime,
    duration_hours: float = 709.0,
    step_minutes: int = 180,
) -> dict:
    """Calcula en una pasada SPICE el ciclo solar lunar completo y las órbitas 3 cuerpos."""
    utc = require_aware_utc(start_utc)
    if not (-90.0 < latitude_deg < 90.0):
        raise ValueError("La latitud debe estar en (-90°, 90°)")
    if not 1.0 <= duration_hours <= 24.0 * 60.0:
        raise ValueError("duration_hours debe estar entre 1 y 1440 horas")
    if not 30 <= step_minutes <= 720:
        raise ValueError("step_minutes debe estar entre 30 y 720 minutos")

    # Muestreo opcional del terreno/horizonte LOLA a paso grueso (5°) si el DEM cubre el punto.
    ground_elevation_m: float | None = None
    horizon = None
    horizon_mode = "ideal"
    for cand in [POLAR, SAMPLE, GLOBAL] if latitude_deg <= -80.0 else [GLOBAL]:
        try:
            terrain = sample_elevation(latitude_deg, longitude_east_deg, cand)
            ground_elevation_m = float(terrain.elevation_m)
            obs_m = ground_elevation_m + 2.0
            tangent_m = estimate_search_radius(
                obs_m, min_elevation_deg=0.0
            ).tangent_plane_m
            max_dist = min(tangent_m, 120_000.0)
            horizon = calculate_horizon(
                latitude_deg,
                longitude_east_deg,
                instrument_height_m=2.0,
                max_distance_m=max_dist,
                azimuth_step_deg=5.0,
                path=cand,
            )
            horizon_mode = "lola"
            break
        except (ValueError, OSError):
            ground_elevation_m = None
            horizon = None

    observer_height_km = (
        (ground_elevation_m + 2.0) / 1000.0 if ground_elevation_m is not None else 0.002
    )

    n_steps = int(np.floor((duration_hours * 60.0) / step_minutes))
    times = [utc + timedelta(minutes=i * step_minutes) for i in range(n_steps + 1)]
    if (times[-1] - utc).total_seconds() < duration_hours * 3600.0 - 60.0:
        times.append(utc + timedelta(hours=duration_hours))

    frames: list[dict] = []
    with spice_session():
        radius = reference_radius_km()
        site_pos = np.array(
            spice.georec(
                np.deg2rad(longitude_east_deg % 360.0),
                np.deg2rad(latitude_deg),
                observer_height_km,
                radius,
                0.0,
            ),
            dtype=float,
        )

        for instant in times:
            et = utc_to_et(instant)
            # 1. Direcciones desde el centro lunar en MOON_ME (iluminación global del globo 3D).
            sun_me_raw, _ = spice.spkpos("SUN", et, LUNAR_FRAME, ABCORR, OBSERVER_BODY)
            earth_me_raw, _ = spice.spkpos(
                "EARTH", et, LUNAR_FRAME, ABCORR, OBSERVER_BODY
            )
            sun_me = np.asarray(sun_me_raw, dtype=float)
            earth_me = np.asarray(earth_me_raw, dtype=float)
            sun_me_unit = sun_me / max(1e-12, float(np.linalg.norm(sun_me)))
            earth_me_unit = earth_me / max(1e-12, float(np.linalg.norm(earth_me)))

            # 2. Acimut y elevación locales en el emplazamiento elegido.
            sun_state, _ = spice.spkcpo(
                "SUN",
                et,
                LUNAR_FRAME,
                OBSERVER_LOCUS,
                ABCORR,
                site_pos,
                OBSERVER_BODY,
                LUNAR_FRAME,
            )
            earth_state, _ = spice.spkcpo(
                "EARTH",
                et,
                LUNAR_FRAME,
                OBSERVER_LOCUS,
                ABCORR,
                site_pos,
                OBSERVER_BODY,
                LUNAR_FRAME,
            )
            sun_ang = horizontal_angles(
                np.asarray(sun_state[:3], dtype=float), latitude_deg, longitude_east_deg
            )
            earth_ang = horizontal_angles(
                np.asarray(earth_state[:3], dtype=float),
                latitude_deg,
                longitude_east_deg,
            )

            sun_hor_deg = (
                float(horizon_at(horizon, np.array([sun_ang.azimuth_deg]))[0])
                if horizon is not None
                else 0.0
            )
            if not np.isfinite(sun_hor_deg):
                sun_hor_deg = 0.0
            earth_hor_deg = (
                float(horizon_at(horizon, np.array([earth_ang.azimuth_deg]))[0])
                if horizon is not None
                else 0.0
            )
            if not np.isfinite(earth_hor_deg):
                earth_hor_deg = 0.0

            # 3. Posiciones geométricas simultáneas de los 3 cuerpos en J2000 (relativas al Sol).
            sun_earth = np.asarray(
                spice.spkpos("EARTH", et, "J2000", "NONE", "SUN")[0], dtype=float
            )
            sun_moon = np.asarray(
                spice.spkpos("MOON", et, "J2000", "NONE", "SUN")[0], dtype=float
            )
            earth_moon = sun_moon - sun_earth

            d_se = float(np.linalg.norm(sun_earth))
            d_sm = float(np.linalg.norm(sun_moon))
            d_em = float(np.linalg.norm(earth_moon))

            # Ángulo de fase lunar visto desde la Tierra:
            # 0° = Luna Llena (Sol-Tierra-Luna alineados con Luna opuesta al Sol),
            # 180° = Luna Nueva (Luna entre Sol y Tierra).
            v_ms = -sun_moon
            v_me = -earth_moon
            cos_phase = float(
                np.clip(
                    np.dot(v_ms, v_me)
                    / max(1e-12, np.linalg.norm(v_ms) * np.linalg.norm(v_me)),
                    -1.0,
                    1.0,
                )
            )
            illum_frac = 0.5 * (1.0 + cos_phase)

            hours = (instant - utc).total_seconds() / 3600.0
            frames.append(
                {
                    "utc": instant.astimezone(UTC).isoformat(),
                    "hours_from_start": round(hours, 3),
                    "sun_me_unit": [
                        round(float(sun_me_unit[0]), 6),
                        round(float(sun_me_unit[1]), 6),
                        round(float(sun_me_unit[2]), 6),
                    ],
                    "earth_me_unit": [
                        round(float(earth_me_unit[0]), 6),
                        round(float(earth_me_unit[1]), 6),
                        round(float(earth_me_unit[2]), 6),
                    ],
                    "sun_azimuth_deg": round(float(sun_ang.azimuth_deg), 2),
                    "sun_elevation_deg": round(float(sun_ang.elevation_deg), 2),
                    "sun_horizon_deg": round(sun_hor_deg, 2),
                    "sun_visible": bool(sun_ang.elevation_deg > sun_hor_deg),
                    "earth_azimuth_deg": round(float(earth_ang.azimuth_deg), 2),
                    "earth_elevation_deg": round(float(earth_ang.elevation_deg), 2),
                    "earth_horizon_deg": round(earth_hor_deg, 2),
                    "earth_visible": bool(earth_ang.elevation_deg > earth_hor_deg),
                    "sun_earth_km": [
                        round(float(sun_earth[0]), 1),
                        round(float(sun_earth[1]), 1),
                        round(float(sun_earth[2]), 1),
                    ],
                    "sun_moon_km": [
                        round(float(sun_moon[0]), 1),
                        round(float(sun_moon[1]), 1),
                        round(float(sun_moon[2]), 1),
                    ],
                    "earth_moon_km": [
                        round(float(earth_moon[0]), 1),
                        round(float(earth_moon[1]), 1),
                        round(float(earth_moon[2]), 1),
                    ],
                    "sun_earth_dist_km": round(d_se, 1),
                    "earth_moon_dist_km": round(d_em, 1),
                    "sun_moon_dist_km": round(d_sm, 1),
                    "illumination_fraction": round(illum_frac, 4),
                }
            )

    return {
        "start_utc": utc.isoformat(),
        "duration_hours": float(duration_hours),
        "step_minutes": int(step_minutes),
        "lunar_day_hours": SYNODIC_LUNAR_DAY_HOURS,
        "site": {
            "latitude_deg": float(latitude_deg),
            "longitude_east_deg": float(longitude_east_deg),
            "ground_elevation_m": ground_elevation_m,
            "horizon_mode": horizon_mode,
        },
        "frames": frames,
    }
