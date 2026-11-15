import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAnimationFrame,
  computeTrackAnimationState,
  resolveValidPointIndex,
  TRACK_ANIMATION_DURATION_MS,
} from "../src/components/trackAnimation";

test("computeTrackAnimationState draws first pass, finishes it, then loops continuously", () => {
  const half = computeTrackAnimationState(
    TRACK_ANIMATION_DURATION_MS / 2,
    false,
  );
  assert.equal(half.phase, "drawing");
  assert.equal(half.progress, 0.5);

  const endFirstPass = computeTrackAnimationState(
    TRACK_ANIMATION_DURATION_MS + 25,
    false,
  );
  assert.equal(endFirstPass.phase, "finish-first-pass");
  assert.equal(endFirstPass.progress, 1);

  const loopStart = computeTrackAnimationState(
    TRACK_ANIMATION_DURATION_MS,
    true,
  );
  assert.equal(loopStart.phase, "looping");
  assert.equal(loopStart.progress, 0);

  const loopSecondCycleHalf = computeTrackAnimationState(
    TRACK_ANIMATION_DURATION_MS * 2.5,
    true,
  );
  assert.equal(loopSecondCycleHalf.phase, "looping");
  assert.equal(loopSecondCycleHalf.progress, 0.5);
});

test("buildAnimationFrame preserves full Sun and Earth background trails while looping icons from start", () => {
  const baseTraces: Record<string, unknown>[] = [
    {
      name: "Sun",
      x: [10, 20, 30, 40],
      y: [1, 2, 3, 4],
      customdata: ["t0", "t1", "t2", "t3"],
      mode: "lines+markers",
    },
    {
      name: "Earth",
      x: [-10, -20, -30, -40],
      y: [5, 6, 7, 8],
      customdata: ["t0", "t1", "t2", "t3"],
      mode: "lines+markers",
    },
    {
      name: "LOLA horizon",
      x: [-90, 0, 90],
      y: [0, 0, 0],
      mode: "lines",
    },
  ];

  const drawingFrame = buildAnimationFrame(baseTraces, {
    phase: "drawing",
    progress: 0.5,
    reduced: false,
  });
  assert.deepEqual(drawingFrame[0].x, [10, 20]);
  assert.deepEqual(drawingFrame[1].x, [-10, -20]);
  assert.deepEqual(drawingFrame[3].x, [20]);
  assert.deepEqual(drawingFrame[4].x, [-20]);

  const loopingAtStart = buildAnimationFrame(baseTraces, {
    phase: "looping",
    progress: 0,
    reduced: false,
  });
  assert.deepEqual(loopingAtStart[0].x, [10, 20, 30, 40]);
  assert.deepEqual(loopingAtStart[0].y, [1, 2, 3, 4]);
  assert.deepEqual(loopingAtStart[1].x, [-10, -20, -30, -40]);
  assert.deepEqual(loopingAtStart[1].y, [5, 6, 7, 8]);
  assert.deepEqual(loopingAtStart[3].x, [10]);
  assert.deepEqual(loopingAtStart[3].y, [1]);
  assert.deepEqual(loopingAtStart[4].x, [-10]);
  assert.deepEqual(loopingAtStart[4].y, [5]);

  const loopingMid = buildAnimationFrame(baseTraces, {
    phase: "looping",
    progress: 0.75,
    reduced: false,
  });
  assert.deepEqual(loopingMid[0].x, [10, 20, 30, 40]);
  assert.deepEqual(loopingMid[3].x, [40]);
  assert.deepEqual(loopingMid[4].x, [-40]);
});

test("resolveValidPointIndex skips null azimuth-wrap breaks so icons stay visible", () => {
  const x = [-179, null, 179];
  const y = [2, null, 3];
  assert.equal(resolveValidPointIndex(x, y, 1), 0);

  const frame = buildAnimationFrame(
    [
      { name: "Sun", x, y, mode: "lines" },
      { name: "Earth", x: [0, 1, 2], y: [4, 5, 6], mode: "lines" },
    ],
    { phase: "looping", progress: 0.4, reduced: false },
  );
  assert.deepEqual(frame[2].x, [-179]);
  assert.deepEqual(frame[2].y, [2]);
});
