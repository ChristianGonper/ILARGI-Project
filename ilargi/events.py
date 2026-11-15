"""Center-visibility crossing interpolation and interval arithmetic."""

from datetime import datetime, timedelta

import numpy as np
import pandas as pd

from ilargi.models import ShadowSpan, VisibilityEvent


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
    """Interpolate center-visibility crossings and contiguous light/dark intervals."""
    if track.empty:
        return (), (), (), []

    times = track["utc"].tolist()
    margins = track["effective_margin_deg"].to_numpy(dtype=float)
    azimuths = track["azimuth_deg"].to_numpy(dtype=float)
    horizons = track["effective_horizon_deg"].to_numpy(dtype=float)
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
