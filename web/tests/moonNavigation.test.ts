import assert from "node:assert/strict";
import test from "node:test";
import { moonNavigationSpeeds } from "../src/three/moonNavigation";

test("rotation and wheel sensitivity decrease with altitude", () => {
  const far = moonNavigationSpeeds(3);
  const near = moonNavigationSpeeds(1.1);
  const surface = moonNavigationSpeeds(1.012);
  assert.ok(far.rotateSpeed <= 0.65);
  assert.ok(near.rotateSpeed < far.rotateSpeed / 5);
  assert.ok(surface.rotateSpeed < near.rotateSpeed / 5);
  assert.ok(surface.zoomSpeed < near.zoomSpeed);
  assert.ok(near.zoomSpeed < far.zoomSpeed);
  assert.ok(surface.rotateSpeed > 0 && surface.zoomSpeed > 0);
});
