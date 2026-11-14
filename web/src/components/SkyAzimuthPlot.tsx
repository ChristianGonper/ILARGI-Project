import { useEffect, useRef } from "react";
import Plotly from "plotly.js-dist-min";
import type { SiteAnalysisResult, SkySample } from "../types";

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

export function SkyAzimuthPlot({ result, height = 300 }: SkyAzimuthPlotProps) {
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

    const isIdeal = result.horizon_mode === "ideal";
    const traces: Record<string, unknown>[] = [
      {
        x: hOrder.map((p) => p.rel),
        y: hOrder.map((p) => p.el),
        name: isIdeal ? "Horizonte ideal (0°)" : "Horizonte LOLA",
        type: "scatter",
        mode: "lines",
        line: { color: isIdeal ? "#94A3B8" : "#F97316", width: 2 },
        hovertemplate:
          "Azimut rel.: %{x:.1f}°<br>Horizonte: %{y:.2f}°<extra></extra>",
      },
    ];

    const truncPts = hOrder.filter((p) => p.trunc && p.el !== null);
    if (truncPts.length > 0) {
      traces.push({
        x: truncPts.map((p) => p.rel),
        y: truncPts.map((p) => p.el),
        name: "Terreno interrumpido",
        type: "scatter",
        mode: "markers",
        marker: { size: 4, color: "#F43F5E" },
      });
    }

    const sunTrack = buildTrackWithBreaks(result.series.sun, centerDeg);
    traces.push({
      x: sunTrack.x,
      y: sunTrack.y,
      customdata: sunTrack.customdata,
      name: "Sol",
      type: "scatter",
      mode: "lines+markers",
      marker: { size: 3.5 },
      line: { color: "#F59E0B", width: 2 },
      hovertemplate:
        "%{customdata}<br>Azimut rel.: %{x:.2f}°<br>Elevación: %{y:.2f}°<extra>Sol</extra>",
    });

    const earthTrack = buildTrackWithBreaks(result.series.earth, centerDeg);
    traces.push({
      x: earthTrack.x,
      y: earthTrack.y,
      customdata: earthTrack.customdata,
      name: "Tierra",
      type: "scatter",
      mode: "lines+markers",
      marker: { size: 3.5 },
      line: { color: "#38BDF8", width: 2 },
      hovertemplate:
        "%{customdata}<br>Azimut rel.: %{x:.2f}°<br>Elevación: %{y:.2f}°<extra>Tierra</extra>",
    });

    const layout: Record<string, unknown> = {
      height,
      paper_bgcolor: "#131B2E",
      plot_bgcolor: "#0B101B",
      font: {
        color: "#CBD5E1",
        family: "Inter, system-ui, sans-serif",
        size: 11,
      },
      margin: { l: 48, r: 14, t: 34, b: 42 },
      legend: {
        orientation: "h",
        y: 1.12,
        x: 0,
        bgcolor: "rgba(19, 27, 46, 0.75)",
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
        title: `Azimut relativo al centro (${centerDeg.toFixed(1)}°) (°)`,
        range: [-180, 180],
        gridcolor: "#26334D",
        zerolinecolor: "#26334D",
        tickfont: { color: "#94A3B8" },
      },
      yaxis: {
        title: "Elevación local (°)",
        gridcolor: "#26334D",
        zerolinecolor: "#475569",
        tickfont: { color: "#94A3B8" },
      },
      hovermode: "closest",
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
