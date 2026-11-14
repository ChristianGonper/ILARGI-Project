import { useEffect, useRef } from "react";
import Plotly from "plotly.js-dist-min";
import type { SiteAnalysisResult, SkySample } from "../types";
import { PlotFullscreenShell } from "./PlotFullscreenShell";
import { buildSplitSkyTrack, centerAzimuth } from "./plotTracks";

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

function appendBodyTraces(
  traces: Record<string, unknown>[],
  samples: SkySample[],
  centerDeg: number,
  name: string,
  legendgroup: string,
  color: string,
) {
  const { visible, occluded } = buildSplitSkyTrack(samples, centerDeg);
  const hasVisible = visible.x.length > 0;
  const hasOccluded = occluded.x.length > 0;
  const hovertemplate = `%{customdata}<br>Azimut rel.: %{x:.2f}°<br>Elevación: %{y:.2f}°<extra>${name}</extra>`;

  if (hasVisible) {
    traces.push({
      x: visible.x,
      y: visible.y,
      customdata: visible.customdata,
      name,
      legendgroup,
      showlegend: true,
      type: "scatter",
      mode: "lines+markers",
      marker: { size: visible.markerSizes, color },
      line: { color, width: 2 },
      hovertemplate,
    });
  }

  if (hasOccluded) {
    traces.push({
      x: occluded.x,
      y: occluded.y,
      customdata: occluded.customdata,
      name,
      legendgroup,
      showlegend: !hasVisible,
      type: "scatter",
      mode: "lines+markers",
      marker: { size: occluded.markerSizes, color },
      line: { color, width: 2, dash: "dash" },
      hovertemplate,
    });
  }
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

    appendBodyTraces(
      traces,
      result.series.sun,
      centerDeg,
      "Sol",
      "SUN",
      "#F59E0B",
    );
    appendBodyTraces(
      traces,
      result.series.earth,
      centerDeg,
      "Tierra",
      "EARTH",
      "#38BDF8",
    );

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

export function SkyAzimuthPlot({ result, height = 300 }: SkyAzimuthPlotProps) {
  const subtitle = `${result.label} · ${result.site_name} (λ=${result.latitude_deg.toFixed(3)}°, θ=${result.longitude_east_deg.toFixed(3)}°E · ${result.horizon_label})`;
  return (
    <PlotFullscreenShell
      title="Diagrama Acimut vs Elevación (Horizonte · Sol · Tierra)"
      subtitle={subtitle}
      height={height}
    >
      {(renderHeight) => (
        <SkyAzimuthPlotCanvas result={result} height={renderHeight} />
      )}
    </PlotFullscreenShell>
  );
}
