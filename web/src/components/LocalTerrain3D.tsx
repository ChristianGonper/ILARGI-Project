import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { PointDraft } from "../types";

interface Patch {
  source: string;
  frame: string;
  pixel_size_m: number;
  width_km: number;
  size: number;
  spacing_m: number;
  center_elevation_m: number;
  min_elevation_m: number;
  max_elevation_m: number;
  coverage_fraction: number;
  heights_m: (number | null)[];
}

export function LocalTerrain3D({ point }: { point: PointDraft | undefined }) {
  const host = useRef<HTMLDivElement>(null);
  const updateScale = useRef<(scale: number) => void>(() => {});
  const resetCamera = useRef<() => void>(() => {});
  const [width, setWidth] = useState(10);
  const [scale, setScale] = useState(1);
  const [patch, setPatch] = useState<Patch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const latitude = point?.latitudeDeg;
  const longitude = point?.longitudeEastDeg;

  useEffect(() => {
    setPatch(null);
    setError(null);
    if (latitude === undefined || longitude === undefined) return;
    const abort = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/terrain/patch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abort.signal,
          body: JSON.stringify({
            latitude_deg: latitude,
            longitude_east_deg: longitude,
            width_km: width,
          }),
        });
        const body = await response.json();
        if (!response.ok)
          throw new Error(
            typeof body.detail === "string"
              ? body.detail
              : "No se pudo cargar el terreno.",
          );
        if (!abort.signal.aborted) setPatch(body as Patch);
      } catch (cause) {
        if (!abort.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudo cargar el terreno.",
          );
      }
    })();
    return () => abort.abort();
  }, [latitude, longitude, width]);

  useEffect(() => {
    if (!patch || !host.current) return;
    const container = host.current;
    setRenderError(null);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setRenderError(
        "No se pudo iniciar la vista 3D. Comprueba que WebGL esté disponible.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      "Relieve local LOLA. Arrastra para girar; rueda para acercar; botón derecho para desplazar.",
    );
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#080e19");
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 200);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = patch.width_km * 0.08;
    controls.maxDistance = patch.width_km * 6;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    const reset = () => {
      camera.position.set(
        patch.width_km * 0.75,
        patch.width_km * 0.65,
        patch.width_km * 0.85,
      );
      controls.target.set(0, 0, 0);
      controls.update();
    };
    reset();
    resetCamera.current = reset;
    scene.add(new THREE.HemisphereLight(0xe4edff, 0x273044, 1.4));
    const light = new THREE.DirectionalLight(0xffefd6, 3);
    light.position.set(-5, 3, 4);
    scene.add(light);
    const positions = new Float32Array(patch.size * patch.size * 3);
    const indices: number[] = [];
    for (let row = 0; row < patch.size; row++) {
      for (let col = 0; col < patch.size; col++) {
        const i = row * patch.size + col;
        positions[i * 3] =
          (col * patch.spacing_m - patch.width_km * 500) / 1000;
        positions[i * 3 + 2] =
          (row * patch.spacing_m - patch.width_km * 500) / 1000;
        if (row < patch.size - 1 && col < patch.size - 1) {
          const a = i,
            b = i + 1,
            c = i + patch.size,
            d = c + 1;
          for (const triangle of [
            [a, c, b],
            [b, c, d],
          ]) {
            if (triangle.every((v) => patch.heights_m[v] !== null))
              indices.push(...triangle);
          }
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    const material = new THREE.MeshStandardMaterial({
      color: 0xa5a6ab,
      roughness: 1,
      side: THREE.DoubleSide,
    });
    scene.add(new THREE.Mesh(geometry, material));
    const markerGeometry = new THREE.SphereGeometry(
      patch.width_km * 0.008,
      16,
      12,
    );
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.y = patch.width_km * 0.008;
    scene.add(marker);
    const applyScale = (factor: number) => {
      patch.heights_m.forEach((height, i) => {
        const x = positions[i * 3],
          z = positions[i * 3 + 2];
        // Local tangent-plane curvature in km; exaggerate heights only.
        positions[i * 3 + 1] =
          height === null
            ? 0
            : ((height - patch.center_elevation_m) / 1000) * factor -
              (x * x + z * z) / (2 * 1737.4);
      });
      geometry.attributes.position.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
    };
    updateScale.current = applyScale;
    applyScale(1);
    const observer = new ResizeObserver(() => {
      const w = container.clientWidth,
        h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    });
    observer.observe(container);
    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });
    return () => {
      updateScale.current = () => {};
      resetCamera.current = () => {};
      observer.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      geometry.dispose();
      material.dispose();
      markerGeometry.dispose();
      markerMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [patch]);

  useEffect(() => {
    updateScale.current(scale);
  }, [scale, patch]);

  return (
    <section className="local-terrain" aria-label="Terreno local 3D">
      <h2>Relieve local · {point?.siteName ?? "Selecciona un punto"}</h2>
      <div className="terrain-controls">
        <label>
          Zona{" "}
          <select
            value={width}
            onChange={(event) => setWidth(Number(event.target.value))}
          >
            <option value={5}>5 × 5 km</option>
            <option value={10}>10 × 10 km</option>
            <option value={20}>20 × 20 km</option>
          </select>
        </label>
        <label>
          Escala vertical{" "}
          <select
            value={scale}
            onChange={(event) => setScale(Number(event.target.value))}
          >
            <option value={1}>×1 · real</option>
            <option value={2}>×2</option>
            <option value={5}>×5</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => resetCamera.current()}
          disabled={!patch}
        >
          Restablecer cámara
        </button>
      </div>
      {point && (
        <p>
          {point.latitudeDeg.toFixed(4)}° N, {point.longitudeEastDeg.toFixed(4)}
          ° E · Arrastra para girar, usa la rueda para acercar y el botón
          derecho para desplazar.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {renderError && <p role="alert">{renderError}</p>}
      {!patch && !error && point && <p role="status">Cargando alturas LOLA…</p>}
      <div
        ref={host}
        className="terrain-canvas"
        hidden={!patch || !!error || !!renderError}
      />
      {patch && (
        <>
          <p>
            Punto azul: ubicación seleccionada. Alturas:{" "}
            {Math.round(patch.min_elevation_m)} a{" "}
            {Math.round(patch.max_elevation_m)} m respecto al radio lunar de
            referencia.{" "}
            {scale > 1
              ? `Relieve exagerado ×${scale}.`
              : "Relieve a escala real."}
          </p>
          <p>
            LOLA · {patch.source} · píxel nominal{" "}
            {Math.round(patch.pixel_size_m)} m · malla cada{" "}
            {Math.round(patch.spacing_m)} m.{" "}
            {patch.coverage_fraction < 1
              ? `Cobertura parcial (${Math.round(patch.coverage_fraction * 100)} %); los huecos no tienen datos.`
              : "Cobertura completa de esta ventana."}
          </p>
          <p>
            Iluminación ilustrativa. No representa las sombras de la fecha
            seleccionada ni modifica los análisis. Marco ME DE421, aproximado
            respecto a ME DE440 del globo.
          </p>
        </>
      )}
    </section>
  );
}
