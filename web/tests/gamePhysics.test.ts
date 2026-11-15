import assert from "node:assert/strict";
import test from "node:test";
import {
  computePhase2Mechanics,
  orbitPointLatLon,
  solveInclinationForSite,
} from "../src/components/landing-game/gamePhysics";

test("equatorial target needs no artificial plane change", () => {
  const solution = solveInclinationForSite(0, 23, 100);
  assert.equal(solution.requiredInclinationDeg, 0);
  assert.equal(solution.planeChangeDeltaVMs, 0);
});

test("northern and southern target extrema lie on the solved ground track", () => {
  for (const latitude of [-89.5, -26, 26, 89.5]) {
    const solution = solveInclinationForSite(latitude, 23, 100);
    const point = orbitPointLatLon(
      solution.requiredInclinationDeg,
      solution.ascendingNodeDeg,
      (Math.sign(latitude) * Math.PI) / 2,
    );
    assert.ok(Math.abs(point.latitudeDeg - latitude) < 1e-8);
    assert.ok(Math.abs(point.longitudeEastDeg - 23) < 1e-8);
  }
});

test("descent geometry rejects reversed or nonfinite altitudes", () => {
  assert.throws(() => computePhase2Mechanics(10, 20));
  assert.throws(() => computePhase2Mechanics(NaN, 10));
  const transfer = computePhase2Mechanics(100, 10);
  assert.equal(transfer.descentDeltaKm, 90);
  assert.ok(transfer.deorbitBurnDeltaVMs > 0);
  assert.ok(transfer.periluneSpeedMs > transfer.initialSpeedMs);
});
