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
const SAFE_LANDING_SPEED_MS = 4.5;
const INITIAL_ALTITUDE_M = 175;
const BASE_DESCENT_SPEED_MS = -10.5;

function buildCraterField(): CraterFeature[] {
  const craters: CraterFeature[] = [];
  let seed = 42197;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let i = 0; i < 240; i++) {
    const x = (rand() - 0.5) * 900;
    const y = (rand() - 0.5) * 900;

    const d0 = Math.hypot(x, y);
    const maxR = d0 < 28 ? 2.5 : 14;
    const r = 2 + Math.pow(rand(), 1.7) * maxR;
    craters.push({ x, y, r, depth: 0.35 + rand() * 0.55 });
  }
  return craters;
}

const CRATERS = buildCraterField();

function buildSeamlessMoonTile(img: HTMLImageElement): HTMLCanvasElement {
  const tileSize = 768;
  const out = document.createElement("canvas");
  out.width = tileSize * 2;
  out.height = tileSize * 2;
  const octx = out.getContext("2d");
  if (!octx) return out;

  const sx = Math.floor(img.width * 0.34);
  const sy = Math.floor(img.height * 0.22);
  const sw = Math.min(img.width - sx, Math.floor(img.width * 0.275));
  const sh = Math.min(img.height - sy, Math.floor(img.height * 0.55));

  // Cuadrante superior izquierdo (normal)
  octx.drawImage(img, sx, sy, sw, sh, 0, 0, tileSize, tileSize);

  // Cuadrante superior derecho (espejo X)
  octx.save();
  octx.translate(tileSize * 2, 0);
  octx.scale(-1, 1);
  octx.drawImage(img, sx, sy, sw, sh, 0, 0, tileSize, tileSize);
  octx.restore();

  // Cuadrante inferior izquierdo (espejo Y)
  octx.save();
  octx.translate(0, tileSize * 2);
  octx.scale(1, -1);
  octx.drawImage(img, sx, sy, sw, sh, 0, 0, tileSize, tileSize);
  octx.restore();

  // Cuadrante inferior derecho (espejo X+Y)
  octx.save();
  octx.translate(tileSize * 2, tileSize * 2);
  octx.scale(-1, -1);
  octx.drawImage(img, sx, sy, sw, sh, 0, 0, tileSize, tileSize);
  octx.restore();

  return out;
}

export function Phase3LandingCanvas({
  site,
  onIlargiSpeak,
  onRestartMission,
  onExitToEducation,
}: Phase3LandingCanvasProps) {
  const [started, setStarted] = useState(false);
  const startedRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const moonTileRef = useRef<HTMLCanvasElement | null>(null);
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
    landerX: -92,
    landerY: 74,
    altM: INITIAL_ALTITUDE_M,
    vx: 2.0,
    vy: -1.4,
    vz: -9.5,
    outcome: "playing" as "playing" | "won" | "missed" | "hard_landing",
    finalErrorM: 0,
    finalSpeedMs: 0,
  });

  const [hud, setHud] = useState<TelemetrySnapshot>({
    altM: INITIAL_ALTITUDE_M,
    vzMs: -9.5,
    vxMs: 2.0,
    vyMs: -1.4,
    distM: 118,
    predDistM: 115,
    spacePressed: false,
    alignedInCircle: false,
    outcome: "playing",
    finalErrorM: 0,
    finalSpeedMs: 0,
  });

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.src = "/textures/moon_color.jpg";
    img.onload = () => {
      if (!cancelled) {
        moonTileRef.current = buildSeamlessMoonTile(img);
      }
    };
    return () => {
      cancelled = true;
    };
  }, []);

  const resetPhase3 = useCallback(() => {
    startedRef.current = false;
    setStarted(false);
    keysRef.current = {
      up: false,
      down: false,
      left: false,
      right: false,
      space: false,
    };
    const angle = Math.PI * 0.78;
    const radius = 112;
    simRef.current = {
      landerX: Math.cos(angle) * radius,
      landerY: Math.sin(angle) * radius,
      altM: INITIAL_ALTITUDE_M,
      vx: 1.5,
      vy: -1.1,
      vz: -9.5,
      outcome: "playing",
      finalErrorM: 0,
      finalSpeedMs: 0,
    };
    setHud({
      altM: INITIAL_ALTITUDE_M,
      vzMs: -9.5,
      vxMs: 1.5,
      vyMs: -1.1,
      distM: radius,
      predDistM: radius,
      spacePressed: false,
      alignedInCircle: false,
      outcome: "playing",
      finalErrorM: 0,
      finalSpeedMs: 0,
    });
    onIlargiSpeak(
      "Landing mode · Downward camera",
      "Use arrow keys or WASD to guide your projected touchdown marker toward the target. Hold SPACE to slow the descent and align the X inside the circle.",
    );
  }, [onIlargiSpeak]);

  useEffect(() => {
    resetPhase3();
  }, [site.id, resetPhase3]);

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

      if (s.outcome === "playing" && startedRef.current) {
        const latAccel = 30.0;
        let ax = 0;
        let ay = 0;
        if (keys.left) ax -= latAccel;
        if (keys.right) ax += latAccel;
        if (keys.up) ay -= latAccel;
        if (keys.down) ay += latAccel;

        s.vx += ax * dt;
        s.vy += ay * dt;
        const damping = Math.exp(-1.5 * dt);
        s.vx *= damping;
        s.vy *= damping;

        const maxLatSpeed = 36;
        const spdLat = Math.hypot(s.vx, s.vy);
        if (spdLat > maxLatSpeed) {
          s.vx = (s.vx / spdLat) * maxLatSpeed;
          s.vy = (s.vy / spdLat) * maxLatSpeed;
        }

        s.landerX += s.vx * dt;
        s.landerY += s.vy * dt;

        if (keys.space) {
          s.vz += 16.5 * dt;
          s.vz = Math.min(s.vz, 7.5);
        } else {
          s.vz += (BASE_DESCENT_SPEED_MS - s.vz) * 1.35 * dt;
        }

        s.altM += s.vz * dt;
        s.altM = Math.min(420, s.altM);

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
              "Successful landing",
              `Mission complete at ${site.name}! The X is inside the target circle, ${errorM.toFixed(1)} m from the center, with touchdown speed ${touchSpeed.toFixed(1)} m/s.`,
            );
          } else if (errorM > TARGET_CIRCLE_RADIUS_M + 2) {
            s.outcome = "missed";
            onIlargiSpeak(
              "Outside landing zone",
              `You touched down ${errorM.toFixed(1)} m from the target center. Try again using the guide arrows and SPACE to slow down.`,
            );
          } else {
            s.outcome = "hard_landing";
            onIlargiSpeak(
              "Descent too fast",
              `You reached the circle but descended at ${touchSpeed.toFixed(1)} m/s (game limit ${SAFE_LANDING_SPEED_MS} m/s). Hold SPACE near the ground to slow the descent.`,
            );
          }
        }
      }

      const lookaheadSec = Math.min(3.2, Math.max(0, s.altM / 20));
      const predX = s.landerX + s.vx * lookaheadSec;
      const predY = s.landerY + s.vy * lookaheadSec;
      const predDistM = Math.hypot(predX, predY);
      const distM = Math.hypot(s.landerX, s.landerY);
      const alignedInCircle = predDistM <= TARGET_CIRCLE_RADIUS_M;

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

      const pixelsPerMeter = (Math.min(w, h) * 0.42) / (26 + s.altM * 0.62);

      ctx.fillStyle = "#1b2230";
      ctx.fillRect(0, 0, w, h);

      const tile = moonTileRef.current;
      if (tile) {
        const pattern = ctx.createPattern(tile, "repeat");
        if (pattern) {
          const texelsPerMeter = 2.8;
          const screenPxPerTexel = pixelsPerMeter / texelsPerMeter;
          const matrix = new DOMMatrix()
            .translate(cx, cy)
            .scale(screenPxPerTexel, screenPxPerTexel)
            .translate(
              -s.landerX * texelsPerMeter,
              -s.landerY * texelsPerMeter,
            );
          pattern.setTransform(matrix);
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, w, h);

          ctx.fillStyle = "rgba(11, 16, 27, 0.22)";
          ctx.fillRect(0, 0, w, h);
        }
      }

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

        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(9, 13, 22, ${0.1 + c.depth * 0.1})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(sx - sr * 0.07, sy - sr * 0.07, sr, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(226, 232, 240, 0.22)";
        ctx.lineWidth = Math.max(0.7, sr * 0.035);
        ctx.stroke();
      }

      // Landing target circle at world origin
      const targetScreenX = cx + (0 - s.landerX) * pixelsPerMeter;
      const targetScreenY = cy + (0 - s.landerY) * pixelsPerMeter;
      const targetRadiusPx = Math.max(
        10,
        TARGET_CIRCLE_RADIUS_M * pixelsPerMeter,
      );
      const pulse = 0.7 + 0.3 * Math.sin(now * 0.006);

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
        alignedInCircle ? "LANDING ZONE · ALIGNED" : "TARGET ○",
        targetScreenX,
        targetScreenY + targetRadiusPx + 16,
      );

      // 4. FLECHAS DIRECCIONALES QUE AUMENTAN DE TAMAÑO SEGÚN SE VA ACERCANDO

      if (distM > 10) {
        const dx = 0 - s.landerX;
        const dy = 0 - s.landerY;
        const ang = Math.atan2(dy, dx);
        const closeness = Math.max(0, Math.min(1, 1 - distM / 145));

        const arrowScale = 0.45 + closeness * 1.5;
        const arrowAlpha = distM < 20 ? Math.max(0.2, (distM - 10) / 10) : 0.92;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ang);

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

      const predScreenX = cx + (predX - s.landerX) * pixelsPerMeter;
      const predScreenY = cy + (predY - s.landerY) * pixelsPerMeter;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(predScreenX, predScreenY);
      ctx.strokeStyle = "rgba(56, 189, 248, 0.45)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(203, 213, 225, 0.5)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

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
      ctx.fillText("YOUR X", 0, -xSize - 10);
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

      const corners = [
        [0, 0, 1, 1],
        [w, 0, -1, 1],
        [0, h, 1, -1],
        [w, h, -1, -1],
      ];
      const legReach = Math.min(w, h) * 0.055;
      for (const [ox, oy, sxDir, syDir] of corners) {
        const px = ox + sxDir * legReach;
        const py = oy + syDir * legReach;

        ctx.strokeStyle = "rgba(2, 6, 23, 0.55)";
        ctx.lineWidth = 12;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(px + sxDir * 6, py + syDir * 6);
        ctx.stroke();

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

        ctx.beginPath();
        ctx.arc(px, py, 7, 0, Math.PI * 2);
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
              DOWNWARD CAMERA · LANDING MODE
            </span>
            <span
              className={`pill ${hud.alignedInCircle ? "pill-ok" : "pill-amber"}`}
            >
              {hud.alignedInCircle
                ? "X inside the circle"
                : `Distance to target: ${hud.distM.toFixed(0)} m`}
            </span>
          </div>
          <div className="moon-hud-pills">
            <span className="pill pill-muted mono">
              Altitude: {hud.altM.toFixed(1)} m
            </span>
            <span
              className={`pill mono ${Math.abs(hud.vzMs) <= SAFE_LANDING_SPEED_MS ? "pill-ok" : "pill-amber"}`}
            >
              Vertical speed: {hud.vzMs.toFixed(1)} m/s
            </span>
          </div>
        </div>

        <div className="phase3-canvas-wrap">
          <canvas ref={canvasRef} className="phase3-canvas" />

          <div className="landing-flight-readout" aria-live="off">
            <strong>
              {Math.round(hud.altM)} <small>m to surface</small>
            </strong>
            <span>
              {Math.abs(hud.vzMs).toFixed(1)} m/s{" "}
              {hud.vzMs < 0 ? "descending" : "ascending"}
            </span>
            <b
              className={
                Math.abs(hud.vzMs) <= SAFE_LANDING_SPEED_MS
                  ? "tag-ok"
                  : "tag-sun"
              }
            >
              {Math.abs(hud.vzMs) > SAFE_LANDING_SPEED_MS
                ? "Hold SPACE to brake"
                : "Gentle descent"}
            </b>
          </div>
          {!started && (
            <div className="phase3-outcome-overlay">
              <div className="phase3-outcome-card">
                <h3>Prepare for landing</h3>
                <p>
                  Guide the X into the landing circle using the arrow keys or
                  WASD. Hold SPACE (or the brake button) to slow your descent.
                </p>
                <p>
                  Touch down within {TARGET_CIRCLE_RADIUS_M} m of the centre at
                  no more than{" "}
                  <strong>{SAFE_LANDING_SPEED_MS} m/s vertical speed</strong>.
                  Start braking early and keep watching your height.
                </p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    keysRef.current = {
                      up: false,
                      down: false,
                      left: false,
                      right: false,
                      space: false,
                    };
                    startedRef.current = true;
                    setStarted(true);
                  }}
                >
                  Ready — begin descent
                </button>
              </div>
            </div>
          )}
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
                    ? "LUNAR LANDING COMPLETE"
                    : hud.outcome === "hard_landing"
                      ? "Touchdown too fast"
                      : "Outside target circle"}
                </h3>
                <p className="mono">
                  Distance from target center: {hud.finalErrorM.toFixed(1)} m
                  (target ≤ {TARGET_CIRCLE_RADIUS_M} m) · Speed:{" "}
                  {hud.finalSpeedMs.toFixed(1)} m/s (game limit ≤{" "}
                  {SAFE_LANDING_SPEED_MS} m/s)
                </p>
                <div className="phase3-outcome-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={resetPhase3}
                  >
                    <RotateCcw size={15} />
                    Retry Phase 3
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={onRestartMission}
                  >
                    New mission (Phase 1)
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={onExitToEducation}
                  >
                    Return to Education
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="moon-hud-bottom edu-legend-bar">
          <div className="edu-legend-items">
            <span className="legend-dot-item">
              <i style={{ background: "#F43F5E" }} /> Your X (projected
              touchdown)
            </span>
            <span className="legend-dot-item">
              <i style={{ background: "#38BDF8" }} /> Guide arrows (grow as you
              approach)
            </span>
            <span className="legend-dot-item">
              <i style={{ background: "#10B981" }} /> Final landing circle
            </span>
          </div>
          <span className="pill pill-muted">
            Arrows/WASD: move · SPACE: brake and rise
          </span>
        </div>
      </div>

      <aside className="panel phase3-controls-card">
        <div className="panel-header">
          <div>
            <div className="eyebrow eyebrow-accent">LANDING INSTRUMENTS</div>
            <div className="panel-sub">
              Control the descent and hold SPACE to brake over{" "}
              {site.name.split("·")[0].trim()}
            </div>
          </div>
        </div>

        <div className="phase3-metrics-grid">
          <div className="kpi-box">
            <div className="kpi-label">Height above ground</div>
            <div className="kpi-value kpi-earth">{hud.altM.toFixed(1)} m</div>
          </div>
          <div className="kpi-box">
            <div className="kpi-label">Vertical speed</div>
            <div
              className={`kpi-value ${hud.vzMs > 0 ? "kpi-sun" : Math.abs(hud.vzMs) <= SAFE_LANDING_SPEED_MS ? "kpi-ok" : "kpi-sun"}`}
            >
              {hud.vzMs >= 0 ? `+${hud.vzMs.toFixed(1)}` : hud.vzMs.toFixed(1)}{" "}
              m/s
            </div>
          </div>
          <div className="kpi-box">
            <div className="kpi-label">Horizontal speed</div>
            <div className="kpi-value">
              {Math.hypot(hud.vxMs, hud.vyMs).toFixed(1)} m/s
            </div>
          </div>
          <div className="kpi-box">
            <div className="kpi-label">Predicted landing error</div>
            <div
              className={`kpi-value ${hud.alignedInCircle ? "kpi-ok" : "kpi-sun"}`}
            >
              {hud.predDistM.toFixed(1)} m
            </div>
          </div>
        </div>

        <div className="phase3-pad-box">
          <div className="eyebrow">RCS CONTROL (OR ↑ ↓ ← → / WASD)</div>
          <div className="phase3-dpad">
            <div />
            <button
              type="button"
              className="btn-secondary phase3-dpad-btn"
              {...bindTouchKey("up")}
              aria-label="Move up"
            >
              <ArrowUp size={16} />
            </button>
            <div />
            <button
              type="button"
              className="btn-secondary phase3-dpad-btn"
              {...bindTouchKey("left")}
              aria-label="Move left"
            >
              <ArrowLeft size={16} />
            </button>
            <button
              type="button"
              className="btn-secondary phase3-dpad-btn"
              {...bindTouchKey("down")}
              aria-label="Move down"
            >
              <ArrowDown size={16} />
            </button>
            <button
              type="button"
              className="btn-secondary phase3-dpad-btn"
              {...bindTouchKey("right")}
              aria-label="Move right"
            >
              <ArrowRight size={16} />
            </button>
          </div>

          <button
            type="button"
            className={`phase3-space-btn ${hud.spacePressed ? "active" : ""}`}
            {...bindTouchKey("space")}
          >
            <strong>[ SPACE ] BRAKE / RISE</strong>
            <span>
              {hud.spacePressed
                ? "Thruster active · Ground moves away"
                : "Hold to brake or gain altitude"}
            </span>
          </button>
        </div>

        <button type="button" className="btn-secondary" onClick={resetPhase3}>
          <RotateCcw size={14} />
          Restart approach (Phase 3)
        </button>
      </aside>
    </div>
  );
}
