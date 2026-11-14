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

// Oblicuidad de la eclíptica J2000 (~23.4393°) para alinear la eclíptica al plano horizontal XZ.
const OBLIQUITY_RAD = THREE.MathUtils.degToRad(23.439291);
const COS_OBL = Math.cos(OBLIQUITY_RAD);
const SIN_OBL = Math.sin(OBLIQUITY_RAD);

function j2000ToEclipticThree(v: [number, number, number]): THREE.Vector3 {
  // Rotación -obliquity alrededor de X:
  // x' = x
  // y_ecl = y*cos + z*sin
  // z_ecl = -y*sin + z*cos
  // En Three.js: +X = x', +Y = z_ecl (Norte eclíptico), +Z = -y_ecl
  const x = v[0];
  const yEcl = v[1] * COS_OBL + v[2] * SIN_OBL;
  const zEcl = -v[1] * SIN_OBL + v[2] * COS_OBL;
  return new THREE.Vector3(x, zEcl, -yEcl);
}

const HELIO_SCALE = 1 / 12_000_000; // 150M km ≈ 12.5 unidades
const MOON_EXAGGERATION = 42; // Visibilidad clara de la órbita lunar alrededor de la Tierra
const REAL_SCALE_EARTH_MOON = 1 / 50_000; // 384,400 km ≈ 7.69 unidades (1:1 real!)

export function phaseLabelFromFraction(frac: number): string {
  if (frac < 0.06) return "Luna Nueva";
  if (frac < 0.44) return "Creciente";
  if (frac < 0.56) return "Cuarto";
  if (frac < 0.94) return "Gibosa / Llena";
  return "Luna Llena";
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

  // Cerrar vista ampliada con Escape
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
    const height = container.clientHeight || 300;
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

    // Rejilla eclíptica tenue
    const grid = new THREE.GridHelper(32, 24, 0x1e293b, 0x0f172a);
    grid.position.y = -0.02;
    scene.add(grid);

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

    // Sol
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

    // Tierra + grupo local Tierra-Luna
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

    // Luna
    const moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 24, 24),
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.9,
      }),
    );
    earthGroup.add(moonMesh);

    // Anillo marcador para modo 1:1 real (donde el radio real de la Luna es ~0.035 u.)
    const moonLocator = new THREE.Mesh(
      new THREE.RingGeometry(0.14, 0.18, 24),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      }),
    );
    moonLocator.rotation.x = Math.PI / 2;
    earthGroup.add(moonLocator);

    // Órbita de la Tierra alrededor del Sol
    const earthOrbitLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.5,
      }),
    );
    scene.add(earthOrbitLine);

    // Órbita de la Luna alrededor de la Tierra
    const moonOrbitLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.85,
      }),
    );
    earthGroup.add(moonOrbitLine);

    // Flecha de dirección solar para el modo 1:1 Tierra-Luna
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

  // Reconstruir curvas orbitales SPICE cuando llegan frames o cambia viewMode.
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

      // Enfocar vista entre Sol y Tierra
      const midEarth = earthPts[Math.floor(earthPts.length / 2)];
      refs.controls.target.copy(midEarth.clone().multiplyScalar(0.55));
      refs.camera.position.set(
        midEarth.x * 0.7 + 4.5,
        8.5,
        midEarth.z * 0.7 + 13.5,
      );
      refs.controls.update();
    } else {
      // Escala real 1:1 Tierra-Luna
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

  // Actualizar posiciones instantáneas al mover el slider o reproducir la película.
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

  // Reajustar tamaño del canvas al expandir/contraer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    window.dispatchEvent(new Event("resize"));
  }, [expanded]);

  const dSE = currentFrame
    ? Math.round(currentFrame.sun_earth_dist_km).toLocaleString("es-ES")
    : "—";
  const dEM = currentFrame
    ? Math.round(currentFrame.earth_moon_dist_km).toLocaleString("es-ES")
    : "—";
  const dSM = currentFrame
    ? Math.round(currentFrame.sun_moon_dist_km).toLocaleString("es-ES")
    : "—";
  const phasePct = currentFrame
    ? Math.round(currentFrame.illumination_fraction * 100)
    : 0;

  return (
    <div
      className={`orbit-mini-shell ${expanded ? "orbit-mini-expanded" : "orbit-mini-docked"}`}
    >
      <div className="orbit-mini-head">
        <div>
          <div className="eyebrow eyebrow-accent">
            ÓRBITAS 3 CUERPOS · SOL · TIERRA · LUNA
          </div>
          <div className="orbit-mini-sub">
            {viewMode === "heliocentric"
              ? "Vectores DE440s en eclíptica · Órbita lunar ampliada para visibilidad"
              : "Escala proporcional real 1:1 (Tierra 6.371 km · Luna 1.737 km)"}
          </div>
        </div>
        <div className="orbit-mini-actions">
          <button
            type="button"
            className={`btn-mini ${viewMode === "heliocentric" ? "active" : ""}`}
            onClick={() => setViewMode("heliocentric")}
          >
            3 Cuerpos
          </button>
          <button
            type="button"
            className={`btn-mini ${viewMode === "earth_moon_1to1" ? "active" : ""}`}
            onClick={() => setViewMode("earth_moon_1to1")}
          >
            Tierra–Luna 1:1
          </button>
          <button
            type="button"
            className="btn-mini orbit-expand-btn"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? "Reducir a miniventana" : "Ampliar simulación"}
          >
            {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            {expanded ? "Reducir" : "Ampliar"}
          </button>
        </div>
      </div>

      <div ref={containerRef} className="orbit-canvas-container" />

      <div className="orbit-telemetry-bar">
        <span className="mono">
          <strong className="tag-sun">Sol–Tierra:</strong> {dSE} km
        </span>
        <span className="mono">
          <strong className="tag-earth">Tierra–Luna:</strong> {dEM} km
        </span>
        <span className="mono">
          <strong className="tag-ok">Sol–Luna:</strong> {dSM} km
        </span>
        <span className="pill pill-muted">
          Fase: {phasePct}% (
          {phaseLabelFromFraction(currentFrame?.illumination_fraction ?? 0)})
        </span>
      </div>
    </div>
  );
}
