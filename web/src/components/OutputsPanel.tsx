import { Download, X } from "lucide-react";
import {
  formatEventsList,
  formatIncidenceSummary,
  formatMaterialsSummary,
  formatShadowSpan,
  formatUtcShort,
} from "../api";
import type { SiteAnalysisResult } from "../types";
import { DailyEvolutionPlot } from "./DailyEvolutionPlot";
import { SkyAzimuthPlot } from "./SkyAzimuthPlot";

interface OutputsPanelProps {
  result: SiteAnalysisResult;
  onClose: () => void;
}

function downloadSeriesCsv(result: SiteAnalysisResult) {
  const header =
    "body,utc,azimuth_deg,elevation_deg,horizon_deg,margin_deg,visible,range_km\n";
  const rows = [
    ...result.series.sun.map(
      (s) =>
        `SUN,${s.utc},${s.azimuth_deg},${s.elevation_deg},${s.horizon_deg},${s.margin_deg},${s.visible},${s.range_km}`,
    ),
    ...result.series.earth.map(
      (s) =>
        `EARTH,${s.utc},${s.azimuth_deg},${s.elevation_deg},${s.horizon_deg},${s.margin_deg},${s.visible},${s.range_km}`,
    ),
  ].join("\n");
  const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ilargi-${result.label.toLowerCase()}-serie.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function OutputsPanel({ result, onClose }: OutputsPanelProps) {
  return (
    <aside className="panel outputs-panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow eyebrow-accent">
            OUTPUTS · {result.label} · {result.site_name}
          </div>
          <div className="mono-coords">
            λ={result.latitude_deg.toFixed(3)}° · θ=
            {result.longitude_east_deg.toFixed(3)}°E
            {result.ground_elevation_m !== null
              ? ` · cota ${result.ground_elevation_m.toFixed(1)} m`
              : " · esfera ref. 1 737,4 km"}
          </div>
          <div className="mono-sub">
            Inicio {formatUtcShort(result.start_utc)} · ventana{" "}
            {result.duration_hours} h
          </div>
        </div>
        <div className="outputs-head-actions">
          <span
            className={`pill ${result.horizon_mode === "lola" ? "pill-ok" : "pill-muted"}`}
          >
            {result.horizon_label}
          </span>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            title="Cerrar panel de resultados"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-title">
          Diagrama Acimut vs Elevación (Horizonte · Sol · Tierra)
        </div>
        <SkyAzimuthPlot result={result} height={290} />
      </div>

      <div className="kpi-grid">
        <div className="kpi-box">
          <div className="kpi-label">Visibilidad Sol</div>
          <div className="kpi-value kpi-sun">
            {result.visibility.sun_pct.toFixed(1)}%
          </div>
          <div className="kpi-sub">
            {result.visibility.sun_hours.toFixed(1)} / {result.duration_hours} h
          </div>
        </div>
        <div className="kpi-box">
          <div className="kpi-label">Visibilidad Tierra</div>
          <div className="kpi-value kpi-earth">
            {result.visibility.earth_pct.toFixed(1)}%
          </div>
          <div className="kpi-sub">
            {result.visibility.earth_hours.toFixed(1)} / {result.duration_hours}{" "}
            h
          </div>
        </div>
        <div className="kpi-box">
          <div className="kpi-label">Conjunta</div>
          <div className="kpi-value kpi-ok">
            {result.visibility.both_pct.toFixed(1)}%
          </div>
          <div className="kpi-sub">
            {result.visibility.both_hours.toFixed(1)} h simultáneas
          </div>
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-title">Evolución de los días (Elevación UTC)</div>
        <DailyEvolutionPlot result={result} height={230} />
      </div>

      <div className="telemetry-list">
        <div className="telemetry-item">
          <div className="telemetry-label">
            Sunset ({result.events.sunsets.length}) &amp; Earthset (
            {result.events.earthsets.length})
          </div>
          <div className="telemetry-row">
            <span className="tag-sun">Sunset:</span>{" "}
            <span className="mono">
              {formatEventsList(result.events.sunsets)}
            </span>
          </div>
          <div className="telemetry-row">
            <span className="tag-earth">Earthset:</span>{" "}
            <span className="mono">
              {formatEventsList(result.events.earthsets)}
            </span>
          </div>
        </div>

        <div className="telemetry-item">
          <div className="telemetry-label">
            Duración de las noches (sombras de luz)
          </div>
          {result.nights.longest === null ? (
            <div className="telemetry-row mono">
              Sin noche solar en el periodo evaluado (100% iluminado)
            </div>
          ) : (
            <>
              <div className="telemetry-row">
                <strong>Noche más larga:</strong>{" "}
                <span className="mono">
                  {formatShadowSpan(result.nights.longest)}
                </span>
              </div>
              <div className="telemetry-row">
                <strong>Otras noches ({result.nights.others.length}):</strong>{" "}
                <span className="mono">
                  {result.nights.others.length === 0
                    ? "Ninguna adicional"
                    : result.nights.others.map(formatShadowSpan).join(" · ")}
                </span>
              </div>
            </>
          )}
          {result.nights.earth_outages.length > 0 && (
            <div className="telemetry-row">
              <strong>
                Oclusiones de Tierra ({result.nights.earth_outages.length}):
              </strong>{" "}
              <span className="mono">
                {result.nights.earth_outages.map(formatShadowSpan).join(" · ")}
              </span>
            </div>
          )}
        </div>

        <div className="telemetry-item">
          <div className="telemetry-label">
            Ángulo de incidencia solar (normal local)
          </div>
          <div className="telemetry-row mono">
            {formatIncidenceSummary(result)}
          </div>
        </div>

        <div className="telemetry-item">
          <div className="telemetry-label">Minerales, Agua y Temperatura</div>
          <div className="telemetry-row">
            <strong>Elements:</strong>{" "}
            <span className="mono">{formatMaterialsSummary(result)}</span>
          </div>
          <div className="telemetry-row">
            <strong>Temperature:</strong>{" "}
            <span className="mono">{result.temperature_status}</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="btn-secondary"
        onClick={() => downloadSeriesCsv(result)}
      >
        <Download size={14} />
        Exportar serie CSV ({result.label})
      </button>
    </aside>
  );
}
