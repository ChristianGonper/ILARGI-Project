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
    "punto",
    "emplazamiento",
    "latitud_deg",
    "longitud_este_deg",
    "inicio_utc",
    "horizonte",
    "sol_pct",
    "tierra_pct",
    "conjunta_pct",
    "sunsets",
    "earthsets",
    "noche_mas_larga_h",
    "otras_noches",
    "incidencia_solar",
    "minerales_y_agua",
    "temperatura",
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
  a.download = "ilargi-comparativa.csv";
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
            COMP · TABLA COMPARATIVA ({results.length} EMPLAZAMIENTOS)
          </div>
          <div className="panel-sub">
            Pulsa el botón de gráfico al final de cada fila para mostrar y
            apilar los diagramas Acimut vs Elevación debajo.
          </div>
          <div className="panel-sub">
            Visibility and events are estimates. Terrain coverage may be
            partial; missing horizon samples use an ideal 0° horizon.
          </div>
        </div>
        <div className="comp-actions">
          <button
            type="button"
            className="btn-secondary btn-compact"
            onClick={() => downloadComparisonCsv(results)}
          >
            <Download size={14} />
            CSV comparativa
          </button>
          {comparedLabels.length > 0 && (
            <button
              type="button"
              className="btn-secondary btn-compact"
              onClick={onClearPlots}
            >
              <Trash2 size={14} />
              Limpiar plots ({comparedLabels.length})
            </button>
          )}
        </div>
      </div>

      <div className="table-wrap">
        <table className="comp-table">
          <thead>
            <tr>
              <th>Punto / Coords</th>
              <th>Visibilidad (Sol · Tierra · Ambos)</th>
              <th>Sunset / Earthset</th>
              <th>Noches (Más larga · Otras)</th>
              <th>Incidencia solar</th>
              <th>Minerales y Agua</th>
              <th>Horizonte / Temp.</th>
              <th className="col-action">Acimut–Elev.</th>
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
                      <span className="tag-sun">Sol:</span>{" "}
                      <strong>{r.visibility.sun_pct.toFixed(1)}%</strong> (
                      {r.visibility.sun_hours.toFixed(1)} h)
                    </div>
                    <div>
                      <span className="tag-earth">Tierra:</span>{" "}
                      <strong>{r.visibility.earth_pct.toFixed(1)}%</strong> (
                      {r.visibility.earth_hours.toFixed(1)} h)
                    </div>
                    <div>
                      <span className="tag-ok">Ambos:</span>{" "}
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
                      <span>Sin noches (100% luz)</span>
                    ) : (
                      <>
                        <div>
                          <strong>Máx:</strong>{" "}
                          {formatShadowSpan(r.nights.longest)}
                        </div>
                        <div>
                          <strong>Otras ({r.nights.others.length}):</strong>{" "}
                          {r.nights.others.length === 0
                            ? "Ninguna"
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
                      aria-label={`Ver gráfico Acimut vs Elevación de ${r.label}`}
                    >
                      {isOpen ? <X size={15} /> : <LineChart size={15} />}
                      <span>{isOpen ? "Ocultar" : "Gráfico"}</span>
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
                      Sol {r.visibility.sun_pct.toFixed(1)}% · Tierra{" "}
                      {r.visibility.earth_pct.toFixed(1)}%)
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => onTogglePlot(r.label)}
                    title={`Ocultar gráfico de ${r.label}`}
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
