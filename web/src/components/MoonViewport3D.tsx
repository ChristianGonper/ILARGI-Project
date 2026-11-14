import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  LUNAR_RADIUS_KM,
  latLonToMoonMeKm,
  latLonToThreeVector,
  threeVectorToLatLon,
} from "../three/moonCoordinates";
import type { HistoricalSite, MoonViewport3DProps } from "../types";
import { loadLunarHeightField, LunarTerrain } from "../three/lunarTerrain";
import { moonNavigationSpeeds } from "../three/moonNavigation";

interface HoverTooltip {
  x: number;
  y: number;
  title: string;
  subtitle: string;
  coords: string;
}

function buildLunarTextures(): {
  colorMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const w = 1024;
  const h = 512;
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = w;
  colorCanvas.height = h;
  const cCtx = colorCanvas.getContext("2d")!;

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = w;
  bumpCanvas.height = h;
  const bCtx = bumpCanvas.getContext("2d")!;

  const cImg = cCtx.createImageData(w, h);
  const bImg = bCtx.createImageData(w, h);

  // Semilla determinista para mares lunares y cráteres procedurales (solo visual).
  const maria = [
    { lat: 18, lon: -18, rLat: 20, rLon: 26, depth: 0.34 }, // Mare Imbrium
    { lat: 12, lon: 18, rLat: 16, rLon: 22, depth: 0.32 }, // Mare Serenitatis / Tranquillitatis
    { lat: -8, lon: 48, rLat: 14, rLon: 18, depth: 0.28 }, // Mare Fecunditatis
    { lat: 14, lon: -50, rLat: 26, rLon: 32, depth: 0.35 }, // Oceanus Procellarum
    { lat: -54, lon: 175, rLat: 24, rLon: 36, depth: 0.24 }, // South Pole-Aitken
  ];

  // Generador pseudoaleatorio determinista para cráteres.
  let seed = 4219;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const craters = Array.from({ length: 140 }, () => ({
    lat: (rand() * 2 - 1) * 86,
    lon: (rand() * 2 - 1) * 180,
    radius: 1.5 + rand() * 7.5,
    rim: 0.08 + rand() * 0.14,
  }));

  for (let py = 0; py < h; py++) {
    const lat = 90 - (py / (h - 1)) * 180;
    const latRad = THREE.MathUtils.degToRad(lat);
    const cosLat = Math.max(0.15, Math.cos(latRad));

    for (let px = 0; px < w; px++) {
      // Three.js SphereGeometry u=0.5 corresponde a lon=0° en +Z con nuestra proyección.
      const lon = (px / (w - 1)) * 360 - 180;
      let val =
        0.58 +
        0.06 *
          Math.sin(latRad * 5 + 0.3) *
          Math.cos(THREE.MathUtils.degToRad(lon) * 3) +
        0.04 * Math.cos(latRad * 11 - THREE.MathUtils.degToRad(lon) * 7);

      for (const m of maria) {
        let dLon = Math.abs(lon - m.lon);
        if (dLon > 180) dLon = 360 - dLon;
        const d2 = ((lat - m.lat) / m.rLat) ** 2 + (dLon / m.rLon) ** 2;
        if (d2 < 2.2) {
          val -= m.depth * Math.exp(-d2 * 1.4);
        }
      }

      let bump = val;
      for (const c of craters) {
        let dLon = Math.abs(lon - c.lon) * cosLat;
        if (dLon > 180) dLon = 360 - dLon;
        const dist = Math.hypot(lat - c.lat, dLon) / c.radius;
        if (dist < 1.35) {
          if (dist < 0.78) {
            bump -= c.rim * 1.25 * (1 - (dist / 0.78) ** 2);
            val -= 0.04;
          } else {
            const rimGauss = Math.exp(-(((dist - 1.0) / 0.18) ** 2));
            bump += c.rim * rimGauss;
            val += 0.05 * rimGauss;
          }
        }
      }

      const shade = THREE.MathUtils.clamp(val, 0.16, 0.88);
      const idx = (py * w + px) * 4;
      cImg.data[idx] = Math.round(shade * 205);
      cImg.data[idx + 1] = Math.round(shade * 214);
      cImg.data[idx + 2] = Math.round(shade * 228);
      cImg.data[idx + 3] = 255;

      const bShade = THREE.MathUtils.clamp(bump, 0, 1);
      const bByte = Math.round(bShade * 255);
      bImg.data[idx] = bByte;
      bImg.data[idx + 1] = bByte;
      bImg.data[idx + 2] = bByte;
      bImg.data[idx + 3] = 255;
    }
  }

  cCtx.putImageData(cImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;

  return { colorMap, bumpMap };
}

function makeLabelSprite(text: string, colorHex: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(11, 16, 27, 0.84)";
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(14, 12, 100, 40, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#F1F5F9";
  ctx.font = "bold 24px JetBrains Mono, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 64, 33);

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.16, 0.08, 1);
  return sprite;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function MoonViewport3D({
  historicalSites,
  activePoints,
  focusedIndex,
  pinMode,
  mineralOverlay,
  selectedMinerals,
  onSelectHistoricalSite,
  onSelectActivePoint,
  onSurfacePick,
}: MoonViewport3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<HoverTooltip | null>(null);
  const [terrainStatus, setTerrainStatus] = useState("Cargando relieve LOLA…");
  const [cameraPreset, setCameraPreset] = useState<"south" | "nearside">(
    "south",
  );

  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const histGroupRef = useRef<THREE.Group | null>(null);
  const activeGroupRef = useRef<THREE.Group | null>(null);
  const moonMeshRef = useRef<THREE.Mesh | null>(null);
  const overlayRef = useRef<{
    canvas: HTMLCanvasElement;
    tex: THREE.CanvasTexture;
    mesh: THREE.Mesh;
  } | null>(null);

  const callbacksRef = useRef({
    onSelectHistoricalSite,
    onSelectActivePoint,
    onSurfacePick,
    pinMode,
  });
  callbacksRef.current = {
    onSelectHistoricalSite,
    onSelectActivePoint,
    onSurfacePick,
    pinMode,
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    const terrainAbort = new AbortController();
    let terrain: LunarTerrain | null = null;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0B101B");

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 520;
    const camera = new THREE.PerspectiveCamera(
      38,
      width / height,
      0.00001,
      100,
    );
    camera.position.set(0.95, -1.95, 1.85);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 1.012;
    controls.zoomSpeed = 0.65;
    Object.assign(controls, moonNavigationSpeeds(camera.position.length()));
    controls.maxDistance = 5.5;
    controls.enablePan = false;
    controlsRef.current = controls;

    // Iluminación espacial + ambiental suficiente para leer toda la esfera.
    scene.add(new THREE.AmbientLight(0xdbeafe, 0.45));
    const sunLight = new THREE.DirectionalLight(0xfff7ed, 1.4);
    sunLight.position.set(4.5, 1.2, 3.8);
    scene.add(sunLight);
    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.22);
    fillLight.position.set(-3.0, -2.5, -2.5);
    scene.add(fillLight);

    // Campo de estrellas discreto.
    const starPositions = new Float32Array(450 * 3);
    for (let i = 0; i < 450; i++) {
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
      color: 0x94a3b8,
      size: 0.055,
      transparent: true,
      opacity: 0.65,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    // Esfera lunar texturizada en MOON_ME (LROC WAC + relieve LOLA, con fallback procedural).
    const { colorMap: fallbackColor, bumpMap: fallbackBump } =
      buildLunarTextures();
    let activeColorMap: THREE.Texture = fallbackColor;
    let activeBumpMap: THREE.Texture = fallbackBump;

    const sphereGeo = new THREE.SphereGeometry(1.0, 128, 96);
    // Alinear u=0.5 (lon=0°) con +Z: SphereGeometry empieza en -X, rotamos Y -90°.
    sphereGeo.rotateY(-Math.PI / 2);
    const sphereMat = new THREE.MeshStandardMaterial({
      map: activeColorMap,
      bumpMap: activeBumpMap,
      bumpScale: 0.022,
      roughness: 0.94,
      metalness: 0.02,
    });
    const moonMesh = new THREE.Mesh(sphereGeo, sphereMat);
    moonMeshRef.current = moonMesh;
    scene.add(moonMesh);

    const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const loader = new THREE.TextureLoader();
    loader.load("/textures/moon_color.jpg", (tex) => {
      if (disposed) {
        tex.dispose();
        return;
      }
      tex.wrapS = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAnisotropy;
      activeColorMap = tex;
      sphereMat.map = tex;
      sphereMat.needsUpdate = true;
      fallbackColor.dispose();
    });
    loader.load("/textures/moon_bump.jpg", (tex) => {
      if (disposed) {
        tex.dispose();
        return;
      }
      tex.wrapS = THREE.RepeatWrapping;
      tex.anisotropy = maxAnisotropy;
      activeBumpMap = tex;
      sphereMat.bumpMap = tex;
      sphereMat.bumpScale = terrain ? 0.001 : 0.026;
      sphereMat.needsUpdate = true;
      fallbackBump.dispose();
    });

    // Máscara transparente de minerales LP-GRS sobre la esfera lunar.
    const overlayCanvas = document.createElement("canvas");
    overlayCanvas.width = 1440;
    overlayCanvas.height = 720;
    const overlayTex = new THREE.CanvasTexture(overlayCanvas);
    overlayTex.wrapS = THREE.RepeatWrapping;
    overlayTex.colorSpace = THREE.SRGBColorSpace;
    const overlayGeo = new THREE.SphereGeometry(1.0025, 128, 96);
    overlayGeo.rotateY(-Math.PI / 2);
    const overlayMat = new THREE.MeshStandardMaterial({
      map: overlayTex,
      transparent: true,
      depthWrite: false,
      roughness: 0.95,
      metalness: 0.0,
    });
    const overlayMesh = new THREE.Mesh(overlayGeo, overlayMat);
    overlayMesh.visible = false;
    overlayRef.current = {
      canvas: overlayCanvas,
      tex: overlayTex,
      mesh: overlayMesh,
    };
    scene.add(overlayMesh);

    void loadLunarHeightField(terrainAbort.signal)
      .then((field) => {
        if (disposed) return;
        terrain = new LunarTerrain(field, sphereMat, overlayMat);
        terrain.update(camera.position);
        scene.add(terrain);
        scene.traverse((object) => {
          if (!(object instanceof THREE.Line)) return;
          const positions = object.geometry.getAttribute("position");
          for (let i = 0; i < positions.count; i++) {
            const point = new THREE.Vector3().fromBufferAttribute(positions, i);
            const location = threeVectorToLatLon(point);
            point.setLength(
              field.radius(location.latitudeDeg, location.longitudeEastDeg) +
                0.0001,
            );
            positions.setXYZ(i, point.x, point.y, point.z);
          }
          positions.needsUpdate = true;
          object.geometry.computeBoundingSphere();
        });
        moonMesh.visible = false;
        overlayMesh.visible = false;
        sphereMat.bumpScale = 0.001;
        setTerrainStatus("Relieve LOLA · escala real · acerca con la rueda");
      })
      .catch(() => {
        if (!disposed)
          setTerrainStatus(
            "Relieve no disponible · mostrando esfera texturizada",
          );
      });

    // Anillos de referencia: ecuador (0°), meridiano 0° y límite polar sur 80° S.
    const addRing = (latDeg: number, color: number, opacity: number) => {
      const pts: THREE.Vector3[] = [];
      for (let lon = -180; lon <= 180; lon += 3) {
        pts.push(latLonToThreeVector(latDeg, lon, 1.003));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity,
      });
      scene.add(new THREE.Line(geo, mat));
    };
    addRing(0, 0x475569, 0.55);
    addRing(-80, 0x38bdf8, 0.85);

    const merPts: THREE.Vector3[] = [];
    for (let lat = -90; lat <= 90; lat += 3) {
      merPts.push(latLonToThreeVector(lat, 0, 1.003));
    }
    scene.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(merPts),
        new THREE.LineBasicMaterial({
          color: 0x475569,
          transparent: true,
          opacity: 0.55,
        }),
      ),
    );

    const histGroup = new THREE.Group();
    const activeGroup = new THREE.Group();
    histGroupRef.current = histGroup;
    activeGroupRef.current = activeGroup;
    scene.add(histGroup);
    scene.add(activeGroup);

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
      const targets = [...activeGroup.children, ...histGroup.children];
      const hits = raycaster.intersectObjects(targets, true);
      const hitWithMeta = hits.find((h) => h.object.userData?.kind);
      if (hitWithMeta) {
        const meta = hitWithMeta.object.userData;
        renderer.domElement.style.cursor = "pointer";
        setTooltip({
          x: ev.clientX - rect.left + 12,
          y: ev.clientY - rect.top - 12,
          title: meta.title as string,
          subtitle: meta.subtitle as string,
          coords: meta.coords as string,
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
      if (moved > 5) return; // Fue un arrastre de cámara.

      updatePointer(ev);
      raycaster.setFromCamera(pointer, camera);

      const activeHits = raycaster.intersectObjects(activeGroup.children, true);
      const activeMeta = activeHits.find(
        (h) => h.object.userData?.kind === "active",
      );
      if (activeMeta && callbacksRef.current.onSelectActivePoint) {
        callbacksRef.current.onSelectActivePoint(
          activeMeta.object.userData.index as number,
        );
        return;
      }

      const histHits = raycaster.intersectObjects(histGroup.children, true);
      const histMeta = histHits.find(
        (h) => h.object.userData?.kind === "historical",
      );
      if (histMeta) {
        callbacksRef.current.onSelectHistoricalSite(
          histMeta.object.userData.site as HistoricalSite,
        );
        return;
      }

      if (
        (callbacksRef.current.pinMode || ev.shiftKey) &&
        callbacksRef.current.onSurfacePick
      ) {
        const surfaceHits = raycaster.intersectObject(
          terrain ?? moonMesh,
          !!terrain,
        );
        if (surfaceHits.length > 0) {
          const { latitudeDeg, longitudeEastDeg } = threeVectorToLatLon(
            surfaceHits[0].point,
          );
          callbacksRef.current.onSurfacePick(
            Number(
              THREE.MathUtils.clamp(latitudeDeg, -89.999, 89.999).toFixed(3),
            ),
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
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      Object.assign(controls, moonNavigationSpeeds(camera.position.length()));
      controls.update();
      terrain?.update(camera.position);
      // Keep annotations on the displaced surface and readable at every zoom.
      for (const group of [histGroup, activeGroup]) {
        for (const object of group.children) {
          const normal = object.position.clone().normalize();
          const distance = camera.position.distanceTo(normal);
          const size = Math.min(1, Math.max(0.0005, distance / 2.5));
          if (!object.userData.baseScale) {
            object.userData.baseScale = object.scale.clone();
            object.userData.surfaceOffset = object.position.length() - 1;
          }
          object.scale.copy(object.userData.baseScale).multiplyScalar(size);
          const location = threeVectorToLatLon(normal);
          const radius =
            terrain?.field.radius(
              location.latitudeDeg,
              location.longitudeEastDeg,
            ) ?? 1;
          object.position.copy(
            normal.multiplyScalar(
              radius + object.userData.surfaceOffset * size,
            ),
          );
          object.visible =
            camera.position.dot(object.position.clone().normalize()) > radius;
        }
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      terrainAbort.abort();
      terrain?.dispose();
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      activeColorMap.dispose();
      activeBumpMap.dispose();
      fallbackColor.dispose();
      fallbackBump.dispose();
      overlayTex.dispose();
      overlayGeo.dispose();
      overlayMat.dispose();
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

  const [wehTexture, setWehTexture] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const image = new Image();
    image.onload = () => setWehTexture(image);
    image.src = "/textures/weh_lawrence2022.png";
    return () => {
      image.onload = null;
    };
  }, []);

  // Actualizar máscara transparente de minerales LP-GRS cuando cambia la selección.
  useEffect(() => {
    const ov = overlayRef.current;
    if (!ov) return;
    const { canvas, tex, mesh } = ov;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!mineralOverlay || selectedMinerals.length === 0) {
      tex.needsUpdate = true;
      (mesh.material as THREE.Material).visible = false;
      mesh.visible = false;
      return;
    }

    let painted = false;
    for (const id of selectedMinerals) {
      const meta = mineralOverlay.elements.find((e) => e.id === id);
      if (!meta || !meta.available) continue;
      if (id === "WEH") {
        if (wehTexture) {
          ctx.drawImage(wehTexture, 0, 0, w, h);
          painted = true;
        }
        continue;
      }
      const [r, g, b] = hexToRgb(meta.color);

      for (const reg of mineralOverlay.regions) {
        const level = reg.levels[id] ?? 0;
        if (level < 2) continue;
        const alpha = level === 3 ? 0.36 : 0.13;
        const x0 = Math.round(((reg.west + 180) / 360) * w);
        const x1 = Math.round(((reg.east + 180) / 360) * w);
        const y0 = Math.round(((90 - reg.north) / 180) * h);
        const y1 = Math.round(((90 - reg.south) / 180) * h);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
        painted = true;
      }
    }

    tex.needsUpdate = true;
    (mesh.material as THREE.Material).visible = painted;
    mesh.visible = painted && moonMeshRef.current?.visible === true;
  }, [mineralOverlay, selectedMinerals, wehTexture]);

  // Actualizar marcadores históricos cuando cambia la lista.
  useEffect(() => {
    const group = histGroupRef.current;
    if (!group) return;
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    const dotGeo = new THREE.SphereGeometry(0.019, 16, 16);
    const ringGeo = new THREE.RingGeometry(0.025, 0.034, 24);

    for (const site of historicalSites) {
      const pos = latLonToThreeVector(
        site.latitude_deg,
        site.longitude_east_deg,
        1.014,
      );
      const normal = pos.clone().normalize();
      const [mx, my, mz] = latLonToMoonMeKm(
        site.latitude_deg,
        site.longitude_east_deg,
      );

      const dotMat = new THREE.MeshBasicMaterial({
        color: site.in_lola_sample ? 0x38bdf8 : 0xcbd5e1,
      });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(pos);
      dot.userData = {
        kind: "historical",
        site,
        title: site.name,
        subtitle: `${site.mission} · Clic para añadir/analizar`,
        coords: `λ=${site.latitude_deg.toFixed(3)}°, θ=${site.longitude_east_deg.toFixed(3)}°E · MOON_ME (${mx.toFixed(0)}, ${my.toFixed(0)}, ${mz.toFixed(0)}) km`,
      };
      group.add(dot);

      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.72,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(pos);
      ring.lookAt(normal.multiplyScalar(2));
      group.add(ring);
    }
  }, [historicalSites]);

  // Actualizar puntos activos P1..P10 y marco de foco.
  useEffect(() => {
    const group = activeGroupRef.current;
    if (!group) return;
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    const pinGeo = new THREE.OctahedronGeometry(0.027, 0);
    const focusGeo = new THREE.RingGeometry(0.044, 0.058, 4);

    activePoints.forEach((pt, idx) => {
      const isFocused = focusedIndex === idx;
      const color = isFocused ? 0xf43f5e : 0xf59e0b;
      const colorHex = isFocused ? "#F43F5E" : "#F59E0B";
      const pos = latLonToThreeVector(
        pt.latitudeDeg,
        pt.longitudeEastDeg,
        1.028,
      );
      const normal = pos.clone().normalize();

      const mesh = new THREE.Mesh(
        pinGeo,
        new THREE.MeshBasicMaterial({ color }),
      );
      mesh.position.copy(pos);
      mesh.userData = {
        kind: "active",
        index: idx,
        title: `P${idx + 1} · ${pt.siteName}`,
        subtitle: `${pt.startDate} ${pt.startTime} UTC`,
        coords: `λ=${pt.latitudeDeg.toFixed(3)}°, θ=${pt.longitudeEastDeg.toFixed(3)}°E`,
      };
      group.add(mesh);

      if (isFocused) {
        const focusRing = new THREE.Mesh(
          focusGeo,
          new THREE.MeshBasicMaterial({
            color: 0xf43f5e,
            side: THREE.DoubleSide,
          }),
        );
        focusRing.position.copy(pos);
        focusRing.lookAt(normal.clone().multiplyScalar(2));
        group.add(focusRing);
      }

      const sprite = makeLabelSprite(`P${idx + 1}`, colorHex);
      sprite.position.copy(pos.clone().multiplyScalar(1.07));
      group.add(sprite);
    });
  }, [activePoints, focusedIndex]);

  const moveCamera = (preset: "south" | "nearside") => {
    setCameraPreset(preset);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    if (preset === "south") {
      camera.position.set(0.95, -1.95, 1.85);
    } else {
      camera.position.set(0.35, 0.45, 2.75);
    }
    controls.target.set(0, 0, 0);
    controls.update();
  };

  return (
    <div className="moon-viewport-shell">
      <div className="moon-hud-top">
        <div className="moon-hud-pills">
          <span className="pill pill-muted">
            THREE.JS · MOON_ME (R={LUNAR_RADIUS_KM.toFixed(1)} km)
          </span>
          <span className="pill pill-cyan">80° S · LOLA / LP-GRS</span>
        </div>
        <div className="moon-camera-btns">
          <button
            type="button"
            className={`btn-mini ${cameraPreset === "south" ? "active" : ""}`}
            onClick={() => moveCamera("south")}
          >
            Polo Sur
          </button>
          <button
            type="button"
            className={`btn-mini ${cameraPreset === "nearside" ? "active" : ""}`}
            onClick={() => moveCamera("nearside")}
          >
            Cara visible
          </button>
        </div>
      </div>

      <div ref={containerRef} className="moon-canvas-container" />

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

      <div className="moon-hud-bottom">
        <div className="moon-hud-minerals">
          {selectedMinerals.length === 0 ? (
            <span>
              Clic en un punto histórico para añadirlo/analizarlo ·{" "}
              {pinMode
                ? "Modo pin activo: clic sobre la esfera para fijar coordenadas"
                : "Shift + clic en superficie para elegir coordenadas manuales"}
            </span>
          ) : (
            <>
              <span className="muted-note">Máscara LP-GRS:</span>
              {selectedMinerals.map((id) => {
                const meta = mineralOverlay?.elements.find((e) => e.id === id);
                if (!meta) return null;
                return (
                  <span
                    key={id}
                    className="pill"
                    style={{
                      borderColor: meta.color,
                      color: meta.color,
                      background: "rgba(11, 16, 27, 0.85)",
                    }}
                  >
                    {meta.id}
                    {!meta.available ? " · sin datos validados" : ""}
                  </span>
                );
              })}
            </>
          )}
        </div>
        <span className="pill pill-muted">{terrainStatus}</span>
      </div>
    </div>
  );
}
