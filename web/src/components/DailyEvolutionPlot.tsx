import { useEffect, useRef } from "react";
import { animateTracks } from "./animateTracks";
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
        name: "Sun",
        type: "scatter",
        mode: "lines",
        line: { color: "#F59E0B", width: 2 },
      },
      {
        x: result.series.earth.map((s) => s.utc),
        y: result.series.earth.map((s) => s.elevation_deg),
        name: "Earth",
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
          name: "Horizon → Sun",
          type: "scatter",
          mode: "lines",
          line: { color: "#FB7185", width: 1.4, dash: "dot" },
        },
        {
          x: result.series.earth.map((s) => s.utc),
          y: result.series.earth.map((s) => s.horizon_deg),
          name: "Horizon → Earth",
          type: "scatter",
          mode: "lines",
          line: { color: "#10B981", width: 1.4, dash: "dot" },
        },
      );
    }

    const layout: Record<string, unknown> = {
      height,
      paper_bgcolor: "#1b1f1b",
      plot_bgcolor: "#101310",
      font: {
        color: "#CBD5E1",
        family: "Inter, system-ui, sans-serif",
        size: 11,
      },
      margin: { l: 65, r: 14, t: 32, b: 60 },
      legend: {
        orientation: "h",
        y: 1.14,
        x: 0,
        bgcolor: "rgba(27, 31, 27, 0.9)",
        font: { size: 11, color: "#CBD5E1" },
      },
      xaxis: {
        title: { text: "Time (UTC)" },
        range: [
          result.start_utc,
          result.series.sun[result.series.sun.length - 1]?.utc ??
            result.start_utc,
        ],
        gridcolor: "#42483f",
        tickfont: { color: "#94A3B8" },
      },
      yaxis: {
        title: { text: "Elevation (°)" },
        range: (() => {
          const values = [...result.series.sun, ...result.series.earth]
            .flatMap((s) => [s.elevation_deg, s.horizon_deg])
            .filter((v): v is number => v !== null && Number.isFinite(v));
          const low = Math.min(...values);
          const high = Math.max(...values);
          const pad = Math.max(1, (high - low) * 0.08);
          return [low - pad, high + pad];
        })(),
        gridcolor: "#42483f",
        zerolinecolor: "#475569",
        tickfont: { color: "#94A3B8" },
      },
      hovermode: "x unified",
    };

    return animateTracks(root, traces, layout);
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
      replay
      title="Elevation over time (UTC)"
      subtitle={subtitle}
      height={height}
    >
      {(renderHeight) => (
        <DailyEvolutionPlotCanvas result={result} height={renderHeight} />
      )}
    </PlotFullscreenShell>
  );
}
