"""Discos aparentes y ocultación geométrica desde un emplazamiento lunar."""

import numpy as np

from ilargi.horizon import horizon_at

RADII_KM = {"SUN": 695700.0, "EARTH": 6371.0}


def angular_radius(body, distance_km):
    return np.arcsin(RADII_KM[body] / distance_km)


def directions(azimuth, elevation, radius, samples=61):
    """Muestra uniforme del disco proyectado en el plano tangente."""
    axis = (np.arange(samples) + 0.5) * 2 / samples - 1
    x, y = np.meshgrid(axis, axis)
    mask = x * x + y * y < 1
    x, y = x[mask], y[mask]
    az, el = np.deg2rad([azimuth, elevation])
    center = np.array([np.cos(el) * np.cos(az), np.cos(el) * np.sin(az), np.sin(el)])
    east = np.array([-np.sin(az), np.cos(az), 0.0])
    up = np.array([-np.sin(el) * np.cos(az), -np.sin(el) * np.sin(az), np.cos(el)])
    vectors = center + np.tan(radius) * (x[:, None] * east + y[:, None] * up)
    return vectors / np.linalg.norm(vectors, axis=1)[:, None]


def disc_visibility(body, row, horizon, earth=None, samples=61):
    """Fracciones geométricas con horizonte muestreado; NaN si faltan datos."""
    rays = directions(
        row.azimut_deg,
        row.elevacion_deg,
        angular_radius(body, row.distancia_km),
        samples,
    )
    az = np.rad2deg(np.arctan2(rays[:, 1], rays[:, 0])) % 360
    el = np.rad2deg(np.arcsin(np.clip(rays[:, 2], -1, 1)))
    heights = horizon_at(horizon, az)
    terrain = el > heights
    eclipse = np.zeros(len(rays), dtype=bool)
    if body == "SUN" and earth is not None:
        eaz, eel = np.deg2rad([earth.azimut_deg, earth.elevacion_deg])
        center = np.array(
            [np.cos(eel) * np.cos(eaz), np.cos(eel) * np.sin(eaz), np.sin(eel)]
        )
        eclipse = rays @ center >= np.cos(angular_radius("EARTH", earth.distancia_km))
    return (
        float(np.mean(terrain)) if np.all(np.isfinite(heights)) else np.nan,
        float(np.mean(eclipse)),
        float(np.mean(terrain & ~eclipse)) if np.all(np.isfinite(heights)) else np.nan,
    )
