import * as THREE from "three";

/** Radio lunar de referencia en MOON_ME (metros y kilómetros). */
export const LUNAR_RADIUS_M = 1_737_400;
export const LUNAR_RADIUS_KM = 1_737.4;

/**
 * Convierte latitud planetocéntrica (°) y longitud este (°) al sistema cartesiano
 * de Three.js con el Polo Norte en +Y, el meridiano 0° (cara visible) en +Z
 * y 90° E en +X.
 */
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

/**
 * Convierte un punto sobre la esfera unitaria de Three.js a latitud y longitud este (°).
 */
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

/**
 * Coordenadas cartesianas estándar MOON_ME (km) con +Z hacia el Polo Norte y +X en 0° E.
 * Útil para interoperar con CesiumJS / SPICE.
 */
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
