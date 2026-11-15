import Plotly from "plotly.js-gl2d-dist-min";
import {
  buildAnimationFrame,
  computeTrackAnimationState,
  TRACK_ANIMATION_DURATION_MS,
  TRACK_ANIMATION_FRAME_MS,
} from "./trackAnimation";

export interface TrackAnimationController {
  setPaused: (paused: boolean) => void;
}

export interface AnimateTracksOptions {
  initialPaused?: boolean;
  onController?: (controller: TrackAnimationController | null) => void;
}

export function animateTracks(
  root: HTMLElement,
  traces: Record<string, unknown>[],
  layout: Record<string, unknown>,
  options?: AnimateTracksOptions,
) {
  let cancelled = false;
  let timer = 0;
  let paused = options?.initialPaused ?? false;
  let firstPassComplete = false;
  let accumulatedMs = 0;
  let segmentStart = performance.now();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const plotLayout =
    layout.uirevision === undefined
      ? { ...layout, uirevision: "track-loop" }
      : layout;

  const scheduleNext = () => {
    if (cancelled || reduced || paused) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      void draw();
    }, TRACK_ANIMATION_FRAME_MS);
  };

  const draw = async () => {
    if (cancelled) return;
    const now = performance.now();
    const elapsedMs = paused
      ? accumulatedMs
      : accumulatedMs + (now - segmentStart);
    const { phase, progress } = computeTrackAnimationState(
      elapsedMs,
      firstPassComplete,
    );
    const frame = buildAnimationFrame(traces, { phase, progress, reduced });

    await Plotly.react(root, frame, plotLayout, {
      responsive: true,
      displaylogo: false,
    });

    if (cancelled) return;
    if (phase === "finish-first-pass") {
      firstPassComplete = true;
      accumulatedMs = TRACK_ANIMATION_DURATION_MS;
      segmentStart = performance.now();
    }
    scheduleNext();
  };

  options?.onController?.({
    setPaused(nextPaused: boolean) {
      if (cancelled || nextPaused === paused) return;
      if (nextPaused) {
        accumulatedMs += performance.now() - segmentStart;
        paused = true;
        window.clearTimeout(timer);
        timer = 0;
      } else {
        paused = false;
        segmentStart = performance.now();
        void draw();
      }
    },
  });

  void draw();

  return () => {
    cancelled = true;
    window.clearTimeout(timer);
    options?.onController?.(null);
    Plotly.purge(root);
  };
}
