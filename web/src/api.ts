import { requestData } from "./dataSource";
import type {
  AnalysisParams,
  EducationCycleFrame,
  EducationCycleResponse,
  EducationSite,
  HealthResponse,
  HistoricalSite,
  MaterialsOverlayResponse,
  PointDraft,
  ShadowSpan,
  SiteAnalysisResult,
  VisibilityEvent,
} from "./types";

export const fetchHealth = () => requestData<HealthResponse>("/api/health");
export const fetchHistoricalSites = () =>
  requestData<HistoricalSite[]>("/api/sites");
export const fetchEducationSites = () =>
  requestData<EducationSite[]>("/api/education/sites");

export async function fetchEducationCycle(params: {
  latitudeDeg: number;
  longitudeEastDeg: number;
  startDate: string;
  startTime: string;
  durationHours?: number;
  stepMinutes?: number;
}): Promise<EducationCycleResponse> {
  return requestData<EducationCycleResponse>("/api/education/cycle", {
    latitude_deg: params.latitudeDeg,
    longitude_east_deg: params.longitudeEastDeg,
    start_utc: `${params.startDate}T${params.startTime}:00Z`,
    duration_hours: params.durationHours ?? 709.0,
    step_minutes: params.stepMinutes ?? 180,
  });
}

function lerpVec3(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
  normalizeUnit = false,
): [number, number, number] {
  const x = a[0] + (b[0] - a[0]) * t;
  const y = a[1] + (b[1] - a[1]) * t;
  const z = a[2] + (b[2] - a[2]) * t;
  if (!normalizeUnit) return [x, y, z];
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}

export function interpolateEducationFrame(
  frames: EducationCycleFrame[],
  hours: number,
): EducationCycleFrame | null {
  if (frames.length === 0) return null;
  if (hours <= frames[0].hours_from_start) return frames[0];
  const last = frames[frames.length - 1];
  if (hours >= last.hours_from_start) return last;

  let lo = 0;
  let hi = frames.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].hours_from_start <= hours) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const f0 = frames[lo];
  const f1 = frames[hi];
  const span = Math.max(1e-6, f1.hours_from_start - f0.hours_from_start);
  const t = Math.max(0, Math.min(1, (hours - f0.hours_from_start) / span));

  const t0Ms = Date.parse(f0.utc);
  const t1Ms = Date.parse(f1.utc);
  const interpUtc = new Date(t0Ms + (t1Ms - t0Ms) * t).toISOString();

  const sunEl =
    f0.sun_elevation_deg + (f1.sun_elevation_deg - f0.sun_elevation_deg) * t;
  const earthEl =
    f0.earth_elevation_deg +
    (f1.earth_elevation_deg - f0.earth_elevation_deg) * t;
  const sunHor =
    f0.sun_horizon_deg + (f1.sun_horizon_deg - f0.sun_horizon_deg) * t;
  const earthHor =
    f0.earth_horizon_deg + (f1.earth_horizon_deg - f0.earth_horizon_deg) * t;

  return {
    utc: interpUtc,
    hours_from_start: hours,
    sun_me_unit: lerpVec3(f0.sun_me_unit, f1.sun_me_unit, t, true),
    earth_me_unit: lerpVec3(f0.earth_me_unit, f1.earth_me_unit, t, true),
    sun_azimuth_deg: t < 0.5 ? f0.sun_azimuth_deg : f1.sun_azimuth_deg,
    sun_elevation_deg: sunEl,
    sun_horizon_deg: sunHor,
    sun_visible: sunEl > sunHor,
    earth_azimuth_deg: t < 0.5 ? f0.earth_azimuth_deg : f1.earth_azimuth_deg,
    earth_elevation_deg: earthEl,
    earth_horizon_deg: earthHor,
    earth_visible: earthEl > earthHor,
    sun_earth_km: lerpVec3(f0.sun_earth_km, f1.sun_earth_km, t),
    sun_moon_km: lerpVec3(f0.sun_moon_km, f1.sun_moon_km, t),
    earth_moon_km: lerpVec3(f0.earth_moon_km, f1.earth_moon_km, t),
    sun_earth_dist_km:
      f0.sun_earth_dist_km + (f1.sun_earth_dist_km - f0.sun_earth_dist_km) * t,
    earth_moon_dist_km:
      f0.earth_moon_dist_km +
      (f1.earth_moon_dist_km - f0.earth_moon_dist_km) * t,
    sun_moon_dist_km:
      f0.sun_moon_dist_km + (f1.sun_moon_dist_km - f0.sun_moon_dist_km) * t,
    illumination_fraction:
      f0.illumination_fraction +
      (f1.illumination_fraction - f0.illumination_fraction) * t,
  };
}

export const fetchMaterialsOverlay = () =>
  requestData<MaterialsOverlayResponse>("/api/materials-overlay");

export async function analyzePoints(
  points: PointDraft[],
  params: AnalysisParams,
): Promise<SiteAnalysisResult[]> {
  const payload = {
    points: points.map((pt, idx) => ({
      label: `P${idx + 1}`,
      site_name: pt.siteName,
      latitude_deg: pt.latitudeDeg,
      longitude_east_deg: pt.longitudeEastDeg,
      start_utc: `${pt.startDate}T${pt.startTime}:00Z`,
    })),
    duration_hours: params.durationHours,
    step_minutes: params.stepMinutes,
    instrument_height_m: params.instrumentHeightM,
    azimuth_step_deg: 0.25,
    dem_mode: "auto",
  };
  const data = await requestData<{ results: SiteAnalysisResult[] }>(
    "/api/analyze",
    payload,
  );
  return data.results.map((result) => ({
    ...result,
    data_source: result.data_source ?? "live",
  }));
}

export function formatUtcShort(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

export function formatEventsList(events: VisibilityEvent[]): string {
  if (events.length === 0) return "No event in the evaluated interval";
  return events
    .map((ev) => `${formatUtcShort(ev.utc)} (${ev.azimuth_deg.toFixed(1)}°)`)
    .join(" · ");
}

export function formatShadowSpan(span: ShadowSpan): string {
  const s = span.start_utc.slice(5, 16).replace("T", " ");
  const e = span.end_utc.slice(5, 16).replace("T", " ");
  const flags: string[] = [];
  if (!span.bounded_start) flags.push("window start");
  if (!span.bounded_end) flags.push("window end");
  const suffix = flags.length ? ` [${flags.join(", ")}]` : "";
  return `${span.duration_hours.toFixed(1)} h (${s} → ${e} UTC)${suffix}`;
}

export function formatIncidenceSummary(r: SiteAnalysisResult): string {
  const inc = r.incidence;
  if (inc.min_deg === null || inc.max_deg === null || inc.mean_deg === null) {
    return `No visible Sun samples · Max Sun elevation ${inc.max_sun_elevation_deg.toFixed(2)}°`;
  }
  return `Min ${inc.min_deg.toFixed(2)}° · Max ${inc.max_deg.toFixed(2)}° · Mean ${inc.mean_deg.toFixed(2)}° (median ${inc.median_deg?.toFixed(2)}°, σ ${inc.std_deg?.toFixed(2)}°)`;
}

export function formatMaterialsSummary(r: SiteAnalysisResult): string {
  const mat = r.materials;
  if (!mat.in_coverage) {
    return `No LP-GRS data at this location · WEH: ${mat.water_status}`;
  }
  const parts = Object.entries(mat.elements).map(([sym, el]) => {
    if (el.value === null) return `${sym}: n/a`;
    const unit = el.unit.replace(" by mass", "");
    return `${sym}: ${el.value.toFixed(2)} ${unit} (${el.category})`;
  });
  parts.push(`WEH: ${mat.water_status}`);
  return (
    parts.join(" \u00b7 ") +
    " | Regional estimates: LP-GRS resolution ~5 degrees (~152 km at the equator); WEH grid 0.5 degrees, footprint ~50 km. Not point measurements or confirmed mineral deposits."
  );
}
