import * as THREE from "three";
import { latLonToThreeVector, LUNAR_RADIUS_M } from "./moonCoordinates";

/** Global LOLA visualization grid: 8 samples/degree, signed half metres. */
export class LunarHeightField {
  constructor(
    readonly values: Int16Array,
    readonly width = 2880,
    readonly height = 1440,
  ) {
    if (values.length !== width * height)
      throw new Error("Tamaño incorrecto del DEM lunar");
  }

  elevation(latitude: number, longitude: number): number {
    // Pixel-center registration; longitude wraps, latitude clamps at the poles.
    const x =
      (((longitude + 180) / 360) * this.width - 0.5 + this.width) % this.width;
    const y = THREE.MathUtils.clamp(
      ((90 - latitude) / 180) * this.height - 0.5,
      0,
      this.height - 1,
    );
    const x0 = Math.floor(x),
      y0 = Math.floor(y);
    const x1 = (x0 + 1) % this.width,
      y1 = Math.min(y0 + 1, this.height - 1);
    const tx = x - x0,
      ty = y - y0;
    const top = THREE.MathUtils.lerp(
      this.values[y0 * this.width + x0],
      this.values[y0 * this.width + x1],
      tx,
    );
    const bottom = THREE.MathUtils.lerp(
      this.values[y1 * this.width + x0],
      this.values[y1 * this.width + x1],
      tx,
    );
    return THREE.MathUtils.lerp(top, bottom, ty) * 0.5;
  }

  radius(latitude: number, longitude: number): number {
    return 1 + this.elevation(latitude, longitude) / LUNAR_RADIUS_M;
  }
}

export async function loadLunarHeightField(
  signal: AbortSignal,
): Promise<LunarHeightField> {
  const response = await fetch("/textures/moon_height.bin.gz", { signal });
  if (!response.ok || !response.body)
    throw new Error("No se pudo cargar el relieve LOLA");
  const buffer = await new Response(
    response.body.pipeThrough(new DecompressionStream("gzip")),
  ).arrayBuffer();
  // Explicit little endian decoding, independent of the host platform.
  const view = new DataView(buffer);
  const values = new Int16Array(buffer.byteLength / 2);
  for (let i = 0; i < values.length; i++)
    values[i] = view.getInt16(i * 2, true);
  return new LunarHeightField(values);
}

interface Tile {
  south: number;
  west: number;
  span: number;
  level: number;
}
const SEGMENTS = 24;

export function terrainGeometry(
  field: LunarHeightField,
  tile: Tile,
): THREE.BufferGeometry {
  const positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const normals: number[] = [];
  const step = tile.span / SEGMENTS;
  for (let row = 0; row <= SEGMENTS; row++) {
    const lat = tile.south + tile.span - row * step;
    for (let col = 0; col <= SEGMENTS; col++) {
      const lon = tile.west + col * step;
      const position = latLonToThreeVector(lat, lon, field.radius(lat, lon));
      positions.push(position.x, position.y, position.z);
      uvs.push((lon + 180) / 360, (lat + 90) / 180);
      // Same derivative spacing on every tile avoids lighting seams across LODs.
      const delta = 180 / field.height;
      const east = latLonToThreeVector(
        lat,
        lon + delta,
        field.radius(lat, lon + delta),
      ).sub(
        latLonToThreeVector(lat, lon - delta, field.radius(lat, lon - delta)),
      );
      const north = latLonToThreeVector(
        Math.min(90, lat + delta),
        lon,
        field.radius(Math.min(90, lat + delta), lon),
      ).sub(
        latLonToThreeVector(
          Math.max(-90, lat - delta),
          lon,
          field.radius(Math.max(-90, lat - delta), lon),
        ),
      );
      const normal =
        Math.abs(lat) > 89.999
          ? position.clone().normalize()
          : east.cross(north).normalize();
      normals.push(normal.x, normal.y, normal.z);
      if (row < SEGMENTS && col < SEGMENTS) {
        const a = row * (SEGMENTS + 1) + col,
          b = a + 1,
          c = a + SEGMENTS + 1,
          d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  }
  // Inward skirts cover cracks between different subdivision levels.
  const edges = [
    Array.from({ length: SEGMENTS + 1 }, (_, i) => i),
    Array.from(
      { length: SEGMENTS + 1 },
      (_, i) => i * (SEGMENTS + 1) + SEGMENTS,
    ),
    Array.from(
      { length: SEGMENTS + 1 },
      (_, i) => SEGMENTS * (SEGMENTS + 1) + SEGMENTS - i,
    ),
    Array.from(
      { length: SEGMENTS + 1 },
      (_, i) => (SEGMENTS - i) * (SEGMENTS + 1),
    ),
  ];
  for (const edge of edges) {
    const start = positions.length / 3;
    for (const index of edge) {
      const point = new THREE.Vector3().fromArray(positions, index * 3);
      point.setLength(point.length() - 0.003);
      positions.push(point.x, point.y, point.z);
      normals.push(...normals.slice(index * 3, index * 3 + 3));
      uvs.push(uvs[index * 2], uvs[index * 2 + 1]);
    }
    for (let i = 0; i < SEGMENTS; i++)
      indices.push(
        edge[i],
        start + i,
        edge[i + 1],
        edge[i + 1],
        start + i,
        start + i + 1,
      );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

/** Adaptive tiles share a material/texture and replace the original globe. */
export class LunarTerrain extends THREE.Group {
  private tiles = new Map<string, THREE.Mesh>();
  private previousCamera = new THREE.Vector3(Infinity, Infinity, Infinity);
  constructor(
    readonly field: LunarHeightField,
    private material: THREE.Material,
    private overlay?: THREE.Material,
  ) {
    super();
  }

  update(camera: THREE.Vector3): void {
    if (
      camera.distanceTo(this.previousCamera) <
      Math.max(0.0005, (camera.length() - 1) * 0.03)
    )
      return;
    this.previousCamera.copy(camera);
    const required = new Map<string, Tile>();
    const visit = (tile: Tile) => {
      const center = latLonToThreeVector(
        tile.south + tile.span / 2,
        tile.west + tile.span / 2,
      );
      const distance = Math.max(0.001, camera.distanceTo(center));
      if (
        tile.level < 5 &&
        THREE.MathUtils.degToRad(tile.span) / distance > 0.65
      ) {
        const span = tile.span / 2;
        for (let y = 0; y < 2; y++)
          for (let x = 0; x < 2; x++)
            visit({
              south: tile.south + y * span,
              west: tile.west + x * span,
              span,
              level: tile.level + 1,
            });
      } else required.set(`${tile.south}/${tile.west}/${tile.span}`, tile);
    };
    for (let lat = -90; lat < 90; lat += 90)
      for (let lon = -180; lon < 180; lon += 90)
        visit({ south: lat, west: lon, span: 90, level: 0 });
    for (const [key, tile] of required) {
      if (this.tiles.has(key)) continue;
      const mesh = new THREE.Mesh(
        terrainGeometry(this.field, tile),
        this.material,
      );
      if (this.overlay) {
        const overlay = new THREE.Mesh(mesh.geometry, this.overlay);
        overlay.scale.setScalar(1.00002);
        overlay.raycast = () => {};
        mesh.add(overlay);
      }
      this.tiles.set(key, mesh);
      this.add(mesh);
    }
    for (const [key, mesh] of this.tiles) {
      if (required.has(key)) continue;
      mesh.geometry.dispose();
      this.remove(mesh);
      this.tiles.delete(key);
    }
  }

  dispose(): void {
    for (const mesh of this.tiles.values()) mesh.geometry.dispose();
    this.tiles.clear();
    this.clear();
  }
}
