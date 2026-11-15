"""Structured scientific analysis results, independent of API serialization."""

from dataclasses import dataclass
from datetime import datetime

import pandas as pd

from ilargi.horizon import Horizon
from ilargi.terrain import TerrainSample


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
    temperature_status: str = "No thermal model in this version"
