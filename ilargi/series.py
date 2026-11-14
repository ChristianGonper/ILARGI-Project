"""Series temporales aparentes desde un único emplazamiento lunar."""

from datetime import datetime, timedelta

import pandas as pd

from ilargi.apparent import apparent_from_lunar_surface
from ilargi.ephemeris import require_aware_utc


def sky_series(
    start: datetime,
    duration_hours: float,
    step_minutes: int,
    latitude: float,
    longitude: float,
    height_m: float,
) -> pd.DataFrame:
    start = require_aware_utc(start)
    if not 0 < duration_hours <= 24 * 90 or step_minutes < 10 or step_minutes % 10:
        raise ValueError(
            "Duración hasta 90 días y paso en múltiplos de 10 minutos (mínimo 10)"
        )
    duration = timedelta(hours=duration_hours)
    step = timedelta(minutes=step_minutes)
    count = int(duration // step)
    # Always include the requested endpoint, even for a short final interval.
    extra = int(duration > count * step)
    if count + 1 + extra > 3000:
        raise ValueError("El intervalo supera 3000 muestras; aumenta el paso")
    times = [start + index * step for index in range(count + 1)]
    if extra:
        times.append(start + duration)
    rows = []
    for instant in times:
        result = apparent_from_lunar_surface(
            instant, latitude, longitude, height_m / 1000
        )
        for target in result.targets:
            rows.append(
                {
                    "utc": instant,
                    "objetivo": target.target,
                    "azimut_deg": target.azimuth_deg,
                    "elevacion_deg": target.elevation_deg,
                    "distancia_km": target.range_km,
                }
            )
    return pd.DataFrame(rows)
