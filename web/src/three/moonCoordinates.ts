import * as THREE from "three";

export const LUNAR_RADIUS_M = 1_737_400;
export const LUNAR_RADIUS_KM = 1_737.4;

/** Display axes: +Y north, +Z longitude 0°, +X longitude 90° east. */
export function latLonToThreeVector(
  latitudeDeg: number,
  longitudeEastDeg: number,
  radius = 1.0,
): THREE.Vector3 {
  const lat = THREE.MathUtils.degToRad(latitudeDeg);
  const lon = THREE.MathUtils.degToRad(longitudeEastDeg);
  const cosLat = Math.cos(lat);
  const x = radius * cosLat * Math.sin(lon);
  const y = radius * Math.sin(lat);
  const z = radius * cosLat * Math.cos(lon);
  return new THREE.Vector3(x, y, z);
}

export function threeVectorToLatLon(vec: THREE.Vector3): {
  latitudeDeg: number;
  longitudeEastDeg: number;
} {
  const n = vec.clone().normalize();
  const latitudeDeg = THREE.MathUtils.radToDeg(
    Math.asin(THREE.MathUtils.clamp(n.y, -1, 1)),
  );
  const longitudeEastDeg = THREE.MathUtils.radToDeg(Math.atan2(n.x, n.z));
  return { latitudeDeg, longitudeEastDeg };
}

/** Scientific MOON_ME axes: +Z north, +X longitude 0°, +Y longitude 90° east. */
export function latLonToMoonMeKm(
  latitudeDeg: number,
  longitudeEastDeg: number,
  elevationM = 0,
): [number, number, number] {
  const r = LUNAR_RADIUS_KM + elevationM / 1000;
  const lat = THREE.MathUtils.degToRad(latitudeDeg);
  const lon = THREE.MathUtils.degToRad(longitudeEastDeg);
  return [
    r * Math.cos(lat) * Math.cos(lon),
    r * Math.cos(lat) * Math.sin(lon),
    r * Math.sin(lat),
  ];
}
