import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  RotateCcw,
  Sparkles,
  Trophy,
} from "lucide-react";
import type { GameLandingSite } from "./gamePhysics";

interface Phase3LandingCanvasProps {
  site: GameLandingSite;
  onIlargiSpeak: (mood: string, text: string) => void;
  onRestartMission: () => void;
  onExitToEducation: () => void;
}

interface CraterFeature {
  x: number;
  y: number;
  r: number;
  depth: number;
}

interface TelemetrySnapshot {
  altM: number;
  vzMs: number;
  vxMs: number;
  vyMs: number;
  distM: number;
  predDistM: number;
  spacePressed: boolean;
  alignedInCircle: boolean;
  outcome: "playing" | "won" | "missed" | "hard_landing";
  finalErrorM: number;
  finalSpeedMs: number;
}

const TARGET_CIRCLE_RADIUS_M = 15;
const SAFE_LANDING_SPEED_MS = 3.8;
const INITIAL_ALTITUDE_M = 260;

// Generamos cráteres deterministas alrededor de la zona de aterrizaje para que el scroll sea rico y continuo
function buildCraterField(): CraterFeature[] {
  const craters: CraterFeature[] = [];
  let seed = 42197;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let i = 0; i < 190; i++) {
    const x = (rand() - 0.5) * 900;
    const y = (rand() - 0.5) * 900;
    // Dejamos el círculo central de aterrizaje bastante despejado de cráteres grandes
    const d0 = Math.hypot(x, y);
    const maxR = d0 < 30 ? 4 : 36;
    const r = 3 + Math.pow(rand(), 1.7) * maxR;
    craters.push({ x, y, r, depth: 0.35 + rand() * 0.55 });
  }
  return craters;
}

const CRATERS = buildCraterField();

export function Phase3LandingCanvas({
  site,
  onIlargiSpeak,
  onRestartMission,
  onExitToEducation,
}: Phase3LandingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keysRef = useRef<{
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    space: boolean;
  }>({
    up: false,
    down: false,
    left: false,
    right: false,
    space: false,
  });

  const simRef = useRef({
    landerX: -95,
    landerY: 78,
    altM: INITIAL_ALTITUDE_M,
    vx: 1.5,
    vy: -1.0,
    vz: -4.4, // Descenso lento inicial (m/s)
    outcome: "playing" as "playing" | "won" | "missed" | "hard_landing",
    finalErrorM: 0,
    finalSpeedMs: 0,
  });

  const [hud, setHud] = useState<TelemetrySnapshot>({
    altM: INITIAL_ALTITUDE_M,
    vzMs: -4.4,
    vxMs: 1.5,
    vyMs: -1.0,
    distM: 123,
    predDistM: 120,
    spacePressed: false,
    alignedInCircle: false,
    outcome: "playing",
    finalErrorM: 0,
    finalSpeedMs: 0,
  });

  const resetPhase3 = useCallback(() => {
    const angle = Math.PI * 0.78;
    const radius = 115;
    simRef.current = {
      landerX: Math.cos(angle) * radius,
      landerY: Math.sin(angle) * radius,
      altM: INITIAL_ALTITUDE_M,
      vx: 0.8,
      vy: -0.6,
      vz: -4.4,
      outcome: "playing",
      finalErrorM: 0,
      finalSpeedMs: 0,
    };
    setHud({
      altM: INITIAL_ALTITUDE_M,
      vzMs: -4.4,
      vxMs: 0.8,
      vyMs: -0.6,
      distM: radius,
      predDistM: radius,
      spacePressed: false,
      alignedInCircle: false,
      outcome: "playing",
      finalErrorM: 0,
      finalSpeedMs: 0,
    });
    onIlargiSpeak(
      "Modo Aterrizar · Cámara en patas",
      "Usa las flechas (o WASD) para mover tu X hacia donde marcan las flechas crecientes. Pulsa ESPACIO para frenar la bajada (¡verás cómo el suelo se aleja!) y cuadra tu X dentro del círculo final.",
    );
  }, [onIlargiSpeak]);

  useEffect(() => {
    resetPhase3();
  }, [site.id, resetPhase3]);

  // Listeners de teclado (Flechas + WASD + Espacio)
  useEffect(() => {
    const setKey = (
      code: string,
      key: string,
      pressed: boolean,
      ev?: KeyboardEvent,
    ) => {
      if (
        code === "Space" ||
        code === "ArrowUp" ||
        code === "ArrowDown" ||
        code === "ArrowLeft" ||
        code === "ArrowRight"
      ) {
        ev?.preventDefault();
      }
      const k = key.toLowerCase();
      if (code === "ArrowUp" || k === "w") keysRef.current.up = pressed;
      if (code === "ArrowDown" || k === "s") keysRef.current.down = pressed;
      if (code === "ArrowLeft" || k === "a") keysRef.current.left = pressed;
      if (code === "ArrowRight" || k === "d") keysRef.current.right = pressed;
      if (code === "Space") keysRef.current.space = pressed;
    };

    const onDown = (ev: KeyboardEvent) => setKey(ev.code, ev.key, true, ev);
    const onUp = (ev: KeyboardEvent) => setKey(ev.code, ev.key, false);
    const onBlur = () => {
      keysRef.current = {
        up: false,
        down: false,
        left: false,
        right: false,
        space: false,
      };
    };

    window.addEventListener("keydown", onDown, { passive: false });
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // Bucle principal de física lenta + renderizado Canvas 2D de cámara en patas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    let lastTs = performance.now();
    let hudTick = 0;

    const renderFrame = (now: number) => {
      rafId = requestAnimationFrame(renderFrame);
      const dt = Math.min(0.05, Math.max(0.004, (now - lastTs) / 1000));
      lastTs = now;

      const s = simRef.current;
      const keys = keysRef.current;

      if (s.outcome === "playing") {
        // Control horizontal suave (RCS lento y preciso)
        const latAccel = 16.5;
        let ax = 0;
        let ay = 0;
        if (keys.left) ax -= latAccel;
        if (keys.right) ax += latAccel;
        if (keys.up) ay -= latAccel;
        if (keys.down) ay += latAccel;

        s.vx += ax * dt;
        s.vy += ay * dt;
        // Amortiguación suave para que pilotar sea cómodo y sin derrapes infinitos
        const damping = Math.exp(-1.15 * dt);
        s.vx *= damping;
        s.vy *= damping;

        // Límite de velocidad horizontal
        const maxLatSpeed = 24;
        const spdLat = Math.hypot(s.vx, s.vy);
        if (spdLat > maxLatSpeed) {
          s.vx = (s.vx / spdLat) * maxLatSpeed;
          s.vy = (s.vy / spdLat) * maxLatSpeed;
        }

        s.landerX += s.vx * dt;
        s.landerY += s.vy * dt;

        // Control vertical lento: descenso base suave ~ -4.5 m/s; ESPACIO frena y sube!
        if (keys.space) {
          s.vz += 7.2 * dt; // Empuje ascendente: frena bajada y llega a subir (la imagen se aleja!)
          s.vz = Math.min(s.vz, 5.5);
        } else {
          // Gravedad lunar regulada hacia velocidad terminal lenta (~ -4.5 m/s)
          const targetDescent = -4.55;
          s.vz += (targetDescent - s.vz) * 0.9 * dt;
        }

        s.altM += s.vz * dt;
        s.altM = Math.min(480, s.altM);

        if (s.altM <= 0) {
          s.altM = 0;
          const touchSpeed = Math.abs(s.vz);
          const errorM = Math.hypot(s.landerX, s.landerY);
          s.finalErrorM = errorM;
          s.finalSpeedMs = touchSpeed;

          if (
            errorM <= TARGET_CIRCLE_RADIUS_M + 2 &&
            touchSpeed <= SAFE_LANDING_SPEED_MS
          ) {
            s.outcome = "won";
            onIlargiSpeak(
              "¡Alunizaje perfecto!",
              `¡Misión cumplida en ${site.name}! Cuadraste la X dentro del círculo a ${errorM.toFixed(1)} m del centro y posaste las patas suavemente a ${touchSpeed.toFixed(1)} m/s.`,
            );
          } else if (errorM > TARGET_CIRCLE_RADIUS_M + 2) {
            s.outcome = "missed";
            onIlargiSpeak(
              "Fuera de la zona de aterrizaje",
              `Tocaste suelo a ${errorM.toFixed(1)} m del centro del círculo. ¡Inténtalo de nuevo siguiendo las flechas crecientes y usa ESPACIO si necesitas más tiempo para cuadrar la X!`,
            );
          } else {
            s.outcome = "hard_landing";
            onIlargiSpeak(
              "¡Descenso demasiado rápido!",
              `Alineaste el círculo, pero bajaste a ${touchSpeed.toFixed(1)} m/s (máx seguro ${SAFE_LANDING_SPEED_MS} m/s). ¡Pulsa ESPACIO cerca del suelo para frenar la bajada!`,
            );
          }
        }
      }

      // Predicción de dónde aterrizaría ahora (X móvil según velocidad/movimiento)
      const lookaheadSec = Math.min(3.8, Math.max(0, s.altM / 22));
      const predX = s.landerX + s.vx * lookaheadSec;
      const predY = s.landerY + s.vy * lookaheadSec;
      const predDistM = Math.hypot(predX, predY);
      const distM = Math.hypot(s.landerX, s.landerY);
      const alignedInCircle = predDistM <= TARGET_CIRCLE_RADIUS_M;

      // Ajustar resolución física del canvas
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth || 720;
      const h = canvas.clientHeight || 500;
      if (
        canvas.width !== Math.round(w * dpr) ||
        canvas.height !== Math.round(h * dpr)
      ) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      const cx = w / 2;
      const cy = h / 2;

      // Escala dinámica según altitud: al pulsar ESPACIO sube la altura -> pixelsPerMeter baja -> ¡la imagen se aleja!
      const pixelsPerMeter = (Math.min(w, h) * 0.42) / (32 + s.altM * 0.55);

      // 1. Fondo regolito lunar con scroll relativo a (landerX, landerY)
      ctx.fillStyle = "#1b2230";
      ctx.fillRect(0, 0, w, h);

      // Grano y cuadrícula sutil del terreno que hace scroll con la nave
      const gridStepM = 25;
      const startGridX =
        Math.floor((s.landerX - w / (2 * pixelsPerMeter)) / gridStepM) *
        gridStepM;
      const endGridX = s.landerX + w / (2 * pixelsPerMeter) + gridStepM;
      const startGridY =
        Math.floor((s.landerY - h / (2 * pixelsPerMeter)) / gridStepM) *
        gridStepM;
      const endGridY = s.landerY + h / (2 * pixelsPerMeter) + gridStepM;

      ctx.strokeStyle = "rgba(148, 163, 184, 0.08)";
      ctx.lineWidth = 1;
      for (let gx = startGridX; gx <= endGridX; gx += gridStepM) {
        const sx = cx + (gx - s.landerX) * pixelsPerMeter;
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, h);
        ctx.stroke();
      }
      for (let gy = startGridY; gy <= endGridY; gy += gridStepM) {
        const sy = cy + (gy - s.landerY) * pixelsPerMeter;
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(w, sy);
        ctx.stroke();
      }

      // 2. Cráteres lunares sobre el suelo con relieve sombreado (scroll relativo)
      for (const c of CRATERS) {
        const sx = cx + (c.x - s.landerX) * pixelsPerMeter;
        const sy = cy + (c.y - s.landerY) * pixelsPerMeter;
        const sr = c.r * pixelsPerMeter;
        if (
          sx + sr < -40 ||
          sx - sr > w + 40 ||
          sy + sr < -40 ||
          sy - sr > h + 40
        ) {
          continue;
        }
        // Sombra interior del cráter
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(11, 16, 27, ${0.28 + c.depth * 0.25})`;
        ctx.fill();
        // Borde iluminado por el Sol
        ctx.beginPath();
        ctx.arc(sx - sr * 0.06, sy - sr * 0.06, sr, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(203, 213, 225, 0.22)";
        ctx.lineWidth = Math.max(1, sr * 0.08);
        ctx.stroke();
      }

      // 3. CÍRCULO OBJETIVO DE ATERRIZAJE en (0, 0)
      const targetScreenX = cx + (0 - s.landerX) * pixelsPerMeter;
      const targetScreenY = cy + (0 - s.landerY) * pixelsPerMeter;
      const targetRadiusPx = Math.max(
        10,
        TARGET_CIRCLE_RADIUS_M * pixelsPerMeter,
      );
      const pulse = 0.7 + 0.3 * Math.sin(now * 0.006);

      // Halo exterior del círculo de aterrizaje
      ctx.beginPath();
      ctx.arc(
        targetScreenX,
        targetScreenY,
        targetRadiusPx * 1.35,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = alignedInCircle
        ? "rgba(16, 185, 129, 0.16)"
        : "rgba(245, 158, 11, 0.10)";
      ctx.fill();

      // Anillo principal del círculo final
      ctx.beginPath();
      ctx.arc(targetScreenX, targetScreenY, targetRadiusPx, 0, Math.PI * 2);
      ctx.strokeStyle = alignedInCircle
        ? `rgba(16, 185, 129, ${0.85 + 0.15 * pulse})`
        : `rgba(245, 158, 11, ${0.75 + 0.25 * pulse})`;
      ctx.lineWidth = alignedInCircle ? 3.5 : 2.5;
      ctx.stroke();

      // Anillo interior + etiqueta
      ctx.beginPath();
      ctx.arc(
        targetScreenX,
        targetScreenY,
        targetRadiusPx * 0.35,
        0,
        Math.PI * 2,
      );
      ctx.strokeStyle = alignedInCircle ? "#10b981" : "#f59e0b";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = alignedInCircle ? "#6ee7b7" : "#fde68a";
      ctx.font = "bold 11px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(
        alignedInCircle ? "ZONA DE ATERRIZAJE · ¡CUADRADA!" : "OBJETIVO ○",
        targetScreenX,
        targetScreenY + targetRadiusPx + 16,
      );

      // 4. FLECHAS DIRECCIONALES QUE AUMENTAN DE TAMAÑO SEGÚN SE VA ACERCANDO
      // Cuando estás lejos son pequeñas; conforme te acercas al objetivo aumentan de tamaño,
      // y en el momento final ya ves el círculo grande para cuadrar la X.
      if (distM > 10) {
        const dx = 0 - s.landerX;
        const dy = 0 - s.landerY;
        const ang = Math.atan2(dy, dx);
        const closeness = Math.max(0, Math.min(1, 1 - distM / 145));
        // Tamaño crece claramente al acercarse (de 0.45x hasta 1.95x)
        const arrowScale = 0.45 + closeness * 1.5;
        const arrowAlpha = distM < 20 ? Math.max(0.2, (distM - 10) / 10) : 0.92;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ang);

        // Dibujamos 3 flechas/chevrones progresivos en dirección al círculo objetivo
        for (let step = 0; step < 3; step++) {
          const offset = 50 + step * (22 * arrowScale) + ((now * 0.04) % 18);
          const sz = (9 + step * 3.8) * arrowScale;
          ctx.beginPath();
          ctx.moveTo(offset + sz, 0);
          ctx.lineTo(offset - sz * 0.55, -sz * 0.72);
          ctx.lineTo(offset - sz * 0.15, 0);
          ctx.lineTo(offset - sz * 0.55, sz * 0.72);
          ctx.closePath();
          ctx.fillStyle = `rgba(56, 189, 248, ${arrowAlpha * (0.45 + step * 0.22)})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(241, 245, 249, ${arrowAlpha * 0.75})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
        ctx.restore();
      }

      // 5. LA "X" DE DÓNDE ATERRIZARÍA AHORA (se mueve con el movimiento de la nave)
      const predScreenX = cx + (predX - s.landerX) * pixelsPerMeter;
      const predScreenY = cy + (predY - s.landerY) * pixelsPerMeter;

      // Línea guía desde el centro de las patas hasta la X proyectada
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(predScreenX, predScreenY);
      ctx.strokeStyle = "rgba(56, 189, 248, 0.45)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Retícula central de la cámara (bajo el centro del aterrizador)
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(203, 213, 225, 0.5)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Dibujo nítido de la "X" predictora de impacto
      const xSize = 15;
      const xColor = alignedInCircle ? "#10b981" : "#f43f5e";
      ctx.save();
      ctx.translate(predScreenX, predScreenY);
      ctx.strokeStyle = xColor;
      ctx.lineWidth = 3.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-xSize, -xSize);
      ctx.lineTo(xSize, xSize);
      ctx.moveTo(xSize, -xSize);
      ctx.lineTo(-xSize, xSize);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, xSize + 5, 0, Math.PI * 2);
      ctx.strokeStyle = alignedInCircle
        ? "rgba(16, 185, 129, 0.65)"
        : "rgba(244, 63, 94, 0.55)";
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.fillStyle = xColor;
      ctx.font = "bold 11px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("TU X", 0, -xSize - 10);
      ctx.restore();

      // 6. RESPLANDOR DE PROPULSOR SI PULSA ESPACIO (freno / subida)
      if (keys.space && s.outcome === "playing") {
        const thrustGrad = ctx.createRadialGradient(
          cx,
          cy,
          Math.min(w, h) * 0.25,
          cx,
          cy,
          Math.max(w, h) * 0.7,
        );
        thrustGrad.addColorStop(0, "rgba(245, 158, 11, 0)");
        thrustGrad.addColorStop(1, "rgba(245, 158, 11, 0.24)");
        ctx.fillStyle = thrustGrad;
        ctx.fillRect(0, 0, w, h);
      }

      // 7. PATAS DEL ATERRIZADOR EN LAS 4 ESQUINAS (Vista de cámara ventral)
      const corners = [
        [0, 0, 1, 1],
        [w, 0, -1, 1],
        [0, h, 1, -1],
        [w, h, -1, -1],
      ];
      const legReach = Math.min(w, h) * 0.14;
      for (const [ox, oy, sxDir, syDir] of corners) {
        const px = ox + sxDir * legReach;
        const py = oy + syDir * legReach;

        // Sombra de la pata proyectada ligeramente hacia fuera según altitud
        ctx.strokeStyle = "rgba(2, 6, 23, 0.55)";
        ctx.lineWidth = 12;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(px + sxDir * 6, py + syDir * 6);
        ctx.stroke();

        // Puntal metálico de la pata
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(px, py);
        ctx.stroke();

        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(px, py);
        ctx.stroke();

        // Plato de apoyo (footpad)
        ctx.beginPath();
        ctx.arc(px, py, 14, 0, Math.PI * 2);
        ctx.fillStyle = "#1e293b";
        ctx.fill();
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#f59e0b";
        ctx.fill();
      }

      // Viñeta sutil de lente óptica
      const vig = ctx.createRadialGradient(
        cx,
        cy,
        Math.min(w, h) * 0.35,
        cx,
        cy,
        Math.max(w, h) * 0.72,
      );
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(6,10,18,0.45)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);

      ctx.restore();

      // Sincronizar HUD React a ~15 fps para mantener interfaz fluida
      if (now - hudTick > 65 || s.outcome !== "playing") {
        hudTick = now;
        setHud({
          altM: s.altM,
          vzMs: s.vz,
          vxMs: s.vx,
          vyMs: s.vy,
          distM,
          predDistM,
          spacePressed: keys.space,
          alignedInCircle,
          outcome: s.outcome,
          finalErrorM: s.finalErrorM,
          finalSpeedMs: s.finalSpeedMs,
        });
      }
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, [onIlargiSpeak, site.name]);

  const bindTouchKey = (key: "up" | "down" | "left" | "right" | "space") => ({
    onPointerDown: () => {
      keysRef.current[key] = true;
    },
    onPointerUp: () => {
      keysRef.current[key] = false;
    },
    onPointerLeave: () => {
      keysRef.current[key] = false;
    },
  });

  return (
    <div className="phase3-grid">
      <div className="panel phase3-camera-panel">
        <div className="moon-hud-top">
          <div className="moon-hud-pills">
            <span className="pill pill-cyan">
              CÁMARA EN PATAS · MODO ATERRIZAR
            </span>
            <span
              className={`pill ${hud.alignedInCircle ? "pill-ok" : "pill-amber"}`}
            >
              {hud.alignedInCircle
                ? "¡X dentro del círculo!"
                : `Distancia al círculo: ${hud.distM.toFixed(0)} m`}
            </span>
          </div>
          <div className="moon-hud-pills">
            <span className="pill pill-muted mono">
              Altitud: {hud.altM.toFixed(1)} m
            </span>
            <span
              className={`pill mono ${Math.abs(hud.vzMs) <= SAFE_LANDING_SPEED_MS ? "pill-ok" : "pill-amber"}`}
            >
              V. vertical: {hud.vzMs.toFixed(1)} m/s
            </span>
          </div>
        </div>

        <div className="phase3-canvas-wrap">
          <canvas ref={canvasRef} className="phase3-canvas" />

          {hud.outcome !== "playing" && (
            <div className="phase3-outcome-overlay">
              <div
                className={`phase3-outcome-card ${hud.outcome === "won" ? "won" : "retry"}`}
              >
                <div className="phase3-outcome-icon">
                  {hud.outcome === "won" ? (
                    <Trophy size={32} className="tag-ok" />
                  ) : (
                    <Sparkles size={32} className="tag-sun" />
                  )}
                </div>
                <h3>
                  {hud.outcome === "won"
                    ? "¡ATERRIZAJE LUNAR COMPLETADO!"
                    : hud.outcome === "hard_landing"
                      ? "¡Aterrizaje demasiado brusco!"
                      : "Fuera del círculo objetivo"}
                </h3>
                <p className="mono">
                  Desviación del círculo: {hud.finalErrorM.toFixed(1)} m
                  (objetivo ≤ {TARGET_CIRCLE_RADIUS_M} m) · Velocidad:{" "}
                  {hud.finalSpeedMs.toFixed(1)} m/s (seguro ≤{" "}
                  {SAFE_LANDING_SPEED_MS} m/s)
                </p>
                <div className="phase3-outcome-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={resetPhase3}
                  >
                    <RotateCcw size={15} />
                    Reintentar Fase 3
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={onRestartMission}
                  >
                    Nueva misión (Fase 1)
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={onExitToEducation}
                  >
                    Volver a Educación
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="moon-hud-bottom edu-legend-bar">
          <div className="edu-legend-items">
            <span className="legend-dot-item">
              <i style={{ background: "#F43F5E" }} /> Tu X (dónde aterrizarías
              ahora)
            </span>
            <span className="legend-dot-item">
              <i style={{ background: "#38BDF8" }} /> Flechas guía (crecen al
              acercarte)
            </span>
            <span className="legend-dot-item">
              <i style={{ background: "#10B981" }} /> Círculo final de
              aterrizaje
            </span>
          </div>
          <span className="pill pill-muted">
            Flechas/WASD: mover · ESPACIO: frenar y alejar el suelo
          </span>
        </div>
      </div>

      {/* PANEL DERECHO: Controles e instrumentación de vuelo */}
      <aside className="panel phase3-controls-card">
        <div className="panel-header">
          <div>
            <div className="eyebrow eyebrow-accent">
              INSTRUMENTOS DE ATERRIZAJE
            </div>
            <div className="panel-sub">
              Descenso lento y controlado sobre {site.name.split("·")[0].trim()}
            </div>
          </div>
        </div>

        <div className="phase3-metrics-grid">
          <div className="kpi-box">
            <div className="kpi-label">Altitud sobre suelo</div>
            <div className="kpi-value kpi-earth">{hud.altM.toFixed(1)} m</div>
          </div>
          <div className="kpi-box">
            <div className="kpi-label">Vel. vertical</div>
            <div
              className={`kpi-value ${hud.vzMs > 0 ? "kpi-sun" : Math.abs(hud.vzMs) <= SAFE_LANDING_SPEED_MS ? "kpi-ok" : "kpi-sun"}`}
            >
              {hud.vzMs >= 0 ? `+${hud.vzMs.toFixed(1)}` : hud.vzMs.toFixed(1)}{" "}
              m/s
            </div>
          </div>
          <div className="kpi-box">
            <div className="kpi-label">Vel. horizontal</div>
            <div className="kpi-value">
              {Math.hypot(hud.vxMs, hud.vyMs).toFixed(1)} m/s
            </div>
          </div>
          <div className="kpi-box">
            <div className="kpi-label">Distancia X → ○</div>
            <div
              className={`kpi-value ${hud.alignedInCircle ? "kpi-ok" : "kpi-sun"}`}
            >
              {hud.predDistM.toFixed(1)} m
            </div>
          </div>
        </div>

        {/* Controles táctiles / ratón equivalentes a teclado */}
        <div className="phase3-pad-box">
          <div className="eyebrow">PILOTAJE RCS (O TECLAS ↑ ↓ ← → / WASD)</div>
          <div className="phase3-dpad">
            <div />
            <button
              type="button"
              className="btn-secondary phase3-dpad-btn"
              {...bindTouchKey("up")}
              aria-label="Mover arriba"
            >
              <ArrowUp size={16} />
            </button>
            <div />
            <button
              type="button"
              className="btn-secondary phase3-dpad-btn"
              {...bindTouchKey("left")}
              aria-label="Mover izquierda"
            >
              <ArrowLeft size={16} />
            </button>
            <button
              type="button"
              className="btn-secondary phase3-dpad-btn"
              {...bindTouchKey("down")}
              aria-label="Mover abajo"
            >
              <ArrowDown size={16} />
            </button>
            <button
              type="button"
              className="btn-secondary phase3-dpad-btn"
              {...bindTouchKey("right")}
              aria-label="Mover derecha"
            >
              <ArrowRight size={16} />
            </button>
          </div>

          <button
            type="button"
            className={`phase3-space-btn ${hud.spacePressed ? "active" : ""}`}
            {...bindTouchKey("space")}
          >
            <strong>[ ESPACIO ] FRENAR BAJADA / SUBIR</strong>
            <span>
              {hud.spacePressed
                ? "Propulsor encendido · La imagen se aleja"
                : "Mantén pulsado para frenar o ganar altura"}
            </span>
          </button>
        </div>

        <button type="button" className="btn-secondary" onClick={resetPhase3}>
          <RotateCcw size={14} />
          Reiniciar aproximación (Fase 3)
        </button>
      </aside>
    </div>
  );
}
