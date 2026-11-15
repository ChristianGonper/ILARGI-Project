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
import { DiscVisibilityPanel } from "./DiscVisibilityPanel";
import { SkyAzimuthPlot } from "./SkyAzimuthPlot";

interface OutputsPanelProps {
  result: SiteAnalysisResult;
  hidden?: boolean;
  onClose: () => void;
}

function downloadSeriesCsv(result: SiteAnalysisResult) {
  const header =
    "data_source,body,utc,azimuth_deg,elevation_deg,horizon_deg,horizon_source,margin_deg,visible,range_km,angular_radius_deg,above_horizon_fraction,eclipsed_fraction,direct_visible_fraction\n";
  const fmtOpt = (v: number | null) => (v === null ? "" : String(v));
  const rows = [
    ...result.series.sun.map(
      (s) =>
        `SUN,${s.utc},${s.azimuth_deg},${s.elevation_deg},${s.horizon_deg},${s.horizon_source},${s.margin_deg},${s.visible},${s.range_km},${s.angular_radius_deg},${fmtOpt(s.above_horizon_fraction)},${fmtOpt(s.eclipsed_fraction)},${fmtOpt(s.direct_visible_fraction)}`,
    ),
    ...result.series.earth.map(
      (s) =>
        `EARTH,${s.utc},${s.azimuth_deg},${s.elevation_deg},${s.horizon_deg},${s.horizon_source},${s.margin_deg},${s.visible},${s.range_km},${s.angular_radius_deg},${fmtOpt(s.above_horizon_fraction)},${fmtOpt(s.eclipsed_fraction)},${fmtOpt(s.direct_visible_fraction)}`,
    ),
  ]
    .map((row) => `${result.data_source ?? "live"},${row}`)
    .join("\n");
  const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ilargi-${result.label.toLowerCase()}-series.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function OutputsPanel({ result, onClose, hidden }: OutputsPanelProps) {
  return (
    <aside className="panel outputs-panel" hidden={hidden}>
      <div className="panel-header">
        <div>
          <div className="eyebrow eyebrow-accent">
            OUTPUTS · {result.label} · {result.site_name}
          </div>
          <details className="result-context">
            <summary>Location and analysis context</summary>
            <div className="mono-coords">
              λ={result.latitude_deg.toFixed(3)}° · θ=
              {result.longitude_east_deg.toFixed(3)}°E
              {result.ground_elevation_m !== null
                ? ` · elevation ${result.ground_elevation_m.toFixed(1)} m`
                : " · reference sphere 1,737.4 km"}
            </div>
            <div className="mono-sub">
              Start {formatUtcShort(result.start_utc)} · window{" "}
              {result.duration_hours} h
              {result.horizon_mode === "lola"
                ? ` · tangent ${result.search_radius_km.toFixed(1)} km`
                : ""}
            </div>
            <span
              className={`pill ${result.horizon_mode === "lola" ? "pill-ok" : "pill-muted"}`}
            >
              {result.horizon_label}
            </span>
          </details>
        </div>
        <div className="outputs-head-actions">
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            title="Hide results panel"
            aria-label="Hide results panel"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="chart-card">
        <SkyAzimuthPlot result={result} height={290} />
      </div>

      <div className="kpi-grid">
        <div className="kpi-box">
          <div className="kpi-label">Sun visibility</div>
          <div className="kpi-value kpi-sun">
            {result.visibility.sun_pct.toFixed(1)}%
          </div>
          <div className="kpi-sub">
            {result.visibility.sun_hours.toFixed(1)} / {result.duration_hours} h
          </div>
        </div>
        <div className="kpi-box">
          <div className="kpi-label">Earth visibility</div>
          <div className="kpi-value kpi-earth">
            {result.visibility.earth_pct.toFixed(1)}%
          </div>
          <div className="kpi-sub">
            {result.visibility.earth_hours.toFixed(1)} / {result.duration_hours}{" "}
            h
          </div>
        </div>
        <div className="kpi-box">
          <div className="kpi-label">Simultaneous</div>
          <div className="kpi-value kpi-ok">
            {result.visibility.both_pct.toFixed(1)}%
          </div>
          <div className="kpi-sub">
            {result.visibility.both_hours.toFixed(1)} h simultaneous
          </div>
        </div>
      </div>

      <div className="chart-card">
        <DailyEvolutionPlot result={result} height={230} />
      </div>

      <DiscVisibilityPanel result={result} />

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
          <div className="telemetry-label">Dark intervals</div>
          {result.nights.longest === null ? (
            <div className="telemetry-row mono">
              No center-based dark interval detected in this window
            </div>
          ) : (
            <>
              <div className="telemetry-row">
                <strong>Longest dark interval:</strong>{" "}
                <span className="mono">
                  {formatShadowSpan(result.nights.longest)}
                </span>
              </div>
              <div className="telemetry-row">
                <strong>
                  Other dark intervals ({result.nights.others.length}):
                </strong>{" "}
                <span className="mono">
                  {result.nights.others.length === 0
                    ? "No additional intervals"
                    : result.nights.others.map(formatShadowSpan).join(" · ")}
                </span>
              </div>
            </>
          )}
          {result.nights.earth_outages.length > 0 && (
            <div className="telemetry-row">
              <strong>
                Earth below horizon intervals (
                {result.nights.earth_outages.length}):
              </strong>{" "}
              <span className="mono">
                {result.nights.earth_outages.map(formatShadowSpan).join(" · ")}
              </span>
            </div>
          )}
        </div>

        <div className="telemetry-item">
          <div className="telemetry-label">
            Solar incidence angle (local normal)
          </div>
          <div className="telemetry-row mono">
            {formatIncidenceSummary(result)}
          </div>
        </div>

        <div className="telemetry-item">
          <div className="telemetry-label">Elements, water and temperature</div>
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
        Export series CSV ({result.label})
      </button>
    </aside>
  );
}
