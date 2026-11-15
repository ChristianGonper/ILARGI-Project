import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  LUNAR_RADIUS_KM,
  latLonToThreeVector,
  threeVectorToLatLon,
} from "../three/moonCoordinates";
import type {
  EducationCategory,
  EducationCycleFrame,
  EducationSite,
} from "../types";

interface HoverTooltip {
  x: number;
  y: number;
  title: string;
  subtitle: string;
  coords: string;
}

interface EducationMoonViewport3DProps {
  sites: EducationSite[];
  selectedSite: EducationSite | null;
  manualCoords: { latitudeDeg: number; longitudeEastDeg: number } | null;
  currentFrame: EducationCycleFrame | null;
  showWaterLayer: boolean;
  showMirrorLaser: boolean;
  pinMode: boolean;
  onSelectSite: (site: EducationSite) => void;
  onSurfacePick: (latitudeDeg: number, longitudeEastDeg: number) => void;
}

const CATEGORY_COLORS: Record<EducationCategory, number> = {
  eternal_light: 0xf59e0b,
  psr: 0x22d3ee,
  mirror: 0x10b981,
  landing: 0xc4b5fd,
};

const CATEGORY_HEX: Record<EducationCategory, string> = {
  eternal_light: "#F59E0B",
  psr: "#22D3EE",
  mirror: "#10B981",
  landing: "#C4B5FD",
};

function moonMeToThree(
  vec: [number, number, number],
  scale = 1,
): THREE.Vector3 {
  // MOON_ME: +X = 0° lon, +Y = 90° E, +Z = North Pole.
  // Three.js sphere: +Z = 0° lon, +X = 90° E, +Y = North Pole.
  return new THREE.Vector3(vec[1] * scale, vec[2] * scale, vec[0] * scale);
}

function makeFallbackTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#8a94a6";
  ctx.fillRect(0, 0, 512, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeMarkerLabel(text: string, colorHex: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(11, 16, 27, 0.88)";
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(10, 12, 236, 40, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#F1F5F9";
  ctx.font = "bold 20px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text.slice(0, 18), 128, 33);

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.36, 0.09, 1);
  return sprite;
}

export function EducationMoonViewport3D({
  sites,
  selectedSite,
  manualCoords,
  currentFrame,
  showWaterLayer,
  showMirrorLaser,
  pinMode,
  onSelectSite,
  onSurfacePick,
}: EducationMoonViewport3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<HoverTooltip | null>(null);
  const [cameraPreset, setCameraPreset] = useState<
    "focus" | "south" | "north" | "nearside" | "farside"
  >("south");

  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const earthLightRef = useRef<THREE.DirectionalLight | null>(null);
  const sunBeaconRef = useRef<THREE.Mesh | null>(null);
  const sunRayRef = useRef<THREE.Line | null>(null);
  const laserLineRef = useRef<THREE.Line | null>(null);
  const sitesGroupRef = useRef<THREE.Group | null>(null);
  const waterGroupRef = useRef<THREE.Group | null>(null);
  const focusGroupRef = useRef<THREE.Group | null>(null);
  const moonMeshRef = useRef<THREE.Mesh | null>(null);

  const callbacksRef = useRef({
    onSelectSite,
    onSurfacePick,
    pinMode,
  });
  callbacksRef.current = {
    onSelectSite,
    onSurfacePick,
    pinMode,
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#070b14");

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 480;
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0.9, -2.05, 1.75);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 1.45;
    controls.maxDistance = 5.5;
    controls.enablePan = false;
    controlsRef.current = controls;

    const ambient = new THREE.AmbientLight(0x93c5fd, 0.14);
    scene.add(ambient);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.75);
    sunLight.position.set(4, 0.5, 3);
    sunLightRef.current = sunLight;
    scene.add(sunLight);

    const earthLight = new THREE.DirectionalLight(0x38bdf8, 0.2);
    earthLight.position.set(0, 0, 5);
    earthLightRef.current = earthLight;
    scene.add(earthLight);

    const starPositions = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      const r = 14 + Math.random() * 14;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = r * Math.sin(ph) * Math.cos(th);
      starPositions[i * 3 + 1] = r * Math.cos(ph);
      starPositions[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(starPositions, 3),
    );
    const starMat = new THREE.PointsMaterial({
      color: 0xcbd5e1,
      size: 0.055,
      transparent: true,
      opacity: 0.65,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    // Esfera lunar texturizada LROC + relieve LOLA
    const fallbackTex = makeFallbackTexture();
    const sphereGeo = new THREE.SphereGeometry(1.0, 128, 96);
    sphereGeo.rotateY(-Math.PI / 2);
    const sphereMat = new THREE.MeshStandardMaterial({
      map: fallbackTex,
      bumpScale: 0.032,
      roughness: 0.95,
      metalness: 0.02,
    });
    const moonMesh = new THREE.Mesh(sphereGeo, sphereMat);
    moonMeshRef.current = moonMesh;
    scene.add(moonMesh);

    const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
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
      tex.anisotropy = maxAnisotropy;
      loadedColor = tex;
      sphereMat.map = tex;
      sphereMat.needsUpdate = true;
      fallbackTex.dispose();
    });
    loader.load("/textures/moon_bump.jpg", (tex) => {
      if (disposed) {
        tex.dispose();
        return;
      }
      tex.wrapS = THREE.RepeatWrapping;
      tex.anisotropy = maxAnisotropy;
      loadedBump = tex;
      sphereMat.bumpMap = tex;
      sphereMat.bumpScale = 0.036;
      sphereMat.needsUpdate = true;
    });

    const addRing = (latDeg: number, color: number, opacity: number) => {
      const pts: THREE.Vector3[] = [];
      for (let lon = -180; lon <= 180; lon += 3) {
        pts.push(latLonToThreeVector(latDeg, lon, 1.002));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      scene.add(
        new THREE.Line(
          geo,
          new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
        ),
      );
    };
    addRing(0, 0x475569, 0.35);
    addRing(-80, 0x38bdf8, 0.55);
    addRing(80, 0x38bdf8, 0.45);

    const sunBeacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
    );
    sunBeacon.position.set(2.2, 0.2, 1.5);
    sunBeaconRef.current = sunBeacon;
    scene.add(sunBeacon);

    const sunRayGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(2.2, 0.2, 1.5),
    ]);
    const sunRay = new THREE.Line(
      sunRayGeo,
      new THREE.LineBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.35,
      }),
    );
    sunRayRef.current = sunRay;
    scene.add(sunRay);

    const laserGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 1.02),
      new THREE.Vector3(0, 0, 2.8),
    ]);
    const laserMat = new THREE.LineBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.9,
    });
    const laserLine = new THREE.Line(laserGeo, laserMat);
    laserLine.visible = false;
    laserLineRef.current = laserLine;
    scene.add(laserLine);

    const waterGroup = new THREE.Group();
    const sitesGroup = new THREE.Group();
    const focusGroup = new THREE.Group();
    waterGroupRef.current = waterGroup;
    sitesGroupRef.current = sitesGroup;
    focusGroupRef.current = focusGroup;
    scene.add(waterGroup);
    scene.add(sitesGroup);
    scene.add(focusGroup);

    const wehGeometry = new THREE.SphereGeometry(1.0025, 128, 96);
    wehGeometry.rotateY(-Math.PI / 2);
    const wehTexture = loader.load(
      "/textures/weh_lawrence2022.png",
      (texture) => {
        if (disposed) texture.dispose();
      },
    );
    wehTexture.colorSpace = THREE.SRGBColorSpace;
    const wehMaterial = new THREE.MeshStandardMaterial({
      map: wehTexture,
      transparent: true,
      depthWrite: false,
      roughness: 0.95,
    });
    waterGroup.add(new THREE.Mesh(wehGeometry, wehMaterial));
    waterGroup.visible = false;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downPos = { x: 0, y: 0 };

    const updatePointer = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      return rect;
    };

    const onPointerDown = (ev: PointerEvent) => {
      downPos = { x: ev.clientX, y: ev.clientY };
    };

    const onPointerMove = (ev: PointerEvent) => {
      const rect = updatePointer(ev);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(sitesGroup.children, true);
      const hitMeta = hits.find((h) => h.object.userData?.site);
      if (hitMeta) {
        const site = hitMeta.object.userData.site as EducationSite;
        renderer.domElement.style.cursor = "pointer";
        setTooltip({
          x: ev.clientX - rect.left + 12,
          y: ev.clientY - rect.top - 12,
          title: site.name,
          subtitle: `${site.category_label} · ${site.mission_or_source}`,
          coords: `λ=${site.latitude_deg.toFixed(2)}°, θ=${site.longitude_east_deg.toFixed(2)}°E`,
        });
      } else {
        renderer.domElement.style.cursor = callbacksRef.current.pinMode
          ? "crosshair"
          : "grab";
        setTooltip(null);
      }
    };

    const onPointerUp = (ev: PointerEvent) => {
      const moved = Math.hypot(ev.clientX - downPos.x, ev.clientY - downPos.y);
      if (moved > 5) return;

      updatePointer(ev);
      raycaster.setFromCamera(pointer, camera);

      const hits = raycaster.intersectObjects(sitesGroup.children, true);
      const hitMeta = hits.find((h) => h.object.userData?.site);
      if (hitMeta) {
        callbacksRef.current.onSelectSite(
          hitMeta.object.userData.site as EducationSite,
        );
        return;
      }

      if (callbacksRef.current.pinMode || ev.shiftKey) {
        const surfaceHits = raycaster.intersectObject(moonMesh, false);
        if (surfaceHits.length > 0) {
          const { latitudeDeg, longitudeEastDeg } = threeVectorToLatLon(
            surfaceHits[0].point,
          );
          callbacksRef.current.onSurfacePick(
            Number(THREE.MathUtils.clamp(latitudeDeg, -89.9, 89.9).toFixed(3)),
            Number(longitudeEastDeg.toFixed(3)),
          );
        }
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
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
      if (laserLineRef.current?.visible) {
        const mat = laserLineRef.current.material as THREE.LineBasicMaterial;
        mat.opacity = 0.45 + 0.5 * Math.abs(Math.sin(t * 4.2));
      }
      if (focusGroupRef.current && focusGroupRef.current.children.length > 0) {
        const pulseRing = focusGroupRef.current.children[0];
        if (pulseRing) {
          const s = 1.0 + 0.14 * Math.sin(t * 3.5);
          pulseRing.scale.set(s, s, 1);
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
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      fallbackTex.dispose();
      loadedColor?.dispose();
      loadedBump?.dispose();
      wehGeometry.dispose();
      wehTexture.dispose();
      wehMaterial.dispose();
      sphereGeo.dispose();
      sphereMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    if (!currentFrame) return;
    const sunDir = moonMeToThree(currentFrame.sun_me_unit, 1).normalize();
    const earthDir = moonMeToThree(currentFrame.earth_me_unit, 1).normalize();

    if (sunLightRef.current) {
      sunLightRef.current.position.copy(sunDir.clone().multiplyScalar(6));
    }
    if (earthLightRef.current) {
      earthLightRef.current.position.copy(earthDir.clone().multiplyScalar(5));
    }
    if (sunBeaconRef.current && sunRayRef.current) {
      const beaconPos = sunDir.clone().multiplyScalar(2.05);
      sunBeaconRef.current.position.copy(beaconPos);
      const positions = sunRayRef.current.geometry.attributes
        .position as THREE.BufferAttribute;
      positions.setXYZ(0, sunDir.x * 1.02, sunDir.y * 1.02, sunDir.z * 1.02);
      positions.setXYZ(1, beaconPos.x, beaconPos.y, beaconPos.z);
      positions.needsUpdate = true;
    }

    if (laserLineRef.current) {
      const targetLat =
        manualCoords?.latitudeDeg ?? selectedSite?.latitude_deg ?? 0;
      const targetLon =
        manualCoords?.longitudeEastDeg ?? selectedSite?.longitude_east_deg ?? 0;
      const isMirror = showMirrorLaser || selectedSite?.category === "mirror";
      const targetVec = latLonToThreeVector(targetLat, targetLon, 1.015);
      const visibleFromEarth =
        targetVec.clone().normalize().dot(earthDir) > 0.05;
      laserLineRef.current.visible = Boolean(isMirror && visibleFromEarth);
      if (laserLineRef.current.visible) {
        const endPos = targetVec
          .clone()
          .add(earthDir.clone().multiplyScalar(1.9));
        const posAttr = laserLineRef.current.geometry.attributes
          .position as THREE.BufferAttribute;
        posAttr.setXYZ(0, targetVec.x, targetVec.y, targetVec.z);
        posAttr.setXYZ(1, endPos.x, endPos.y, endPos.z);
        posAttr.needsUpdate = true;
      }
    }
  }, [currentFrame, selectedSite, manualCoords, showMirrorLaser]);

  // Toggle the global WEH overlay
  useEffect(() => {
    if (waterGroupRef.current) {
      waterGroupRef.current.visible = showWaterLayer;
    }
  }, [showWaterLayer]);

  useEffect(() => {
    const group = sitesGroupRef.current;
    if (!group) return;
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    const dotGeo = new THREE.SphereGeometry(0.022, 16, 16);
    const mirrorGeo = new THREE.OctahedronGeometry(0.026, 0);
    const ringGeo = new THREE.RingGeometry(0.028, 0.038, 24);

    for (const site of sites) {
      const color = CATEGORY_COLORS[site.category];
      const pos = latLonToThreeVector(
        site.latitude_deg,
        site.longitude_east_deg,
        1.018,
      );
      const normal = pos.clone().normalize();
      const geo = site.category === "mirror" ? mirrorGeo : dotGeo;
      const dot = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
      dot.position.copy(pos);
      dot.userData = { site };
      group.add(dot);

      const ring = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({
          color,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.78,
        }),
      );
      ring.position.copy(pos);
      ring.lookAt(normal.multiplyScalar(2));
      group.add(ring);
    }
  }, [sites]);

  useEffect(() => {
    const group = focusGroupRef.current;
    if (!group) return;
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    const lat = manualCoords?.latitudeDeg ?? selectedSite?.latitude_deg;
    const lon =
      manualCoords?.longitudeEastDeg ?? selectedSite?.longitude_east_deg;
    if (lat === undefined || lon === undefined) return;

    const hex = manualCoords
      ? "#F43F5E"
      : CATEGORY_HEX[selectedSite?.category ?? "landing"];
    const colorNum = manualCoords
      ? 0xf43f5e
      : CATEGORY_COLORS[selectedSite?.category ?? "landing"];
    const pos = latLonToThreeVector(lat, lon, 1.028);
    const normal = pos.clone().normalize();

    const pulseRing = new THREE.Mesh(
      new THREE.RingGeometry(0.045, 0.062, 32),
      new THREE.MeshBasicMaterial({
        color: colorNum,
        side: THREE.DoubleSide,
      }),
    );
    pulseRing.position.copy(pos);
    pulseRing.lookAt(normal.clone().multiplyScalar(2));
    group.add(pulseRing);

    const labelText = manualCoords
      ? "Manual location"
      : (selectedSite?.name.split("·")[0].trim() ?? "Location");
    const sprite = makeMarkerLabel(labelText, hex);
    sprite.position.copy(pos.clone().multiplyScalar(1.11));
    group.add(sprite);
  }, [selectedSite, manualCoords]);

  const moveCamera = (
    preset: "focus" | "south" | "north" | "nearside" | "farside",
  ) => {
    setCameraPreset(preset);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    if (preset === "focus") {
      const lat =
        manualCoords?.latitudeDeg ?? selectedSite?.latitude_deg ?? -89.45;
      const lon =
        manualCoords?.longitudeEastDeg ?? selectedSite?.longitude_east_deg ?? 0;
      const dir = latLonToThreeVector(lat, lon, 1).normalize();
      camera.position.copy(dir.multiplyScalar(2.55));
    } else if (preset === "south") {
      camera.position.set(0.85, -2.05, 1.75);
    } else if (preset === "north") {
      camera.position.set(0.85, 2.05, 1.75);
    } else if (preset === "nearside") {
      camera.position.set(0.25, 0.35, 2.75);
    } else {
      camera.position.set(-0.25, 0.35, -2.75);
    }
    controls.target.set(0, 0, 0);
    controls.update();
  };

  return (
    <div className="moon-viewport-shell edu-moon-shell">
      <div className="moon-hud-top">
        <div className="moon-hud-pills">
          <span className="pill pill-muted">
            3D LUNAR GLOBE · R={LUNAR_RADIUS_KM.toFixed(1)} km · Free rotation
          </span>
          {showWaterLayer && (
            <span className="pill pill-cyan">
              Global WEH · stronger intensity = higher abundance
            </span>
          )}
          {(showMirrorLaser || selectedSite?.category === "mirror") && (
            <span className="pill pill-ok">Earth ↔ LRRR laser</span>
          )}
        </div>
        <div className="moon-camera-btns">
          <button
            type="button"
            className={`btn-mini ${cameraPreset === "focus" ? "active" : ""}`}
            onClick={() => moveCamera("focus")}
          >
            Focus on location
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
            className={`btn-mini ${cameraPreset === "north" ? "active" : ""}`}
            onClick={() => moveCamera("north")}
          >
            North Pole
          </button>
          <button
            type="button"
            className={`btn-mini ${cameraPreset === "nearside" ? "active" : ""}`}
            onClick={() => moveCamera("nearside")}
          >
            Near side
          </button>
          <button
            type="button"
            className={`btn-mini ${cameraPreset === "farside" ? "active" : ""}`}
            onClick={() => moveCamera("farside")}
          >
            Far side
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="moon-canvas-container edu-moon-canvas"
      />

      {tooltip && (
        <div
          className="moon-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="moon-tooltip-title">{tooltip.title}</div>
          <div className="moon-tooltip-sub">{tooltip.subtitle}</div>
          <div className="moon-tooltip-coords">{tooltip.coords}</div>
        </div>
      )}

      <div className="moon-hud-bottom edu-legend-bar">
        <div className="edu-legend-items">
          <span className="legend-dot-item">
            <i style={{ background: "#F59E0B" }} /> Illuminated terrain (PGDA
            69)
          </span>
          <span className="legend-dot-item">
            <i style={{ background: "#22D3EE" }} /> Permanent shadow (PSR)
          </span>
          <span className="legend-dot-item">
            <i style={{ background: "#C4B5FD" }} /> Landing spots
          </span>
          <span className="legend-dot-item">
            <i style={{ background: "#10B981" }} /> LRRR reflectors
          </span>
        </div>
        <span className="pill pill-muted">
          {pinMode
            ? "Pin active: click the surface"
            : "Drag to rotate · Live sunlight"}
        </span>
      </div>
    </div>
  );
}
