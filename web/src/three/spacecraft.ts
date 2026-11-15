import * as THREE from "three";
/** Original schematic educational lander, not a flight-qualified CAD model. */
export function makeLander() {
  const group = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({
    color: 0xd9a64a,
    metalness: 0.7,
    roughness: 0.4,
  });
  const silver = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.65,
    roughness: 0.35,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x173d68,
    metalness: 0.4,
    roughness: 0.5,
  });
  const add = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  add(new THREE.CylinderGeometry(0.42, 0.5, 0.7, 8), gold, 0, 0.1, 0);
  add(new THREE.BoxGeometry(0.5, 0.16, 0.5), silver, 0, 0.53, 0);
  add(new THREE.CylinderGeometry(0.1, 0.2, 0.25, 16), silver, 0, -0.38, 0);
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const a = new THREE.Vector3(
      Math.cos(angle) * 0.35,
      -0.1,
      Math.sin(angle) * 0.35,
    );
    const b = new THREE.Vector3(
      Math.cos(angle) * 0.8,
      -0.7,
      Math.sin(angle) * 0.8,
    );
    const leg = add(
      new THREE.CylinderGeometry(0.025, 0.025, a.distanceTo(b), 8),
      silver,
      0,
      0,
      0,
    );
    leg.position.copy(a.clone().add(b).multiplyScalar(0.5));
    leg.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      b.clone().sub(a).normalize(),
    );
    add(new THREE.CylinderGeometry(0.14, 0.16, 0.04, 16), gold, b.x, b.y, b.z);
  }
  for (const side of [-1, 1]) {
    add(new THREE.BoxGeometry(0.65, 0.035, 0.65), dark, side * 0.85, 0.2, 0);
    for (let n = 0; n < 4; n++)
      add(
        new THREE.BoxGeometry(0.012, 0.04, 0.65),
        silver,
        side * 0.85 - 0.25 + n * 0.16,
        0.2,
        0,
      );
  }
  add(new THREE.CylinderGeometry(0.018, 0.018, 0.45, 8), silver, 0, 0.8, 0);
  add(
    new THREE.SphereGeometry(0.16, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    silver,
    0,
    1,
    0,
  );
  return group;
}
