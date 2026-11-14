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

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch("/api/health");
  if (!res.ok) {
    throw new Error(`Error al consultar /api/health (${res.status})`);
  }
  return res.json() as Promise<HealthResponse>;
}

export async function fetchHistoricalSites(): Promise<HistoricalSite[]> {
  const res = await fetch("/api/sites");
  if (!res.ok) {
    throw new Error(`Error al consultar /api/sites (${res.status})`);
  }
  return res.json() as Promise<HistoricalSite[]>;
}

export async function fetchEducationSites(): Promise<EducationSite[]> {
  const res = await fetch("/api/education/sites");
  if (!res.ok) {
    throw new Error(`Error al consultar /api/education/sites (${res.status})`);
  }
  return res.json() as Promise<EducationSite[]>;
}

export async function fetchEducationCycle(params: {
  latitudeDeg: number;
  longitudeEastDeg: number;
  startDate: string;
  startTime: string;
  durationHours?: number;
  stepMinutes?: number;
}): Promise<EducationCycleResponse> {
  const res = await fetch("/api/education/cycle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      latitude_deg: params.latitudeDeg,
      longitude_east_deg: params.longitudeEastDeg,
      start_utc: `${params.startDate}T${params.startTime}:00Z`,
      duration_hours: params.durationHours ?? 709.0,
      step_minutes: params.stepMinutes ?? 180,
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(
      body.detail ?? `Error en /api/education/cycle (${res.status})`,
    );
  }
  return res.json() as Promise<EducationCycleResponse>;
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

export async function fetchMaterialsOverlay(): Promise<MaterialsOverlayResponse> {
  const res = await fetch("/api/materials-overlay");
  if (!res.ok) {
    throw new Error(
      `Error al consultar /api/materials-overlay (${res.status})`,
    );
  }
  return res.json() as Promise<MaterialsOverlayResponse>;
}

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
    azimuth_step_deg: params.azimuthStepDeg,
    dem_mode: params.demMode,
  };
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(body.detail ?? `Error en /api/analyze (${res.status})`);
  }
  const data = (await res.json()) as { results: SiteAnalysisResult[] };
  return data.results;
}

export function formatUtcShort(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

export function formatEventsList(events: VisibilityEvent[]): string {
  if (events.length === 0) return "Sin evento en el periodo evaluado";
  return events
    .map((ev) => `${formatUtcShort(ev.utc)} (${ev.azimuth_deg.toFixed(1)}°)`)
    .join(" · ");
}

export function formatShadowSpan(span: ShadowSpan): string {
  const s = span.start_utc.slice(5, 16).replace("T", " ");
  const e = span.end_utc.slice(5, 16).replace("T", " ");
  const flags: string[] = [];
  if (!span.bounded_start) flags.push("inicio ventana");
  if (!span.bounded_end) flags.push("fin ventana");
  const suffix = flags.length ? ` [${flags.join(", ")}]` : "";
  return `${span.duration_hours.toFixed(1)} h (${s} → ${e} UTC)${suffix}`;
}

export function formatIncidenceSummary(r: SiteAnalysisResult): string {
  const inc = r.incidence;
  if (inc.min_deg === null || inc.max_deg === null || inc.mean_deg === null) {
    return `Sombra permanente · Elev. Sol máx ${inc.max_sun_elevation_deg.toFixed(2)}°`;
  }
  return `Mín ${inc.min_deg.toFixed(2)}° · Máx ${inc.max_deg.toFixed(2)}° · Media ${inc.mean_deg.toFixed(2)}° (mediana ${inc.median_deg?.toFixed(2)}°, σ ${inc.std_deg?.toFixed(2)}°)`;
}

export function formatMaterialsSummary(r: SiteAnalysisResult): string {
  const mat = r.materials;
  if (!mat.in_coverage) {
    return "Sin datos LP-GRS para esta ubicación · WEH: Sin datos validados";
  }
  const parts = Object.entries(mat.elements).map(([sym, el]) => {
    if (el.value === null) return `${sym}: s/d`;
    const unit = el.unit.replace(" en masa", "");
    return `${sym}: ${el.value.toFixed(2)} ${unit} (${el.category})`;
  });
  parts.push(`WEH: ${mat.water_status}`);
  return parts.join(" · ");
}
