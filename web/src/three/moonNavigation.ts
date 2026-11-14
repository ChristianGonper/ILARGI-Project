import { MathUtils } from "three";

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
