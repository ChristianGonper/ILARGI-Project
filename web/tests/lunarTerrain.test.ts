import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import test from "node:test";
import * as THREE from "three";
import {
  LunarHeightField,
  LunarTerrain,
  terrainGeometry,
} from "../src/three/lunarTerrain";

test("height sampling uses half metres, pixel centers and longitude wrapping", () => {
  const field = new LunarHeightField(
    new Int16Array([0, 200, 400, 600, -200, 0, 200, 400]),
    4,
    2,
  );
  assert.equal(field.elevation(45, -135), 0);
  assert.equal(field.elevation(-45, -135), -100);
  assert.equal(field.elevation(0, -90), 0);
  assert.equal(field.elevation(20, -180), field.elevation(20, 180));
  assert.equal(field.elevation(20, 0), field.elevation(20, 360));
});

test("actual packaged LOLA grid has valid units, shape and checksum", () => {
  const directory = new URL("../public/textures/", import.meta.url);
  const metadata = JSON.parse(
    readFileSync(new URL("moon_height.json", directory), "utf8"),
  );
  const payload = readFileSync(new URL("moon_height.bin.gz", directory));
  assert.equal(
    createHash("sha256").update(payload).digest("hex"),
    metadata.payload_sha256,
  );
  const buffer = gunzipSync(payload);
  const field = new LunarHeightField(
    new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length / 2),
  );
  const elevations = [
    field.elevation(0, 0),
    field.elevation(-89.5, 0),
    field.elevation(27, -5),
    field.elevation(-20, 160),
  ];
  assert.ok(
    elevations.every(
      (value) => Number.isFinite(value) && value > -11000 && value < 12000,
    ),
  );
  assert.ok(new Set(elevations).size > 1);
});

test("mesh geometry has physical displacement, correct UVs and outward faces", () => {
  const field = new LunarHeightField(new Int16Array(8).fill(2000), 4, 2);
  const geometry = terrainGeometry(field, {
    south: -45,
    west: -45,
    span: 90,
    level: 0,
  });
  const index = 12 * 25 + 12;
  const position = new THREE.Vector3().fromBufferAttribute(
    geometry.attributes.position,
    index,
  );
  assert.ok(Math.abs(position.length() - (1 + 1000 / 1737400)) < 1e-7);
  assert.equal(geometry.attributes.uv.getX(index), 0.5);
  assert.equal(geometry.attributes.uv.getY(index), 0.5);
  assert.ok(
    new THREE.Vector3()
      .fromBufferAttribute(geometry.attributes.normal, index)
      .dot(position) > 0,
  );
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.updateMatrixWorld();
  const hits = new THREE.Raycaster(
    new THREE.Vector3(0, 0, 2),
    new THREE.Vector3(0, 0, -1),
  ).intersectObject(mesh);
  assert.ok(
    hits.length > 0,
    "surface picking must hit the visible terrain face",
  );
  assert.ok(Math.abs(hits[0].point.z - position.z) < 1e-6);
  geometry.dispose();
  mesh.material.dispose();
});

test("zoom automatically refines the same globe and releases replaced tiles", () => {
  const field = new LunarHeightField(new Int16Array(8), 4, 2);
  const material = new THREE.MeshBasicMaterial();
  const globe = new LunarTerrain(field, material);
  globe.update(new THREE.Vector3(0, 0, 5));
  const farCount = globe.children.length;
  globe.update(new THREE.Vector3(0, 0, 1.02));
  assert.ok(globe.children.length > farCount);
  const nearCount = globe.children.length;
  globe.update(new THREE.Vector3(0, 0, 1.02));
  assert.equal(globe.children.length, nearCount);
  globe.update(new THREE.Vector3(0, 0, 5));
  assert.equal(globe.children.length, farCount);
  globe.dispose();
  assert.equal(globe.children.length, 0);
  material.dispose();
});
