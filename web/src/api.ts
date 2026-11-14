import type {
  AnalysisParams,
  HealthResponse,
  HistoricalSite,
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
    return "Fuera de LP-GRS (80°–90° S) · Agua/WEH: Sin datos validados";
  }
  const parts = Object.entries(mat.elements).map(([sym, el]) => {
    if (el.value === null) return `${sym}: s/d`;
    const unit = el.unit.replace(" en masa", "");
    return `${sym}: ${el.value.toFixed(2)} ${unit} (${el.category})`;
  });
  parts.push(`Agua/WEH: ${mat.water_status}`);
  return parts.join(" · ");
}
