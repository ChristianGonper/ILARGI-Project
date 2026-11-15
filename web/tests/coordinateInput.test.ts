import assert from "node:assert/strict";
import test from "node:test";
import {
  clampCoordinate,
  coordinateStepBounds,
} from "../src/components/InputPanel";

test("coordinateStepBounds aligns latitude bounds to integers so step=1 avoids .999 offsets", () => {
  const latBounds = coordinateStepBounds(-89.999, 89.999);
  assert.equal(latBounds.stepMin, -90);
  assert.equal(latBounds.stepMax, 90);

  const lonBounds = coordinateStepBounds(-180, 180);
  assert.equal(lonBounds.stepMin, -180);
  assert.equal(lonBounds.stepMax, 180);
});

test("clampCoordinate keeps values strictly within allowed latitude bounds", () => {
  assert.equal(clampCoordinate(-90, -89.999, 89.999), -89.999);
  assert.equal(clampCoordinate(90, -89.999, 89.999), 89.999);
  assert.equal(clampCoordinate(-89, -89.999, 89.999), -89);
  assert.equal(clampCoordinate(-89.5, -89.999, 89.999), -89.5);
  assert.equal(clampCoordinate(0, -89.999, 89.999), 0);
});
