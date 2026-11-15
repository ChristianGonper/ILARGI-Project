import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { EducationCycleFrame } from "../types";

interface ThreeBodyOrbitMiniProps {
  frames: EducationCycleFrame[];
  currentFrame: EducationCycleFrame | null;
}

type OrbitViewMode = "heliocentric" | "earth_moon_1to1";

const OBLIQUITY_RAD = THREE.MathUtils.degToRad(23.439291);
const COS_OBL = Math.cos(OBLIQUITY_RAD);
const SIN_OBL = Math.sin(OBLIQUITY_RAD);

function j2000ToEclipticThree(v: [number, number, number]): THREE.Vector3 {
  // x' = x
  // y_ecl = y*cos + z*sin
  // z_ecl = -y*sin + z*cos

  const x = v[0];
  const yEcl = v[1] * COS_OBL + v[2] * SIN_OBL;
  const zEcl = -v[1] * SIN_OBL + v[2] * COS_OBL;
  return new THREE.Vector3(x, zEcl, -yEcl);
}

const HELIO_SCALE = 1 / 12_000_000; // 150M km ≈ 12.5 unidades
const MOON_EXAGGERATION = 42;
const REAL_SCALE_EARTH_MOON = 1 / 50_000; // 384,400 km ≈ 7.69 unidades (1:1 real!)

export type LunarPhaseKey =
  "new_moon" | "first_quarter" | "full_moon" | "last_quarter";

export const LUNAR_PHASES: {
  key: LunarPhaseKey;
  label: string;
}[] = [
  { key: "new_moon", label: "New Moon" },
  { key: "first_quarter", label: "First Quarter" },
  { key: "full_moon", label: "Full Moon" },
  { key: "last_quarter", label: "Last Quarter" },
];

export function detectLunarPhase(
  frames: EducationCycleFrame[],
  hoursOffset: number,
  currentFrame: EducationCycleFrame | null,
): LunarPhaseKey {
  const frac = currentFrame?.illumination_fraction ?? 0;
  if (frac < 0.15) return "new_moon";
  if (frac > 0.85) return "full_moon";

  if (frames.length >= 2) {
    let idx = frames.findIndex((f) => f.hours_from_start >= hoursOffset);
    if (idx === -1) idx = frames.length - 1;
    const prevIdx = Math.max(0, idx - 1);
    const nextIdx = Math.min(frames.length - 1, idx + 1);
    const delta =
      frames[nextIdx].illumination_fraction -
      frames[prevIdx].illumination_fraction;
    return delta >= 0 ? "first_quarter" : "last_quarter";
  }

  return "first_quarter";
}

export function findPhaseFrameHours(
  frames: EducationCycleFrame[],
  phase: LunarPhaseKey,
): number {
  if (frames.length === 0) return 0;

  if (phase === "new_moon") {
    let best = frames[0];
    for (const f of frames) {
      if (f.illumination_fraction < best.illumination_fraction) best = f;
    }
    return best.hours_from_start;
  }

  if (phase === "full_moon") {
    let best = frames[0];
    for (const f of frames) {
      if (f.illumination_fraction > best.illumination_fraction) best = f;
    }
    return best.hours_from_start;
  }

  const wantWaxing = phase === "first_quarter";
  let bestFrame = frames[0];
  let bestScore = Infinity;

  for (let i = 0; i < frames.length; i++) {
    const prev = frames[Math.max(0, i - 1)];
    const next = frames[Math.min(frames.length - 1, i + 1)];
    const delta = next.illumination_fraction - prev.illumination_fraction;
    const isWaxing = delta >= 0;
    if (isWaxing !== wantWaxing) continue;
    const dist = Math.abs(frames[i].illumination_fraction - 0.5);
    if (dist < bestScore) {
      bestScore = dist;
      bestFrame = frames[i];
    }
  }

  return bestFrame.hours_from_start;
}

export function phaseLabelFromKey(key: LunarPhaseKey): string {
  return LUNAR_PHASES.find((p) => p.key === key)?.label ?? "New Moon";
}

export function ThreeBodyOrbitMini({
  frames,
  currentFrame,
}: ThreeBodyOrbitMiniProps) {
  const [expanded, setExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<OrbitViewMode>("heliocentric");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const sceneRefs = useRef<{
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    sunMesh: THREE.Mesh;
    sunHalo: THREE.Mesh;
    earthMesh: THREE.Mesh;
    earthGroup: THREE.Group;
    moonMesh: THREE.Mesh;
    moonLocator: THREE.Mesh;
    earthOrbitLine: THREE.Line;
    moonOrbitLine: THREE.Line;
    sunDirArrow: THREE.ArrowHelper;
    sunLight: THREE.PointLight;
    dirSunLight: THREE.DirectionalLight;
  } | null>(null);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#060a12");

    const width = container.clientWidth || 440;
    const height = container.clientHeight || 380;
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.05, 200);
    camera.position.set(11.5, 6.2, 13.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.2;
    controls.maxDistance = 55;

    // Estrellas discretas
    const stars = new Float32Array(300 * 3);
    for (let i = 0; i < 300; i++) {
      const r = 35 + Math.random() * 25;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      stars[i * 3] = r * Math.sin(ph) * Math.cos(th);
      stars[i * 3 + 1] = r * Math.cos(ph);
      stars[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(stars, 3));
    scene.add(
      new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({
          color: 0x94a3b8,
          size: 0.12,
          transparent: true,
          opacity: 0.55,
        }),
      ),
    );

    scene.add(new THREE.AmbientLight(0xdbeafe, 0.35));
    const sunLight = new THREE.PointLight(0xfffbeb, 2.4, 80, 0.1);
    scene.add(sunLight);
    const dirSunLight = new THREE.DirectionalLight(0xfffbeb, 1.8);
    dirSunLight.visible = false;
    scene.add(dirSunLight);

    // Sun
    const sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 28, 28),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
    );
    scene.add(sunMesh);

    const sunHalo = new THREE.Mesh(
      new THREE.SphereGeometry(0.92, 28, 28),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.22,
      }),
    );
    scene.add(sunHalo);

    // Earth and local Earth–Moon group
    const earthGroup = new THREE.Group();
    scene.add(earthGroup);

    const earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 28, 28),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x075985,
        emissiveIntensity: 0.35,
        roughness: 0.65,
      }),
    );
    earthGroup.add(earthMesh);

    // Moon
    const moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 24, 24),
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.9,
      }),
    );
    earthGroup.add(moonMesh);

    const moonLocator = new THREE.Mesh(
      new THREE.RingGeometry(0.14, 0.18, 24),
      new THREE.MeshBasicMaterial({
        color: 0xcbd5e1,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      }),
    );
    moonLocator.rotation.x = Math.PI / 2;
    earthGroup.add(moonLocator);

    const earthOrbitLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.5,
      }),
    );
    scene.add(earthOrbitLine);

    const moonOrbitLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0xcbd5e1,
        transparent: true,
        opacity: 0.85,
      }),
    );
    earthGroup.add(moonOrbitLine);

    const sunDirArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0),
      4.5,
      0xfbbf24,
      0.55,
      0.3,
    );
    sunDirArrow.visible = false;
    scene.add(sunDirArrow);

    sceneRefs.current = {
      camera,
      controls,
      sunMesh,
      sunHalo,
      earthMesh,
      earthGroup,
      moonMesh,
      moonLocator,
      earthOrbitLine,
      moonOrbitLine,
      sunDirArrow,
      sunLight,
      dirSunLight,
    };

    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    let rafId = 0;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      sceneRefs.current = null;
    };
  }, []);

  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs || frames.length === 0) return;

    if (viewMode === "heliocentric") {
      refs.sunMesh.visible = true;
      refs.sunHalo.visible = true;
      refs.earthOrbitLine.visible = true;
      refs.sunDirArrow.visible = false;
      refs.sunLight.visible = true;
      refs.dirSunLight.visible = false;
      refs.moonLocator.visible = false;

      refs.earthMesh.scale.setScalar(1);
      refs.moonMesh.scale.setScalar(1);

      const earthPts = frames.map((f) =>
        j2000ToEclipticThree(f.sun_earth_km).multiplyScalar(HELIO_SCALE),
      );
      refs.earthOrbitLine.geometry.dispose();
      refs.earthOrbitLine.geometry = new THREE.BufferGeometry().setFromPoints(
        earthPts,
      );

      const moonPts = frames.map((f) =>
        j2000ToEclipticThree(f.earth_moon_km).multiplyScalar(
          HELIO_SCALE * MOON_EXAGGERATION,
        ),
      );
      refs.moonOrbitLine.geometry.dispose();
      refs.moonOrbitLine.geometry = new THREE.BufferGeometry().setFromPoints(
        moonPts,
      );

      // Center the view between Sun and Earth
      const midEarth = earthPts[Math.floor(earthPts.length / 2)];
      refs.controls.target.copy(midEarth.clone().multiplyScalar(0.55));
      refs.camera.position.set(
        midEarth.x * 0.7 + 4.5,
        8.5,
        midEarth.z * 0.7 + 13.5,
      );
      refs.controls.update();
    } else {
      // Physical Earth–Moon scale
      refs.sunMesh.visible = false;
      refs.sunHalo.visible = false;
      refs.earthOrbitLine.visible = false;
      refs.sunDirArrow.visible = true;
      refs.sunLight.visible = false;
      refs.dirSunLight.visible = true;
      refs.moonLocator.visible = true;

      // Radios proporcionales 1:1 (R_Earth=6371 km -> 0.127 u, R_Moon=1737.4 km -> 0.035 u)
      const rEarthScaled = (6371 * REAL_SCALE_EARTH_MOON) / 0.28;
      const rMoonScaled = (1737.4 * REAL_SCALE_EARTH_MOON) / 0.11;
      refs.earthMesh.scale.setScalar(rEarthScaled);
      refs.moonMesh.scale.setScalar(rMoonScaled);

      const moonPts = frames.map((f) =>
        j2000ToEclipticThree(f.earth_moon_km).multiplyScalar(
          REAL_SCALE_EARTH_MOON,
        ),
      );
      refs.moonOrbitLine.geometry.dispose();
      refs.moonOrbitLine.geometry = new THREE.BufferGeometry().setFromPoints(
        moonPts,
      );

      refs.controls.target.set(0, 0, 0);
      refs.camera.position.set(0, 8.2, 10.5);
      refs.controls.update();
    }
  }, [frames, viewMode]);

  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs || !currentFrame) return;

    if (viewMode === "heliocentric") {
      const earthPos = j2000ToEclipticThree(
        currentFrame.sun_earth_km,
      ).multiplyScalar(HELIO_SCALE);
      const moonRel = j2000ToEclipticThree(
        currentFrame.earth_moon_km,
      ).multiplyScalar(HELIO_SCALE * MOON_EXAGGERATION);
      refs.earthGroup.position.copy(earthPos);
      refs.moonMesh.position.copy(moonRel);
      refs.moonLocator.position.copy(moonRel);
    } else {
      refs.earthGroup.position.set(0, 0, 0);
      const moonRel = j2000ToEclipticThree(
        currentFrame.earth_moon_km,
      ).multiplyScalar(REAL_SCALE_EARTH_MOON);
      refs.moonMesh.position.copy(moonRel);
      refs.moonLocator.position.copy(moonRel);

      const toSunDir = j2000ToEclipticThree(currentFrame.sun_earth_km)
        .multiplyScalar(-1)
        .normalize();
      refs.sunDirArrow.setDirection(toSunDir);
      refs.dirSunLight.position.copy(toSunDir.clone().multiplyScalar(25));
    }
  }, [currentFrame, viewMode]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    window.dispatchEvent(new Event("resize"));
  }, [expanded]);

  const dEM = currentFrame
    ? Math.round(currentFrame.earth_moon_dist_km).toLocaleString("en-GB")
    : "—";
  const dSM = currentFrame
    ? Math.round(currentFrame.sun_moon_dist_km).toLocaleString("en-GB")
    : "—";

  return (
    <div
      className={`orbit-mini-shell ${expanded ? "orbit-mini-expanded" : "orbit-mini-docked"}`}
    >
      <div className="orbit-mini-head">
        <div>
          <h2 className="edu-panel-title">Sun, Earth &amp; Moon Orbits</h2>
          <div className="orbit-mini-sub">
            {viewMode === "heliocentric"
              ? "Three-body orbital view · Moon orbit enlarged so you can follow it easily"
              : "Earth and Moon shown to real physical scale"}
          </div>
        </div>
        <div className="orbit-mini-actions">
          <button
            type="button"
            className={`btn-mini ${viewMode === "heliocentric" ? "active" : ""}`}
            onClick={() => setViewMode("heliocentric")}
          >
            3 Bodies
          </button>
          <button
            type="button"
            className={`btn-mini ${viewMode === "earth_moon_1to1" ? "active" : ""}`}
            onClick={() => setViewMode("earth_moon_1to1")}
          >
            Earth &amp; Moon to scale
          </button>
          <button
            type="button"
            className="btn-mini orbit-expand-btn"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? "Collapse view" : "Expand simulation"}
          >
            {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>

      <div ref={containerRef} className="orbit-canvas-container" />

      <div className="orbit-telemetry-bar">
        <span className="mono">
          <strong className="tag-earth">Moon–Earth:</strong> {dEM} km
        </span>
        <span className="mono">
          <strong className="tag-sun">Moon–Sun:</strong> {dSM} km
        </span>
      </div>
    </div>
  );
}
