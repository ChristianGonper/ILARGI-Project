export const TRACK_ANIMATION_DURATION_MS = 6500;
export const TRACK_ANIMATION_FRAME_MS = 70;

export type TrackAnimationPhase = "drawing" | "finish-first-pass" | "looping";

export interface TrackAnimationState {
  phase: TrackAnimationPhase;
  progress: number;
}

export function computeTrackAnimationState(
  elapsedMs: number,
  firstPassComplete: boolean,
  durationMs = TRACK_ANIMATION_DURATION_MS,
): TrackAnimationState {
  const safeDuration = Math.max(1, durationMs);
  const clampedElapsed = Math.max(0, elapsedMs);

  if (!firstPassComplete) {
    if (clampedElapsed >= safeDuration) {
      return { phase: "finish-first-pass", progress: 1 };
    }
    return { phase: "drawing", progress: clampedElapsed / safeDuration };
  }

  const loopElapsed = (clampedElapsed - safeDuration) % safeDuration;
  return {
    phase: "looping",
    progress: Math.max(0, loopElapsed) / safeDuration,
  };
}

export function resolveValidPointIndex(
  x: (number | string | null)[],
  y: (number | null)[],
  targetIndex: number,
): number | null {
  const len = Math.min(x.length, y.length);
  if (len === 0) return null;

  const clamped = Math.max(0, Math.min(len - 1, targetIndex));
  if (x[clamped] !== null && y[clamped] !== null) {
    return clamped;
  }

  for (let offset = 1; offset < len; offset++) {
    const back = clamped - offset;
    if (back >= 0 && x[back] !== null && y[back] !== null) {
      return back;
    }
    const forward = clamped + offset;
    if (forward < len && x[forward] !== null && y[forward] !== null) {
      return forward;
    }
  }

  return null;
}

export function buildAnimationFrame(
  traces: Record<string, unknown>[],
  options: {
    phase: TrackAnimationPhase;
    progress: number;
    reduced: boolean;
  },
): Record<string, unknown>[] {
  const { phase, progress, reduced } = options;
  const moving = traces
    .map((trace, index) => ({ trace, index }))
    .filter(({ trace }) => trace.name === "Sun" || trace.name === "Earth");

  const frame = traces.map((trace) => ({ ...trace }));
  const showFullTrail = reduced || phase !== "drawing";

  for (const { trace, index } of moving) {
    const x = trace.x as (number | string | null)[];
    const y = trace.y as (number | null)[];
    const len = x.length;

    if (showFullTrail) {
      frame[index] = {
        ...trace,
        mode: "lines",
      };
      if (len > 0) {
        const rawIndex =
          reduced || phase === "finish-first-pass"
            ? len - 1
            : Math.min(len - 1, Math.floor(progress * len));
        const markerIndex = resolveValidPointIndex(x, y, rawIndex);
        if (markerIndex !== null) {
          frame.push({
            x: [x[markerIndex]],
            y: [y[markerIndex]],
            type: "scatter",
            mode: "text",
            text: [trace.name === "Sun" ? "\u2600" : "\ud83c\udf0d"],
            textfont: { size: 22 },
            showlegend: false,
            hoverinfo: "skip",
          });
        }
      }
      continue;
    }

    const count = Math.floor(progress * len);
    frame[index] = {
      ...trace,
      mode: "lines",
      x: x.slice(0, count),
      y: y.slice(0, count),
      customdata: (trace.customdata as unknown[] | undefined)?.slice(0, count),
    };
    if (count > 0) {
      const markerIndex = resolveValidPointIndex(x, y, count - 1);
      if (markerIndex !== null) {
        frame.push({
          x: [x[markerIndex]],
          y: [y[markerIndex]],
          type: "scatter",
          mode: "text",
          text: [trace.name === "Sun" ? "\u2600" : "\ud83c\udf0d"],
          textfont: { size: 22 },
          showlegend: false,
          hoverinfo: "skip",
        });
      }
    }
  }

  return frame;
}
