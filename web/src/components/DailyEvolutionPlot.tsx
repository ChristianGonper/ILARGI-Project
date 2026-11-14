import { useEffect, useRef } from "react";
import Plotly from "plotly.js-dist-min";
import type { SiteAnalysisResult } from "../types";
import { PlotFullscreenShell } from "./PlotFullscreenShell";

interface DailyEvolutionPlotProps {
  result: SiteAnalysisResult;
  height?: number;
}

function DailyEvolutionPlotCanvas({
  result,
  height,
}: {
  result: SiteAnalysisResult;
  height: number;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = elRef.current;
    if (!root) return;

    const isIdeal = result.horizon_mode === "ideal";
    const traces: Record<string, unknown>[] = [
      {
        x: result.series.sun.map((s) => s.utc),
        y: result.series.sun.map((s) => s.elevation_deg),
        name: "Sol",
        type: "scatter",
        mode: "lines",
        line: { color: "#F59E0B", width: 2 },
      },
      {
        x: result.series.earth.map((s) => s.utc),
        y: result.series.earth.map((s) => s.elevation_deg),
        name: "Tierra",
        type: "scatter",
        mode: "lines",
        line: { color: "#38BDF8", width: 2 },
      },
    ];

    if (!isIdeal) {
      traces.push(
        {
          x: result.series.sun.map((s) => s.utc),
          y: result.series.sun.map((s) => s.horizon_deg),
          name: "Horizonte → Sol",
          type: "scatter",
          mode: "lines",
          line: { color: "#FB7185", width: 1.4, dash: "dot" },
        },
        {
          x: result.series.earth.map((s) => s.utc),
          y: result.series.earth.map((s) => s.horizon_deg),
          name: "Horizonte → Tierra",
          type: "scatter",
          mode: "lines",
          line: { color: "#10B981", width: 1.4, dash: "dot" },
        },
      );
    }

    const layout: Record<string, unknown> = {
      height,
      paper_bgcolor: "#131B2E",
      plot_bgcolor: "#0B101B",
      font: {
        color: "#CBD5E1",
        family: "Inter, system-ui, sans-serif",
        size: 11,
      },
      margin: { l: 48, r: 14, t: 32, b: 40 },
      legend: {
        orientation: "h",
        y: 1.14,
        x: 0,
        bgcolor: "rgba(19, 27, 46, 0.75)",
        font: { size: 11, color: "#CBD5E1" },
      },
      xaxis: {
        title: "Evolución temporal (UTC)",
        gridcolor: "#26334D",
        tickfont: { color: "#94A3B8" },
      },
      yaxis: {
        title: "Elevación (°)",
        gridcolor: "#26334D",
        zerolinecolor: "#475569",
        tickfont: { color: "#94A3B8" },
      },
      hovermode: "x unified",
    };

    void Plotly.react(root, traces, layout, {
      responsive: true,
      displaylogo: false,
    });

    return () => {
      Plotly.purge(root);
    };
  }, [result, height]);

  return <div ref={elRef} style={{ width: "100%", height }} />;
}

export function DailyEvolutionPlot({
  result,
  height = 250,
}: DailyEvolutionPlotProps) {
  const subtitle = `${result.label} · ${result.site_name} (λ=${result.latitude_deg.toFixed(3)}°, θ=${result.longitude_east_deg.toFixed(3)}°E · ${result.horizon_label})`;
  return (
    <PlotFullscreenShell
      title="Evolución de los días (Elevación UTC)"
      subtitle={subtitle}
      height={height}
    >
      {(renderHeight) => (
        <DailyEvolutionPlotCanvas result={result} height={renderHeight} />
      )}
    </PlotFullscreenShell>
  );
}
