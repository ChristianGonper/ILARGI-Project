import type { SkySample } from "../types";

export interface SplitSkyTrack {
  x: (number | null)[];
  y: (number | null)[];
  customdata: (string | null)[];
  markerSizes: number[];
}

export interface SplitTimeTrack {
  x: (string | null)[];
  y: (number | null)[];
}

export function centerAzimuth(az: number, center: number): number {
  return ((((az - center + 180) % 360) + 360) % 360) - 180;
}

function interpolateCrossingFrac(m0: number, m1: number): number {
  const denom = m0 - m1;
  if (denom === 0) return 0.5;
  return Math.min(1, Math.max(0, m0 / denom));
}

export function buildSplitSkyTrack(
  samples: SkySample[],
  centerDeg: number,
): { visible: SplitSkyTrack; occluded: SplitSkyTrack } {
  const visible: SplitSkyTrack = {
    x: [],
    y: [],
    customdata: [],
    markerSizes: [],
  };
  const occluded: SplitSkyTrack = {
    x: [],
    y: [],
    customdata: [],
    markerSizes: [],
  };

  const pushBreak = (target: SplitSkyTrack) => {
    if (target.x.length > 0 && target.x[target.x.length - 1] !== null) {
      target.x.push(null);
      target.y.push(null);
      target.customdata.push(null);
      target.markerSizes.push(0);
    }
  };

  for (let i = 0; i < samples.length; i += 1) {
    const s = samples[i];
    const rel = centerAzimuth(s.azimuth_deg, centerDeg);
    const currTarget = s.visible ? visible : occluded;

    if (i > 0) {
      const prev = samples[i - 1];
      const prevRel = centerAzimuth(prev.azimuth_deg, centerDeg);
      const wraps = Math.abs(rel - prevRel) > 180;
      const prevTarget = prev.visible ? visible : occluded;

      if (wraps) {
        pushBreak(prevTarget);
      } else if (prev.visible !== s.visible) {
        const frac = interpolateCrossingFrac(prev.margin_deg, s.margin_deg);
        const relCross = prevRel + frac * (rel - prevRel);
        const elCross =
          prev.elevation_deg + frac * (s.elevation_deg - prev.elevation_deg);
        const t0 = Date.parse(prev.utc);
        const t1 = Date.parse(s.utc);
        const utcCross = new Date(t0 + frac * (t1 - t0)).toISOString();

        prevTarget.x.push(relCross);
        prevTarget.y.push(elCross);
        prevTarget.customdata.push(utcCross);
        prevTarget.markerSizes.push(0);
        pushBreak(prevTarget);

        currTarget.x.push(relCross);
        currTarget.y.push(elCross);
        currTarget.customdata.push(utcCross);
        currTarget.markerSizes.push(0);
      }
    }

    currTarget.x.push(rel);
    currTarget.y.push(s.elevation_deg);
    currTarget.customdata.push(s.utc);
    currTarget.markerSizes.push(3.5);
  }

  return { visible, occluded };
}

export function buildSplitTimeTrack(samples: SkySample[]): {
  visible: SplitTimeTrack;
  occluded: SplitTimeTrack;
} {
  const visible: SplitTimeTrack = { x: [], y: [] };
  const occluded: SplitTimeTrack = { x: [], y: [] };

  const pushBreak = (target: SplitTimeTrack) => {
    if (target.x.length > 0 && target.x[target.x.length - 1] !== null) {
      target.x.push(null);
      target.y.push(null);
    }
  };

  for (let i = 0; i < samples.length; i += 1) {
    const s = samples[i];
    const currTarget = s.visible ? visible : occluded;

    if (i > 0) {
      const prev = samples[i - 1];
      if (prev.visible !== s.visible) {
        const frac = interpolateCrossingFrac(prev.margin_deg, s.margin_deg);
        const t0 = Date.parse(prev.utc);
        const t1 = Date.parse(s.utc);
        const utcCross = new Date(t0 + frac * (t1 - t0)).toISOString();
        const elCross =
          prev.elevation_deg + frac * (s.elevation_deg - prev.elevation_deg);

        const prevTarget = prev.visible ? visible : occluded;
        prevTarget.x.push(utcCross);
        prevTarget.y.push(elCross);
        pushBreak(prevTarget);

        currTarget.x.push(utcCross);
        currTarget.y.push(elCross);
      }
    }

    currTarget.x.push(s.utc);
    currTarget.y.push(s.elevation_deg);
  }

  return { visible, occluded };
}
