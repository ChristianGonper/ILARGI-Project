import { useEffect, useRef } from "react";
import { animateTracks } from "./animateTracks";
import type { SiteAnalysisResult, SkySample } from "../types";
import { PlotFullscreenShell } from "./PlotFullscreenShell";

interface SkyAzimuthPlotProps {
  result: SiteAnalysisResult;
  height?: number;
}

function circularMeanDeg(azimuths: number[]): number {
  if (azimuths.length === 0) return 0;
  let sumSin = 0;
  let sumCos = 0;
  for (const a of azimuths) {
    const rad = (a * Math.PI) / 180;
    sumSin += Math.sin(rad);
    sumCos += Math.cos(rad);
  }
  const angle =
    (Math.atan2(sumSin / azimuths.length, sumCos / azimuths.length) * 180) /
    Math.PI;
  return ((angle % 360) + 360) % 360;
}

function centerAzimuth(az: number, center: number): number {
  return ((((az - center + 180) % 360) + 360) % 360) - 180;
}

function buildTrackWithBreaks(
  samples: SkySample[],
  centerDeg: number,
): {
  x: (number | null)[];
  y: (number | null)[];
  customdata: (string | null)[];
} {
  const x: (number | null)[] = [];
  const y: (number | null)[] = [];
  const customdata: (string | null)[] = [];
  let prev: number | null = null;
  for (const s of samples) {
    const rel = centerAzimuth(s.azimuth_deg, centerDeg);
    if (prev !== null && Math.abs(rel - prev) > 180) {
      x.push(null);
      y.push(null);
      customdata.push(null);
    }
    x.push(rel);
    y.push(s.elevation_deg);
    customdata.push(s.utc);
    prev = rel;
  }
  return { x, y, customdata };
}

function SkyAzimuthPlotCanvas({
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

    const allAz = [
      ...result.series.sun.map((s) => s.azimuth_deg),
      ...result.series.earth.map((s) => s.azimuth_deg),
    ];
    const centerDeg = circularMeanDeg(allAz);

    const hProfile = result.horizon_profile;
    const hOrder = hProfile.azimuth_deg
      .map((az, idx) => ({
        rel: centerAzimuth(az, centerDeg),
        el: hProfile.elevation_deg[idx],
        trunc: hProfile.truncated[idx],
      }))
      .sort((a, b) => a.rel - b.rel);

    const allY = [
      ...hOrder
        .map((p) => p.el)
        .filter((v): v is number => v !== null && Number.isFinite(v)),
      ...result.series.sun.map((s) => s.elevation_deg),
      ...result.series.earth.map((s) => s.elevation_deg),
    ];
    const dataMin = allY.length > 0 ? Math.min(...allY) : -10;
    const dataMax = allY.length > 0 ? Math.max(...allY) : 10;
    const pad = Math.max(1.5, (dataMax - dataMin) * 0.08);
    const yMin = dataMin - pad;
    const yMax = dataMax + pad;

    const isIdeal = result.horizon_mode === "ideal";
    const traces: Record<string, unknown>[] = [];

    const sunTrack = buildTrackWithBreaks(result.series.sun, centerDeg);
    traces.push({
      x: sunTrack.x,
      y: sunTrack.y,
      customdata: sunTrack.customdata,
      name: "Sun",
      legendrank: 2,
      type: "scatter",
      mode: "lines+markers",
      marker: { size: 3.5 },
      line: { color: "#F59E0B", width: 2 },
      hovertemplate:
        "%{customdata}<br>Relative azimuth: %{x:.2f}°<br>Elevation: %{y:.2f}°<extra>Sun</extra>",
    });

    const earthTrack = buildTrackWithBreaks(result.series.earth, centerDeg);
    traces.push({
      x: earthTrack.x,
      y: earthTrack.y,
      customdata: earthTrack.customdata,
      name: "Earth",
      legendrank: 3,
      type: "scatter",
      mode: "lines+markers",
      marker: { size: 3.5 },
      line: { color: "#38BDF8", width: 2 },
      hovertemplate:
        "%{customdata}<br>Relative azimuth: %{x:.2f}°<br>Elevation: %{y:.2f}°<extra>Earth</extra>",
    });

    if (!isIdeal) {
      traces.push({
        x: hOrder.map((p) => p.rel),
        y: hOrder.map(() => yMin),
        type: "scatter",
        mode: "lines",
        line: { width: 0, color: "rgba(0,0,0,0)" },
        showlegend: false,
        hoverinfo: "skip",
      });
    }

    traces.push({
      x: hOrder.map((p) => p.rel),
      y: hOrder.map((p) => p.el),
      name: isIdeal ? "Ideal horizon (0°)" : "LOLA horizon",
      legendrank: 1,
      type: "scatter",
      mode: "lines",
      line: { color: isIdeal ? "#94A3B8" : "#F97316", width: 2 },
      fill: isIdeal ? undefined : "tonexty",
      fillcolor: isIdeal ? undefined : "rgba(249, 115, 22, 0.28)",
      hovertemplate:
        "Relative azimuth: %{x:.1f}°<br>Horizon: %{y:.2f}°<extra></extra>",
    });

    const truncPts = hOrder.filter((p) => p.trunc && p.el !== null);
    if (truncPts.length > 0) {
      traces.push({
        x: truncPts.map((p) => p.rel),
        y: truncPts.map((p) => p.el),
        name: "Terrain coverage interrupted",
        legendrank: 4,
        type: "scatter",
        mode: "markers",
        marker: { size: 4, color: "#F43F5E" },
      });
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
      margin: { l: 65, r: 14, t: 34, b: 60 },
      legend: {
        orientation: "h",
        y: 1.12,
        x: 0,
        bgcolor: "rgba(27, 31, 27, 0.9)",
        font: { size: 11, color: "#CBD5E1" },
      },
      shapes: [
        {
          type: "line",
          xref: "paper",
          x0: 0,
          x1: 1,
          yref: "y",
          y0: 0,
          y1: 0,
          line: { color: "#475569", width: 1, dash: "dot" },
        },
      ],
      xaxis: {
        title: { text: `Azimuth relative to ${centerDeg.toFixed(1)}° (°)` },
        range: [-180, 180],
        gridcolor: "#42483f",
        zerolinecolor: "#42483f",
        tickfont: { color: "#94A3B8" },
      },
      yaxis: {
        title: { text: "Local elevation (°)" },
        range: [yMin, yMax],
        gridcolor: "#42483f",
        zerolinecolor: "#475569",
        tickfont: { color: "#94A3B8" },
      },
      hovermode: "closest",
    };

    return animateTracks(root, traces, layout);
  }, [result, height]);

  return <div ref={elRef} style={{ width: "100%", height }} />;
}

export function SkyAzimuthPlot({ result, height = 300 }: SkyAzimuthPlotProps) {
  const subtitle = `${result.label} · ${result.site_name} (λ=${result.latitude_deg.toFixed(3)}°, θ=${result.longitude_east_deg.toFixed(3)}°E · ${result.horizon_label})`;
  return (
    <PlotFullscreenShell
      replay
      title="Azimuth–elevation diagram (Horizon · Sun · Earth)"
      subtitle={subtitle}
      height={height}
    >
      {(renderHeight) => (
        <SkyAzimuthPlotCanvas result={result} height={renderHeight} />
      )}
    </PlotFullscreenShell>
  );
}
