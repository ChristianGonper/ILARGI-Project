"""Sample apparent discs and geometric occultation from a lunar site."""

import numpy as np

from ilargi.horizon import horizon_at

RADII_KM = {"SUN": 695700.0, "EARTH": 6371.0}


def angular_radius(body, distance_km):
    return np.arcsin(RADII_KM[body] / distance_km)


def directions(azimuth, elevation, radius, samples=61):
    """Uniformly sample the projected disc in its tangent plane."""
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
    """Return geometric disc fractions; missing horizon data yields NaN."""
    rays = directions(
        row.azimuth_deg,
        row.elevation_deg,
        angular_radius(body, row.range_km),
        samples,
    )
    az = np.rad2deg(np.arctan2(rays[:, 1], rays[:, 0])) % 360
    el = np.rad2deg(np.arcsin(np.clip(rays[:, 2], -1, 1)))
    heights = horizon_at(horizon, az)
    terrain = el > heights
    eclipse = np.zeros(len(rays), dtype=bool)
    if body == "SUN" and earth is not None:
        eaz, eel = np.deg2rad([earth.azimuth_deg, earth.elevation_deg])
        center = np.array(
            [np.cos(eel) * np.cos(eaz), np.cos(eel) * np.sin(eaz), np.sin(eel)]
        )
        eclipse = rays @ center >= np.cos(angular_radius("EARTH", earth.range_km))
    return (
        float(np.mean(terrain)) if np.all(np.isfinite(heights)) else np.nan,
        float(np.mean(eclipse)),
        float(np.mean(terrain & ~eclipse)) if np.all(np.isfinite(heights)) else np.nan,
    )
