import { MathUtils, Vector3, type PerspectiveCamera } from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/** Match mouse sensitivity to visible ground instead of the full lunar radius. */
export function moonNavigationSpeeds(distanceFromCenter: number) {
  const altitude = Math.max(0, distanceFromCenter - 1);
  return {
    rotateSpeed: MathUtils.clamp(altitude / 1.5, 0.004, 0.65),
    zoomSpeed: MathUtils.clamp(
      (altitude / distanceFromCenter) * 1.3,
      0.008,
      0.65,
    ),
  };
}

export interface CameraOrbitTween {
  startDir: Vector3;
  axis: Vector3;
  angle: number;
  startRadius: number;
  endRadius: number;
  startTime: number;
  durationMs: number;
}

export function createCameraOrbitTween(
  currentPos: Vector3,
  targetPos: Vector3,
  durationMs = 700,
): CameraOrbitTween {
  const startRadius = currentPos.length() || 4.0;
  const endRadius = targetPos.length() || 4.0;
  const startDir = currentPos.clone().normalize();
  const endDir = targetPos.clone().normalize();
  const angle = startDir.angleTo(endDir);

  let axis = startDir.clone().cross(endDir);
  if (axis.lengthSq() < 1e-6) {
    const fallback =
      Math.abs(startDir.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
    axis = startDir.clone().cross(fallback);
  }
  axis.normalize();

  return {
    startDir,
    axis,
    angle,
    startRadius,
    endRadius,
    startTime: performance.now(),
    durationMs,
  };
}

export function stepCameraOrbitTween(
  tween: CameraOrbitTween,
  camera: PerspectiveCamera,
  controls: OrbitControls,
): boolean {
  const raw = Math.min(
    1,
    (performance.now() - tween.startTime) / tween.durationMs,
  );
  const eased =
    raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;

  const dir = tween.startDir
    .clone()
    .applyAxisAngle(tween.axis, tween.angle * eased);
  const radius = MathUtils.lerp(tween.startRadius, tween.endRadius, eased);

  camera.position.copy(dir.multiplyScalar(radius));
  controls.target.set(0, 0, 0);
  return raw < 1;
}
