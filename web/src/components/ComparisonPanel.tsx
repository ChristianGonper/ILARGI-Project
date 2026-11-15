import { Download, LineChart, Trash2, X } from "lucide-react";
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

interface ComparisonPanelProps {
  results: SiteAnalysisResult[];
  comparedLabels: string[];
  onTogglePlot: (label: string) => void;
  onClearPlots: () => void;
}

function downloadComparisonCsv(results: SiteAnalysisResult[]) {
  const header = [
    "point",
    "site",
    "latitude_deg",
    "longitude_east_deg",
    "start_utc",
    "horizon",
    "sun_pct",
    "earth_pct",
    "simultaneous_pct",
    "sunsets",
    "earthsets",
    "longest_dark_interval_h",
    "other_dark_intervals",
    "solar_incidence",
    "elements_and_water",
    "temperature",
  ].join(",");

  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = results.map((r) =>
    [
      esc(r.label),
      esc(r.site_name),
      r.latitude_deg,
      r.longitude_east_deg,
      esc(r.start_utc),
      esc(r.horizon_label),
      r.visibility.sun_pct.toFixed(1),
      r.visibility.earth_pct.toFixed(1),
      r.visibility.both_pct.toFixed(1),
      esc(formatEventsList(r.events.sunsets)),
      esc(formatEventsList(r.events.earthsets)),
      r.nights.longest ? r.nights.longest.duration_hours.toFixed(2) : "0",
      r.nights.others.length,
      esc(formatIncidenceSummary(r)),
      esc(formatMaterialsSummary(r)),
      esc(r.temperature_status),
    ].join(","),
  );

  const blob = new Blob([[header, ...lines].join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ilargi-comparison.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ComparisonPanel({
  results,
  comparedLabels,
  onTogglePlot,
  onClearPlots,
}: ComparisonPanelProps) {
  const byLabel = new Map(results.map((r) => [r.label, r]));

  return (
    <section className="comp-section">
      <div className="comp-header">
        <div>
          <div className="eyebrow eyebrow-accent">
            COMP · SITE COMPARISON ({results.length} LOCATIONS)
          </div>
          <div className="panel-sub">
            Use the plot button at the end of each row to display its
            azimuth–elevation diagram below.
          </div>
        </div>
        <div className="comp-actions">
          <button
            type="button"
            className="btn-secondary btn-compact"
            onClick={() => downloadComparisonCsv(results)}
          >
            <Download size={14} />
            Comparison CSV
          </button>
          {comparedLabels.length > 0 && (
            <button
              type="button"
              className="btn-secondary btn-compact"
              onClick={onClearPlots}
            >
              <Trash2 size={14} />
              Clear plots ({comparedLabels.length})
            </button>
          )}
        </div>
      </div>

      <div className="table-wrap">
        <table className="comp-table">
          <thead>
            <tr>
              <th>Site / Coordinates</th>
              <th>Visibility (Sun · Earth · Both)</th>
              <th>Sunset / Earthset</th>
              <th>Dark intervals (Longest · Others)</th>
              <th>Solar incidence</th>
              <th>Elements and WEH</th>
              <th>Horizon / Temperature</th>
              <th className="col-action">Azimuth–Elevation</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const isOpen = comparedLabels.includes(r.label);
              return (
                <tr key={r.label} className={isOpen ? "row-active" : ""}>
                  <td>
                    <div className="cell-title">
                      <span className="point-tag">{r.label}</span> {r.site_name}
                    </div>
                    <div className="mono-sub">
                      λ={r.latitude_deg.toFixed(3)}°, θ=
                      {r.longitude_east_deg.toFixed(3)}°E
                    </div>
                    <div className="mono-sub">
                      {formatUtcShort(r.start_utc)}
                    </div>
                  </td>
                  <td className="mono">
                    <div>
                      <span className="tag-sun">Sun:</span>{" "}
                      <strong>{r.visibility.sun_pct.toFixed(1)}%</strong> (
                      {r.visibility.sun_hours.toFixed(1)} h)
                    </div>
                    <div>
                      <span className="tag-earth">Earth:</span>{" "}
                      <strong>{r.visibility.earth_pct.toFixed(1)}%</strong> (
                      {r.visibility.earth_hours.toFixed(1)} h)
                    </div>
                    <div>
                      <span className="tag-ok">Both:</span>{" "}
                      <strong>{r.visibility.both_pct.toFixed(1)}%</strong>
                    </div>
                  </td>
                  <td className="mono cell-wrap">
                    <div>
                      <span className="tag-sun">
                        Sunset ({r.events.sunsets.length}):
                      </span>{" "}
                      {formatEventsList(r.events.sunsets)}
                    </div>
                    <div>
                      <span className="tag-earth">
                        Earthset ({r.events.earthsets.length}):
                      </span>{" "}
                      {formatEventsList(r.events.earthsets)}
                    </div>
                  </td>
                  <td className="mono cell-wrap">
                    {r.nights.longest === null ? (
                      <span>No dark intervals detected</span>
                    ) : (
                      <>
                        <div>
                          <strong>Max:</strong>{" "}
                          {formatShadowSpan(r.nights.longest)}
                        </div>
                        <div>
                          <strong>Others ({r.nights.others.length}):</strong>{" "}
                          {r.nights.others.length === 0
                            ? "None"
                            : r.nights.others
                                .map((n) => `${n.duration_hours.toFixed(1)}h`)
                                .join(", ")}
                        </div>
                      </>
                    )}
                  </td>
                  <td className="mono cell-wrap">
                    {formatIncidenceSummary(r)}
                  </td>
                  <td className="mono cell-wrap">
                    {formatMaterialsSummary(r)}
                  </td>
                  <td className="cell-wrap">
                    <div>
                      <span
                        className={`pill ${
                          r.horizon_mode === "lola" ? "pill-ok" : "pill-muted"
                        }`}
                      >
                        {r.horizon_label}
                      </span>
                    </div>
                    <div className="mono-sub" style={{ marginTop: 4 }}>
                      {r.temperature_status}
                    </div>
                  </td>
                  <td className="col-action">
                    <button
                      type="button"
                      className={`btn-plot-toggle ${isOpen ? "open" : ""}`}
                      onClick={() => onTogglePlot(r.label)}
                      aria-label={`View azimuth–elevation plot for ${r.label}`}
                    >
                      {isOpen ? <X size={15} /> : <LineChart size={15} />}
                      <span>{isOpen ? "Hide" : "Plot"}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {comparedLabels.length > 0 && (
        <div className="stacked-plots">
          <div className="eyebrow">
            GRÁFICOS COMPARATIVOS APILADOS · ACIMUT vs ELEVACIÓN Y EVOLUCIÓN
            DIARIA
          </div>
          {comparedLabels.map((lbl) => {
            const r = byLabel.get(lbl);
            if (!r) return null;
            return (
              <div key={lbl} className="stacked-plot-card">
                <div className="stacked-plot-head">
                  <div>
                    <span className="point-tag">{r.label}</span>{" "}
                    <strong>{r.site_name}</strong>{" "}
                    <span className="mono-sub">
                      (λ={r.latitude_deg.toFixed(3)}°, θ=
                      {r.longitude_east_deg.toFixed(3)}°E · {r.horizon_label} ·
                      Sun {r.visibility.sun_pct.toFixed(1)}% · Earth{" "}
                      {r.visibility.earth_pct.toFixed(1)}%)
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => onTogglePlot(r.label)}
                    title={`Hide plot for ${r.label}`}
                  >
                    <X size={15} />
                  </button>
                </div>
                <div className="stacked-plot-grid">
                  <SkyAzimuthPlot result={r} height={310} />
                  <DailyEvolutionPlot result={r} height={310} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
