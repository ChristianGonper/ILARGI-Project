import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Delete, Flame, Gauge, Rocket } from "lucide-react";
import { computePhase2Mechanics, type GameLandingSite } from "./gamePhysics";
import { LanderPortrait } from "./LanderPortrait";

interface Phase2DescentViewProps {
  site: GameLandingSite;
  onIlargiSpeak: (mood: string, text: string) => void;
  onCompletePhase2: () => void;
}

export function Phase2DescentView({
  site,
  onIlargiSpeak,
  onCompletePhase2,
}: Phase2DescentViewProps) {
  const mechanics = useMemo(
    () => computePhase2Mechanics(site.orbitAltitudeKm, site.landingGateKm),
    [site.orbitAltitudeKm, site.landingGateKm],
  );

  const [answerInput, setAnswerInput] = useState("");
  const [validated, setValidated] = useState(false);
  const [errorNote, setErrorNote] = useState<string | null>(null);
  const [burning, setBurning] = useState(false);
  const [burnProgress, setBurnProgress] = useState(0); // 0 -> 1
  const [burnDone, setBurnDone] = useState(false);

  const rafRef = useRef<number>(0);

  useEffect(() => {
    setAnswerInput("");
    setValidated(false);
    setErrorNote(null);
    setBurning(false);
    setBurnProgress(0);
    setBurnDone(false);
  }, [site.id]);

  useEffect(() => {
    if (!burning) return;
    const durationMs = 3600;
    const startTs = performance.now();

    const tick = (now: number) => {
      const p = Math.min(1, (now - startTs) / durationMs);
      setBurnProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setBurning(false);
        setBurnDone(true);
        onIlargiSpeak(
          "Entering Phase 3",
          "Descent maneuver complete. Final landing altitude reached; activating the downward camera.",
        );
        window.setTimeout(() => {
          onCompletePhase2();
        }, 1250);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [burning, onCompletePhase2, onIlargiSpeak]);

  const handleDigit = (d: string) => {
    if (validated || burning) return;
    if (d === "." && answerInput.includes(".")) return;
    if (answerInput.length >= 7) return;
    setErrorNote(null);
    setAnswerInput((prev) => (d === "." && prev === "" ? "0." : `${prev}${d}`));
  };

  const handleBackspace = () => {
    if (validated || burning) return;
    setErrorNote(null);
    setAnswerInput((prev) => prev.slice(0, -1));
  };

  const handleValidate = () => {
    if (burning || burnDone) return;
    const val = Number.parseFloat(answerInput);
    if (!Number.isFinite(val)) {
      const msg =
        "Enter the required descent distance in kilometers before starting the maneuver.";
      setErrorNote(msg);
      onIlargiSpeak("Check the calculation", msg);
      return;
    }

    if (Math.abs(val - mechanics.descentDeltaKm) > 0.25) {
      const msg = `That value (${val} km) does not match. Subtract orbital altitude (${mechanics.orbitAltitudeKm} km) − transition altitude (${mechanics.landingGateKm} km).`;
      setErrorNote(msg);
      onIlargiSpeak("Almost there", msg);
      return;
    }

    setValidated(true);
    setErrorNote(null);
    onIlargiSpeak(
      "Correct calculation",
      `Correct: ${mechanics.descentDeltaKm} km descent. Required ΔV is ${mechanics.totalDescentDeltaVMs.toLocaleString("en-GB")} m/s. Press the launch button to start the maneuver.`,
    );
  };

  const handleLaunchDescent = () => {
    if (!validated || burning || burnDone) return;
    setBurning(true);
    onIlargiSpeak(
      "Retropropulsion active",
      "Watch altitude and velocity change during the maneuver to the final landing gate.",
    );
  };

  const liveTelemetry = useMemo(() => {
    if (!burning && !burnDone) {
      return {
        altitudeKm: mechanics.orbitAltitudeKm,
        speedMs: mechanics.initialSpeedMs,
        deltaVRemainingMs: mechanics.totalDescentDeltaVMs,
        deltaVUsedMs: 0,
        phaseLabel: validated
          ? "READY FOR RETRO BURN"
          : "WAITING FOR DESCENT CALCULATION",
      };
    }

    const p = burnDone ? 1 : burnProgress;
    // Dos sub-tramos:

    if (p < 0.55) {
      const k = p / 0.55;
      const eased = 1 - Math.pow(1 - k, 1.8);
      const alt =
        mechanics.orbitAltitudeKm -
        (mechanics.orbitAltitudeKm - mechanics.landingGateKm) * eased;
      const spd =
        mechanics.initialSpeedMs +
        (mechanics.periluneSpeedMs - mechanics.initialSpeedMs) * eased;
      const used = Math.round(mechanics.deorbitBurnDeltaVMs + k * 45);
      return {
        altitudeKm: alt,
        speedMs: Math.round(spd),
        deltaVRemainingMs: Math.max(0, mechanics.totalDescentDeltaVMs - used),
        deltaVUsedMs: used,
        phaseLabel: "STAGE 1 · ELLIPTICAL TRANSFER",
      };
    } else {
      const k = (p - 0.55) / 0.45;
      const eased = k * k * (3 - 2 * k);
      const alt = mechanics.landingGateKm * (1 - eased) + 0.32 * eased;
      const spd = Math.round(
        mechanics.periluneSpeedMs * (1 - eased) + 6 * eased,
      );
      const used = Math.round(
        mechanics.deorbitBurnDeltaVMs +
          45 +
          (mechanics.totalDescentDeltaVMs -
            mechanics.deorbitBurnDeltaVMs -
            45) *
            eased,
      );
      return {
        altitudeKm: alt,
        speedMs: spd,
        deltaVRemainingMs: Math.max(0, mechanics.totalDescentDeltaVMs - used),
        deltaVUsedMs: used,
        phaseLabel: "STAGE 2 · RETROPROPULSIVE BRAKING",
      };
    }
  }, [burning, burnDone, burnProgress, mechanics, validated]);

  const landerProgress = burnDone ? 1 : burning ? burnProgress : 0;
  const landerSvgX = 90 + landerProgress * 460;
  const landerSvgY = 65 + Math.pow(landerProgress, 1.35) * 195;

  return (
    <div className="phase2-grid">
      <div className="panel phase2-control-card">
        <div className="panel-header">
          <div>
            <div className="eyebrow eyebrow-accent">
              PHASE 2 · DESCENT AND ΔV
            </div>
            <div className="panel-sub">
              Subtract final altitude from orbital altitude to plan the descent.
            </div>
          </div>
          <span className="pill pill-cyan">
            {site.name.split("·")[0].trim()}
          </span>
        </div>

        <div className="phase2-alt-cards">
          <div className="phase2-alt-box">
            <span className="kpi-label">Current orbital altitude</span>
            <span className="kpi-value kpi-earth">
              {mechanics.orbitAltitudeKm} km
            </span>
            <span className="kpi-sub">
              {(mechanics.orbitAltitudeKm * 1000).toLocaleString("en-GB")} m
            </span>
          </div>

          <div className="phase2-minus-sign">−</div>

          <div className="phase2-alt-box">
            <span className="kpi-label">Phase 3 entry altitude (Landing)</span>
            <span className="kpi-value kpi-sun">
              {mechanics.landingGateKm} km
            </span>
            <span className="kpi-sub">
              {(mechanics.landingGateKm * 1000).toLocaleString("en-GB")} m
            </span>
          </div>
        </div>

        <div className="phase2-calc-prompt">
          <label className="field">
            <span>How far must the lander descend? (Orbit − Phase 3 gate)</span>
            <div className="phase2-input-row">
              <input
                type="text"
                inputMode="decimal"
                value={answerInput}
                disabled={validated || burning || burnDone}
                placeholder="e.g. 100"
                onChange={(e) => {
                  setErrorNote(null);
                  setAnswerInput(e.target.value.replace(/[^0-9.]/g, ""));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleValidate();
                }}
              />
              <span className="pill pill-muted">km</span>
              <button
                type="button"
                className="btn-primary"
                disabled={validated || burning || burnDone}
                onClick={handleValidate}
              >
                {validated ? (
                  <>
                    <CheckCircle2 size={15} /> Correct
                  </>
                ) : (
                  "Check subtraction"
                )}
              </button>
            </div>
          </label>

          {!validated && (
            <div className="phase2-mini-keypad">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "."].map(
                (d) => (
                  <button
                    key={d}
                    type="button"
                    className="calc-key"
                    onClick={() => handleDigit(d)}
                  >
                    {d}
                  </button>
                ),
              )}
              <button
                type="button"
                className="calc-key calc-key-fn"
                onClick={handleBackspace}
                aria-label="Delete digit"
              >
                <Delete size={14} />
              </button>
            </div>
          )}

          {errorNote && <div className="supercalc-result-err">{errorNote}</div>}
        </div>

        {/* TELEMETRÍA VELOCIDAD (m/s) Y ΔV NECESARIO */}
        <div className="phase2-telemetry-strip">
          <div className="phase2-telem-item">
            <span className="kpi-label">
              <Gauge size={12} /> Current speed
            </span>
            <span className="kpi-value mono">
              {liveTelemetry.speedMs.toLocaleString("en-GB")} <small>m/s</small>
            </span>
          </div>
          <div className="phase2-telem-item">
            <span className="kpi-label">
              <Flame size={12} /> Total required ΔV
            </span>
            <span className="kpi-value kpi-sun mono">
              {mechanics.totalDescentDeltaVMs.toLocaleString("en-GB")}{" "}
              <small>m/s</small>
            </span>
          </div>
          <div className="phase2-telem-item">
            <span className="kpi-label">Remaining ΔV</span>
            <span className="kpi-value kpi-ok mono">
              {liveTelemetry.deltaVRemainingMs.toLocaleString("en-GB")}{" "}
              <small>m/s</small>
            </span>
          </div>
        </div>

        {/* BOTÓN ROJO CON UN COHETE */}
        <button
          type="button"
          className={`red-rocket-btn ${validated && !burning && !burnDone ? "ready" : ""} ${burning ? "burning" : ""}`}
          disabled={!validated || burning || burnDone}
          onClick={handleLaunchDescent}
        >
          <span className="red-rocket-icon-wrap">
            <Rocket size={24} />
          </span>
          <span className="red-rocket-label">
            <strong>
              {burnDone
                ? "ENTERING PHASE 3…"
                : burning
                  ? "DESCENT MANEUVER IN PROGRESS…"
                  : "START POWERED DESCENT"}
            </strong>
            <small>
              {validated
                ? `Descend ${mechanics.descentDeltaKm} km · ΔV ${mechanics.totalDescentDeltaVMs} m/s`
                : "First check the altitude subtraction above"}
            </small>
          </span>
        </button>
      </div>

      <div className="panel phase2-visual-card">
        <div className="moon-hud-top">
          <div className="moon-hud-pills">
            <span className="pill pill-cyan">{liveTelemetry.phaseLabel}</span>
            <span className="pill pill-muted">
              Altitude:{" "}
              {liveTelemetry.altitudeKm >= 1
                ? `${liveTelemetry.altitudeKm.toFixed(1)} km`
                : `${Math.round(liveTelemetry.altitudeKm * 1000)} m`}
            </span>
          </div>
          <span className="pill pill-amber mono">
            v = {liveTelemetry.speedMs.toLocaleString("en-GB")} m/s
          </span>
        </div>

        <div className="phase2-svg-stage">
          <svg
            viewBox="0 0 640 330"
            className="phase2-descent-svg"
            role="img"
            aria-label="Orbital descent illustration toward the lunar surface"
          >
            <defs>
              <clipPath id="descentSurfaceClip">
                <path d="M -20 330 Q 320 245 660 330 Z" />
              </clipPath>
              <radialGradient id="moonHorizonGrad" cx="50%" cy="130%" r="90%">
                <stop offset="0%" stopColor="#b7b5ae" />
                <stop offset="45%" stopColor="#565b65" />
                <stop offset="100%" stopColor="#0f172a" />
              </radialGradient>
              <linearGradient id="trajGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="60%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>

            {/* Fondo estrellado */}
            <rect width="640" height="330" fill="#060a12" />
            {[
              [42, 34],
              [120, 82],
              [210, 26],
              [310, 52],
              [425, 30],
              [518, 66],
              [590, 42],
              [165, 130],
              [485, 128],
            ].map(([sx, sy], i) => (
              <circle
                key={i}
                cx={sx}
                cy={sy}
                r={i % 2 === 0 ? 1.5 : 1}
                fill="#cbd5e1"
                opacity="0.55"
              />
            ))}

            <path
              d="M 40 65 Q 320 48 600 72"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.5"
              strokeDasharray="6 6"
              opacity="0.55"
            />
            <text
              x="46"
              y="52"
              fill="#38bdf8"
              fontSize="11"
              fontFamily="JetBrains Mono, monospace"
            >
              PARKING ORBIT ({mechanics.orbitAltitudeKm} km)
            </text>

            {/* Superficie lunar curva */}
            <path
              d="M -20 330 Q 320 245 660 330 Z"
              fill="url(#moonHorizonGrad)"
              stroke="#64748b"
              strokeWidth="1.5"
            />

            <image
              href="/textures/moon_color.jpg"
              x="-20"
              y="245"
              width="680"
              height="150"
              preserveAspectRatio="xMidYMid slice"
              opacity="0.45"
              clipPath="url(#descentSurfaceClip)"
            />
            <ellipse
              cx="190"
              cy="296"
              rx="28"
              ry="7"
              fill="#1e293b"
              stroke="#475569"
              strokeWidth="1"
            />
            <ellipse
              cx="410"
              cy="288"
              rx="20"
              ry="5"
              fill="#1e293b"
              stroke="#475569"
              strokeWidth="1"
            />

            {/* Surface target */}
            <circle
              cx="550"
              cy="282"
              r="7"
              fill="rgba(16, 185, 129, 0.16)"
              stroke="#10b981"
              strokeWidth="2"
            />
            <circle cx="550" cy="282" r="2" fill="#c4b5fd" />
            <text
              x="550"
              y="309"
              textAnchor="middle"
              fill="#10b981"
              fontSize="11"
              fontFamily="JetBrains Mono, monospace"
            >
              PHASE 3 GATE ({mechanics.landingGateKm} km)
            </text>

            <path
              d="M 90 65 C 260 68, 430 140, 550 260"
              fill="none"
              stroke="url(#trajGrad)"
              strokeWidth="2.5"
              strokeDasharray="5 4"
            />

            {/* Illustrative descent: reuse the same lander as the orbital view. */}
            <g transform={`translate(${landerSvgX}, ${landerSvgY})`}>
              {burning && (
                <path
                  d="M -4 12 L 0 30 L 4 12 Z"
                  fill="#f59e0b"
                  opacity="0.9"
                />
              )}
              <foreignObject x="-32" y="-36" width="64" height="64">
                <LanderPortrait />
              </foreignObject>
            </g>
          </svg>
        </div>

        <div className="phase2-progress-bar-wrap">
          <div className="phase2-progress-meta mono">
            <span>Orbital descent progress</span>
            <span>{Math.round(landerProgress * 100)}%</span>
          </div>
          <div className="phase2-progress-track">
            <div
              className="phase2-progress-fill"
              style={{ width: `${landerProgress * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
