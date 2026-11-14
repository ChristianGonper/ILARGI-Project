import { useEffect, useMemo, useRef, useState } from "react";
import Plotly from "plotly.js-dist-min";
import { formatUtcShort } from "../api";
import type { SiteAnalysisResult, SkySample } from "../types";
import { PlotFullscreenShell } from "./PlotFullscreenShell";

interface DiscVisibilityPanelProps {
  result: SiteAnalysisResult;
}

type DiscState = "Visible" | "Relieve" | "Tierra" | "Sin datos";

function horizonAt(
  profile: SiteAnalysisResult["horizon_profile"],
  azimuthDeg: number,
): number | null {
  const n = profile.azimuth_deg.length;
  if (n === 0) return null;
  const az = ((azimuthDeg % 360) + 360) % 360;

  let lo = 0;
  let hi = n - 1;
  if (az < profile.azimuth_deg[0]) {
    lo = n - 1;
    hi = 0;
  } else {
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (profile.azimuth_deg[mid] <= az) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    hi = lo + 1 < n ? lo + 1 : 0;
  }

  const h0 = profile.elevation_deg[lo];
  const h1 = profile.elevation_deg[hi];
  if (h0 === null || h1 === null) return null;

  const az0 = profile.azimuth_deg[lo];
  const az1 = hi === 0 ? 360 : profile.azimuth_deg[hi];
  const span = az1 - az0;
  const t = span > 0 ? (az - az0) / span : 0;
  return h0 + t * (h1 - h0);
}

function buildDiscScatterPoints(
  body: "SUN" | "EARTH",
  sample: SkySample,
  profile: SiteAnalysisResult["horizon_profile"],
  earthSample: SkySample | undefined,
  samples = 61,
): Record<DiscState, { x: number[]; y: number[] }> {
  const buckets: Record<DiscState, { x: number[]; y: number[] }> = {
    Visible: { x: [], y: [] },
    Relieve: { x: [], y: [] },
    Tierra: { x: [], y: [] },
    "Sin datos": { x: [], y: [] },
  };

  const deg2rad = Math.PI / 180;
  const rad2deg = 180 / Math.PI;
  const az0 = sample.azimuth_deg * deg2rad;
  const el0 = sample.elevation_deg * deg2rad;
  const cosEl0 = Math.cos(el0);
  const sinEl0 = Math.sin(el0);
  const cosAz0 = Math.cos(az0);
  const sinAz0 = Math.sin(az0);

  const cx = cosEl0 * cosAz0;
  const cy = cosEl0 * sinAz0;
  const cz = sinEl0;
  const ex = -sinAz0;
  const ey = cosAz0;
  const ux = -sinEl0 * cosAz0;
  const uy = -sinEl0 * sinAz0;
  const uz = cosEl0;
  const tanR = Math.tan(sample.angular_radius_deg * deg2rad);

  let earthCx = 0;
  let earthCy = 0;
  let earthCz = 0;
  let cosEarthR = 2;
  if (body === "SUN" && earthSample) {
    const eaz = earthSample.azimuth_deg * deg2rad;
    const eel = earthSample.elevation_deg * deg2rad;
    earthCx = Math.cos(eel) * Math.cos(eaz);
    earthCy = Math.cos(eel) * Math.sin(eaz);
    earthCz = Math.sin(eel);
    cosEarthR = Math.cos(earthSample.angular_radius_deg * deg2rad);
  }

  for (let i = 0; i < samples; i++) {
    const gy = ((i + 0.5) * 2) / samples - 1;
    for (let j = 0; j < samples; j++) {
      const gx = ((j + 0.5) * 2) / samples - 1;
      if (gx * gx + gy * gy >= 1) continue;

      const vx = cx + tanR * (gx * ex + gy * ux);
      const vy = cy + tanR * (gx * ey + gy * uy);
      const vz = cz + tanR * (gy * uz);
      const norm = Math.hypot(vx, vy, vz);
      const nx = vx / norm;
      const ny = vy / norm;
      const nz = Math.max(-1, Math.min(1, vz / norm));

      const az = (((Math.atan2(ny, nx) * rad2deg) % 360) + 360) % 360;
      const el = Math.asin(nz) * rad2deg;
      const dx =
        (((((az - sample.azimuth_deg + 180) % 360) + 360) % 360) - 180) *
        cosEl0;
      const dy = el - sample.elevation_deg;

      let state: DiscState;
      if (
        body === "SUN" &&
        earthSample &&
        nx * earthCx + ny * earthCy + nz * earthCz >= cosEarthR
      ) {
        state = "Tierra";
      } else {
        const h = horizonAt(profile, az);
        state = h === null ? "Sin datos" : el > h ? "Visible" : "Relieve";
      }
      buckets[state].x.push(dx);
      buckets[state].y.push(dy);
    }
  }

  return buckets;
}

function DiscFractionTrendCanvas({
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

    const traces: Record<string, unknown>[] = [
      {
        x: result.series.sun.map((s) => s.utc),
        y: result.series.sun.map((s) => s.direct_visible_fraction),
        name: "Sol directo",
        type: "scatter",
        mode: "lines",
        line: { color: "#F59E0B", width: 2 },
      },
      {
        x: result.series.earth.map((s) => s.utc),
        y: result.series.earth.map((s) => s.direct_visible_fraction),
        name: "Tierra visible",
        type: "scatter",
        mode: "lines",
        line: { color: "#38BDF8", width: 2 },
      },
      {
        x: result.series.sun.map((s) => s.utc),
        y: result.series.sun.map((s) => s.eclipsed_fraction),
        name: "Fracción eclipsada",
        type: "scatter",
        mode: "lines",
        line: { color: "#A78BFA", width: 1.5, dash: "dot" },
      },
    ];

    const layout: Record<string, unknown> = {
      height,
      paper_bgcolor: "#131B2E",
      plot_bgcolor: "#0B101B",
      font: {
        color: "#CBD5E1",
        family: "Inter, system-ui, sans-serif",
        size: 11,
      },
      margin: { l: 48, r: 14, t: 32, b: 36 },
      legend: {
        orientation: "h",
        y: 1.16,
        x: 0,
        bgcolor: "rgba(19, 27, 46, 0.75)",
        font: { size: 11, color: "#CBD5E1" },
      },
      xaxis: {
        title: "Instante (UTC)",
        gridcolor: "#26334D",
        tickfont: { color: "#94A3B8" },
      },
      yaxis: {
        title: "Fracción de disco",
        range: [-0.04, 1.06],
        gridcolor: "#26334D",
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

function SingleDiscCanvas({
  body,
  sample,
  earthSample,
  profile,
  height,
}: {
  body: "SUN" | "EARTH";
  sample: SkySample;
  earthSample: SkySample | undefined;
  profile: SiteAnalysisResult["horizon_profile"];
  height: number;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);

  const buckets = useMemo(
    () => buildDiscScatterPoints(body, sample, profile, earthSample),
    [body, sample, profile, earthSample],
  );

  useEffect(() => {
    const root = elRef.current;
    if (!root) return;

    const palette: Array<[DiscState, string]> = [
      ["Visible", body === "SUN" ? "#f4bb43" : "#478dec"],
      ["Relieve", "#515968"],
      ["Tierra", "#2464ae"],
      ["Sin datos", "#c65353"],
    ];

    const traces: Record<string, unknown>[] = [];
    for (const [state, color] of palette) {
      const pts = buckets[state];
      if (pts.x.length === 0) continue;
      traces.push({
        x: pts.x,
        y: pts.y,
        name: state,
        type: "scattergl",
        mode: "markers",
        marker: { size: 3, color },
      });
    }

    const layout: Record<string, unknown> = {
      height,
      title: {
        text: body === "SUN" ? "Sol" : "Tierra",
        font: { size: 12, color: "#F1F5F9" },
      },
      paper_bgcolor: "#131B2E",
      plot_bgcolor: "#0B101B",
      font: {
        color: "#CBD5E1",
        family: "Inter, system-ui, sans-serif",
        size: 10.5,
      },
      margin: { l: 42, r: 10, t: 32, b: 36 },
      legend: {
        orientation: "h",
        y: -0.22,
        x: 0,
        font: { size: 10, color: "#CBD5E1" },
      },
      xaxis: {
        title: "Despl. angular (°)",
        gridcolor: "#26334D",
        zerolinecolor: "#334155",
        tickfont: { color: "#94A3B8" },
      },
      yaxis: {
        title: "Elev. rel. (°)",
        scaleanchor: "x",
        scaleratio: 1,
        gridcolor: "#26334D",
        zerolinecolor: "#334155",
        tickfont: { color: "#94A3B8" },
      },
    };

    void Plotly.react(root, traces, layout, {
      responsive: true,
      displaylogo: false,
    });

    return () => {
      Plotly.purge(root);
    };
  }, [body, buckets, height]);

  return <div ref={elRef} style={{ width: "100%", height }} />;
}

function formatFrac(val: number | null): string {
  if (val === null || !Number.isFinite(val)) return "Sin datos";
  return `${(val * 100).toFixed(1)}%`;
}

export function DiscVisibilityPanel({ result }: DiscVisibilityPanelProps) {
  const defaultIndex = useMemo(() => {
    let bestIdx = 0;
    let bestEclipse = 0;
    result.series.sun.forEach((s, i) => {
      if ((s.eclipsed_fraction ?? 0) > bestEclipse) {
        bestEclipse = s.eclipsed_fraction ?? 0;
        bestIdx = i;
      }
    });
    return bestIdx;
  }, [result]);

  const [sampleIdx, setSampleIdx] = useState(defaultIndex);

  useEffect(() => {
    setSampleIdx(defaultIndex);
  }, [defaultIndex]);

  const sunSeries = result.series.sun;
  const earthSeries = result.series.earth;
  if (sunSeries.length === 0) return null;

  const clampedIdx = Math.min(sampleIdx, sunSeries.length - 1);
  const sunSample = sunSeries[clampedIdx];
  const earthSample = earthSeries[clampedIdx];
  const subtitle = `${result.label} · ${result.site_name} (λ=${result.latitude_deg.toFixed(3)}°, θ=${result.longitude_east_deg.toFixed(3)}°E · ${result.horizon_label})`;

  return (
    <div className="disc-section">
      <div className="chart-card">
        <PlotFullscreenShell
          title="Discos visibles y eclipse (Fracción directa)"
          subtitle={subtitle}
          height={200}
        >
          {(renderHeight) => (
            <DiscFractionTrendCanvas result={result} height={renderHeight} />
          )}
        </PlotFullscreenShell>
      </div>

      <div className="chart-card">
        <div className="disc-controls">
          <div className="disc-controls-head">
            <span className="chart-title" style={{ marginBottom: 0 }}>
              Instante de los discos (UTC)
            </span>
            <span className="mono-sub">
              {formatUtcShort(sunSample.utc)}
              {result.visibility.eclipse_samples > 0
                ? ` · Eclipse máx. ${result.visibility.max_eclipse_pct.toFixed(1)}%`
                : ""}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(0, sunSeries.length - 1)}
            value={clampedIdx}
            onChange={(ev) => setSampleIdx(Number(ev.target.value))}
            aria-label="Instante de los discos (UTC)"
            className="disc-slider"
          />
          <div className="disc-metrics-row mono-sub">
            <span>
              <strong className="tag-sun">Sol:</strong> visible{" "}
              {formatFrac(sunSample.direct_visible_fraction)} · eclipse{" "}
              {formatFrac(sunSample.eclipsed_fraction)} (r=
              {sunSample.angular_radius_deg.toFixed(3)}°)
            </span>
            {earthSample && (
              <span>
                <strong className="tag-earth">Tierra:</strong> visible{" "}
                {formatFrac(earthSample.direct_visible_fraction)} (r=
                {earthSample.angular_radius_deg.toFixed(3)}°)
              </span>
            )}
          </div>
        </div>

        <div className="disc-grid">
          <SingleDiscCanvas
            body="SUN"
            sample={sunSample}
            earthSample={earthSample}
            profile={result.horizon_profile}
            height={230}
          />
          {earthSample && (
            <SingleDiscCanvas
              body="EARTH"
              sample={earthSample}
              earthSample={earthSample}
              profile={result.horizon_profile}
              height={230}
            />
          )}
        </div>
        <div className="disc-caption">
          Fracción geométrica del disco sobre el horizonte y fracción solar
          directa tras ocultación por la Tierra. La atmósfera terrestre no se
          modela; el horizonte parcial puede sobrestimar la visibilidad.
        </div>
      </div>
    </div>
  );
}
