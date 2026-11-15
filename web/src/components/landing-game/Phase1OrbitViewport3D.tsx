import { makeLander } from "../../three/spacecraft";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  latLonToThreeVector,
  threeVectorToLatLon,
} from "../../three/moonCoordinates";
import { orbitPointLatLon, type GameLandingSite } from "./gamePhysics";

interface Phase1OrbitViewport3DProps {
  sites: GameLandingSite[];
  selectedSite: GameLandingSite;
  currentInclinationDeg: number;
  targetNodeDeg: number;
  groundTrackAligned: boolean;
  pinMode: boolean;
  onSelectSite: (site: GameLandingSite) => void;
  onCustomSurfacePick: (latDeg: number, lonDeg: number) => void;
}

function makeSurfaceCoordSprite(
  title: string,
  latDeg: number,
  lonDeg: number,
  accentHex: string,
): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 420;
  canvas.height = 112;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "rgba(11, 16, 27, 0.92)";
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(8, 8, 404, 96, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#F1F5F9";
  ctx.font = "bold 22px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(title.slice(0, 28), 210, 36);

  ctx.fillStyle = accentHex;
  ctx.font = "bold 23px 'JetBrains Mono', monospace";
  ctx.fillText(
    `LAT ${latDeg.toFixed(2)}°  ·  LON ${lonDeg.toFixed(2)}°E`,
    210,
    74,
  );

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.48, 0.13, 1);
  return sprite;
}

export function Phase1OrbitViewport3D({
  sites,
  selectedSite,
  currentInclinationDeg,
  targetNodeDeg,
  groundTrackAligned,
  pinMode,
  onSelectSite,
  onCustomSurfacePick,
}: Phase1OrbitViewport3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [cameraPreset, setCameraPreset] = useState<
    "target" | "global" | "south"
  >("global");

  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const moonMeshRef = useRef<THREE.Mesh | null>(null);
  const sitesGroupRef = useRef<THREE.Group | null>(null);
  const focusGroupRef = useRef<THREE.Group | null>(null);
  const orbitLineRef = useRef<THREE.Line | null>(null);
  const groundTrackLineRef = useRef<THREE.Line | null>(null);
  const spacecraftRef = useRef<THREE.Group | null>(null);

  const orbitParamsRef = useRef({
    inc: currentInclinationDeg,
    node: targetNodeDeg,
    aligned: groundTrackAligned,
  });
  orbitParamsRef.current = {
    inc: currentInclinationDeg,
    node: targetNodeDeg,
    aligned: groundTrackAligned,
  };

  const callbacksRef = useRef({
    pinMode,
    onSelectSite,
    onCustomSurfacePick,
  });
  callbacksRef.current = {
    pinMode,
    onSelectSite,
    onCustomSurfacePick,
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#070b14");

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 440;
    const camera = new THREE.PerspectiveCamera(39, width / height, 0.1, 100);
    camera.position.set(0.5, 0.7, 4.2);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 1.55;
    controls.maxDistance = 5.6;
    controls.enablePan = false;
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xcbd5e1, 0.55));
    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.9);
    sunLight.position.set(4, 2, 3.5);
    scene.add(sunLight);

    // Estrellas
    const starPos = new Float32Array(400 * 3);
    for (let i = 0; i < 400; i++) {
      const r = 14 + Math.random() * 14;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      starPos[i * 3 + 1] = r * Math.cos(ph);
      starPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    scene.add(
      new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({
          color: 0xcbd5e1,
          size: 0.05,
          transparent: true,
          opacity: 0.6,
        }),
      ),
    );

    // Esfera lunar
    const sphereGeo = new THREE.SphereGeometry(1.0, 96, 72);
    sphereGeo.rotateY(-Math.PI / 2);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0xb8c0cc,
      roughness: 0.94,
      metalness: 0.03,
    });
    const moonMesh = new THREE.Mesh(sphereGeo, sphereMat);
    moonMeshRef.current = moonMesh;
    scene.add(moonMesh);

    const loader = new THREE.TextureLoader();
    let loadedColor: THREE.Texture | null = null;
    let loadedBump: THREE.Texture | null = null;
    loader.load("/textures/moon_color.jpg", (tex) => {
      if (disposed) {
        tex.dispose();
        return;
      }
      tex.wrapS = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      loadedColor = tex;
      sphereMat.map = tex;
      sphereMat.color.setHex(0xffffff);
      sphereMat.needsUpdate = true;
    });
    loader.load("/textures/moon_bump.jpg", (tex) => {
      if (disposed) {
        tex.dispose();
        return;
      }
      tex.wrapS = THREE.RepeatWrapping;
      loadedBump = tex;
      sphereMat.bumpMap = tex;
      sphereMat.bumpScale = 0.03;
      sphereMat.needsUpdate = true;
    });

    const addLatRing = (lat: number, color: number, opacity: number) => {
      const pts: THREE.Vector3[] = [];
      for (let lon = -180; lon <= 180; lon += 4) {
        pts.push(latLonToThreeVector(lat, lon, 1.003));
      }
      scene.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
        ),
      );
    };
    addLatRing(0, 0x94a3b8, 0.45); // Ecuador
    addLatRing(-30, 0x334155, 0.25);
    addLatRing(-60, 0x334155, 0.25);
    addLatRing(30, 0x334155, 0.25);
    addLatRing(60, 0x334155, 0.25);

    for (let lon = 0; lon < 180; lon += 45) {
      const pts: THREE.Vector3[] = [];
      for (let lat = -90; lat <= 90; lat += 4) {
        pts.push(latLonToThreeVector(lat, lon, 1.003));
      }
      for (let lat = 90; lat >= -90; lat -= 4) {
        pts.push(latLonToThreeVector(lat, lon - 180, 1.003));
      }
      scene.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({
            color: 0x334155,
            transparent: true,
            opacity: 0.22,
          }),
        ),
      );
    }

    // Elevated orbit ring and projected surface ground track
    const orbitLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.9,
      }),
    );
    orbitLineRef.current = orbitLine;
    scene.add(orbitLine);

    const groundTrackLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.95,
      }),
    );
    groundTrackLineRef.current = groundTrackLine;
    scene.add(groundTrackLine);

    const spacecraft = makeLander();
    spacecraft.scale.setScalar(0.065);
    spacecraftRef.current = spacecraft;
    scene.add(spacecraft);

    const sitesGroup = new THREE.Group();
    const focusGroup = new THREE.Group();
    sitesGroupRef.current = sitesGroup;
    focusGroupRef.current = focusGroup;
    scene.add(sitesGroup);
    scene.add(focusGroup);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downPos = { x: 0, y: 0 };

    const updatePointer = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (ev: PointerEvent) => {
      downPos = { x: ev.clientX, y: ev.clientY };
    };

    const onPointerUp = (ev: PointerEvent) => {
      const moved = Math.hypot(ev.clientX - downPos.x, ev.clientY - downPos.y);
      if (moved > 5) return;
      updatePointer(ev);
      raycaster.setFromCamera(pointer, camera);

      const hits = raycaster.intersectObjects(sitesGroup.children, true);
      const hitSite = hits.find((h) => h.object.userData?.site);
      if (hitSite) {
        callbacksRef.current.onSelectSite(
          hitSite.object.userData.site as GameLandingSite,
        );
        return;
      }

      if (callbacksRef.current.pinMode || ev.shiftKey) {
        const surfaceHits = raycaster.intersectObject(moonMesh, false);
        if (surfaceHits.length > 0) {
          const { latitudeDeg, longitudeEastDeg } = threeVectorToLatLon(
            surfaceHits[0].point,
          );
          callbacksRef.current.onCustomSurfacePick(
            Number(THREE.MathUtils.clamp(latitudeDeg, -89.5, 89.5).toFixed(2)),
            Number(longitudeEastDeg.toFixed(2)),
          );
        }
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

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
    const clock = new THREE.Clock();
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      const { inc, node } = orbitParamsRef.current;
      const u = t * 0.72; // Illustrative parking-orbit animation speed
      const { latitudeDeg, longitudeEastDeg } = orbitPointLatLon(inc, node, u);
      if (spacecraftRef.current) {
        const pos = latLonToThreeVector(latitudeDeg, longitudeEastDeg, 1.18);
        spacecraftRef.current.position.copy(pos);
        spacecraftRef.current.lookAt(0, 0, 0);
      }

      if (focusGroupRef.current && focusGroupRef.current.children.length > 0) {
        const ring = focusGroupRef.current.children[0];
        if (ring) {
          const s = 1.0 + 0.16 * Math.sin(t * 3.8);
          ring.scale.set(s, s, 1);
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      loadedColor?.dispose();
      loadedBump?.dispose();
      sphereGeo.dispose();
      sphereMat.dispose();
      starGeo.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    const orbitLine = orbitLineRef.current;
    const groundTrackLine = groundTrackLineRef.current;
    if (!orbitLine || !groundTrackLine) return;

    const orbitPts: THREE.Vector3[] = [];
    const trackPts: THREE.Vector3[] = [];
    const steps = 180;
    for (let k = 0; k <= steps; k++) {
      const u = (k / steps) * Math.PI * 2;
      const { latitudeDeg, longitudeEastDeg } = orbitPointLatLon(
        currentInclinationDeg,
        targetNodeDeg,
        u,
      );
      orbitPts.push(latLonToThreeVector(latitudeDeg, longitudeEastDeg, 1.18));
      trackPts.push(latLonToThreeVector(latitudeDeg, longitudeEastDeg, 1.008));
    }

    orbitLine.geometry.dispose();
    orbitLine.geometry = new THREE.BufferGeometry().setFromPoints(orbitPts);

    groundTrackLine.geometry.dispose();
    groundTrackLine.geometry = new THREE.BufferGeometry().setFromPoints(
      trackPts,
    );

    const trackMat = groundTrackLine.material as THREE.LineBasicMaterial;
    const orbitMat = orbitLine.material as THREE.LineBasicMaterial;
    if (groundTrackAligned) {
      trackMat.color.setHex(0x10b981);
      orbitMat.color.setHex(0x10b981);
    } else {
      trackMat.color.setHex(0xf59e0b);
      orbitMat.color.setHex(0x38bdf8);
    }
  }, [currentInclinationDeg, targetNodeDeg, groundTrackAligned]);

  useEffect(() => {
    const group = sitesGroupRef.current;
    if (!group) return;
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }
    const geo = new THREE.SphereGeometry(0.02, 14, 14);
    for (const s of sites) {
      const active = s.id === selectedSite.id;
      const mat = new THREE.MeshBasicMaterial({
        color: active ? 0x10b981 : 0xc4b5fd,
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(
        latLonToThreeVector(s.latitudeDeg, s.longitudeEastDeg, 1.015),
      );
      m.userData = { site: s };
      group.add(m);
    }
  }, [sites, selectedSite]);

  useEffect(() => {
    const group = focusGroupRef.current;
    if (!group) return;
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    const pos = latLonToThreeVector(
      selectedSite.latitudeDeg,
      selectedSite.longitudeEastDeg,
      1.022,
    );
    const normal = pos.clone().normalize();
    const accentHex = groundTrackAligned ? "#C4B5FD" : "#F43F5E";
    const accentNum = groundTrackAligned ? 0xc4b5fd : 0xf43f5e;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.024, 0.036, 32),
      new THREE.MeshBasicMaterial({
        color: accentNum,
        side: THREE.DoubleSide,
      }),
    );
    ring.position.copy(pos);
    ring.lookAt(normal.clone().multiplyScalar(2));
    group.add(ring);

    const sprite = makeSurfaceCoordSprite(
      selectedSite.name.split("·")[0].trim(),
      selectedSite.latitudeDeg,
      selectedSite.longitudeEastDeg,
      accentHex,
    );
    sprite.position.copy(pos.clone().multiplyScalar(1.15));
    group.add(sprite);
  }, [selectedSite, groundTrackAligned]);

  useEffect(() => {
    if (cameraRef.current && controlsRef.current && cameraPreset === "target") {
      const normal = latLonToThreeVector(
        selectedSite.latitudeDeg,
        selectedSite.longitudeEastDeg,
        1,
      ).normalize();
      const camDir = normal
        .add(new THREE.Vector3(0.28, 0.22, 0.28))
        .normalize();
      cameraRef.current.position.copy(camDir.multiplyScalar(3.6));
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [selectedSite, cameraPreset]);

  useEffect(() => {
    if (!groundTrackAligned) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const start = camera.position.clone();
    const end = latLonToThreeVector(
      selectedSite.latitudeDeg,
      selectedSite.longitudeEastDeg,
      1,
    )
      .normalize()
      .add(new THREE.Vector3(0.3, 0.25, 0.3))
      .normalize()
      .multiplyScalar(3.6);
    const began = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / 1200);
      camera.position.lerpVectors(start, end, t * t * (3 - 2 * t));
      controls.update();
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [groundTrackAligned, selectedSite]);
  const moveCamera = (preset: "target" | "global" | "south") => {
    setCameraPreset(preset);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    if (preset === "target") {
      const dir = latLonToThreeVector(
        selectedSite.latitudeDeg,
        selectedSite.longitudeEastDeg,
        1,
      )
        .normalize()
        .add(new THREE.Vector3(0.28, 0.22, 0.28))
        .normalize();
      camera.position.copy(dir.multiplyScalar(3.6));
    } else if (preset === "south") {
      camera.position.set(0.9, -2.15, 1.65);
    } else {
      camera.position.set(0.5, 0.7, 4.2);
    }
    controls.target.set(0, 0, 0);
    controls.update();
  };

  return (
    <div className="moon-viewport-shell game-moon-shell">
      <div className="moon-hud-top">
        <div className="moon-hud-pills">
          <span className="pill pill-cyan">
            Current inclination: {currentInclinationDeg.toFixed(1)}°
          </span>
          <span
            className={`pill ${groundTrackAligned ? "pill-ok" : "pill-amber"}`}
          >
            {groundTrackAligned
              ? "Ground track aligned with target"
              : "Ground track misses the target"}
          </span>
        </div>
        <div className="moon-camera-btns">
          <button
            type="button"
            className={`btn-mini ${cameraPreset === "target" ? "active" : ""}`}
            onClick={() => moveCamera("target")}
          >
            View target
          </button>
          <button
            type="button"
            className={`btn-mini ${cameraPreset === "south" ? "active" : ""}`}
            onClick={() => moveCamera("south")}
          >
            South Pole
          </button>
          <button
            type="button"
            className={`btn-mini ${cameraPreset === "global" ? "active" : ""}`}
            onClick={() => moveCamera("global")}
          >
            Global view
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="moon-canvas-container game-moon-canvas"
      />

      <div className="moon-hud-bottom edu-legend-bar">
        <div className="edu-legend-items">
          <span className="legend-dot-item">
            <i style={{ background: "#38BDF8" }} /> Lander orbit
          </span>
          <span className="legend-dot-item">
            <i
              style={{
                background: groundTrackAligned ? "#C4B5FD" : "#F59E0B",
              }}
            />{" "}
            Surface ground track
          </span>
          <span className="legend-dot-item">
            <i style={{ background: "#F43F5E" }} /> Landing site
          </span>
        </div>
        <span className="pill pill-muted">
          {pinMode
            ? "Pin mode active: click the Moon"
            : "Drag to rotate · Shift+click to choose a location"}
        </span>
      </div>
    </div>
  );
}
