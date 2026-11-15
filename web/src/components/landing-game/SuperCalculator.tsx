import { useEffect, useState } from "react";
import { Calculator, CheckCircle2, Delete, RotateCcw } from "lucide-react";
import {
  solveInclinationForSite,
  type PlaneChangeSolution,
} from "./gamePhysics";

interface SuperCalculatorProps {
  targetLatitudeDeg: number;
  targetLongitudeDeg: number;
  orbitAltitudeKm: number;
  solvedInclination: PlaneChangeSolution | null;
  onCalculated: (solution: PlaneChangeSolution) => void;
  onErrorFeedback: (msg: string) => void;
}

type ActiveField = "lat" | "lon";

export function SuperCalculator({
  targetLatitudeDeg,
  targetLongitudeDeg,
  orbitAltitudeKm,
  solvedInclination,
  onCalculated,
  onErrorFeedback,
}: SuperCalculatorProps) {
  const [activeField, setActiveField] = useState<ActiveField>("lat");
  const [latInput, setLatInput] = useState("");
  const [lonInput, setLonInput] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<"idle" | "error" | "ok">("idle");

  useEffect(() => {
    setLatInput("");
    setLonInput("");
    setActiveField("lat");
    setStatusMsg(null);
    setStatusType("idle");
  }, [targetLatitudeDeg, targetLongitudeDeg]);

  const currentVal = activeField === "lat" ? latInput : lonInput;
  const setCurrentVal = (next: string) => {
    if (activeField === "lat") {
      setLatInput(next);
    } else {
      setLonInput(next);
    }
    setStatusType("idle");
    setStatusMsg(null);
  };

  const handleDigit = (ch: string) => {
    if (ch === ".") {
      if (currentVal.includes(".")) return;
      setCurrentVal(
        currentVal === "" || currentVal === "-"
          ? `${currentVal}0.`
          : `${currentVal}.`,
      );
      return;
    }
    if (currentVal.length >= 9) return;
    setCurrentVal(`${currentVal}${ch}`);
  };

  const handleToggleSign = () => {
    if (currentVal.startsWith("-")) {
      setCurrentVal(currentVal.slice(1));
    } else {
      setCurrentVal(`-${currentVal}`);
    }
  };

  const handleBackspace = () => {
    setCurrentVal(currentVal.slice(0, -1));
  };

  const handleClear = () => {
    setLatInput("");
    setLonInput("");
    setActiveField("lat");
    setStatusMsg(null);
    setStatusType("idle");
  };

  const handleCompute = () => {
    const parsedLat = Number.parseFloat(latInput);
    const parsedLon = Number.parseFloat(lonInput);

    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)) {
      const msg =
        "Enter both latitude and longitude using the calculator keypad.";
      setStatusType("error");
      setStatusMsg(msg);
      onErrorFeedback(msg);
      return;
    }

    const latDiff = Math.abs(parsedLat - targetLatitudeDeg);
    const lonDiffRaw = Math.abs(parsedLon - targetLongitudeDeg);
    const lonDiff = Math.min(lonDiffRaw, Math.abs(lonDiffRaw - 360));

    if (latDiff > 0.6 || lonDiff > 0.6) {
      const msg = `The entered coordinates (${parsedLat.toFixed(2)}°, ${parsedLon.toFixed(2)}°E) do not match the marked surface location (${targetLatitudeDeg.toFixed(2)}°, ${targetLongitudeDeg.toFixed(2)}°E). Check them and calculate again.`;
      setStatusType("error");
      setStatusMsg(msg);
      onErrorFeedback(msg);
      return;
    }

    const solution = solveInclinationForSite(
      targetLatitudeDeg,
      targetLongitudeDeg,
      orbitAltitudeKm,
      0,
    );
    setStatusType("ok");
    setStatusMsg(
      `Calculated inclination: i = ${solution.requiredInclinationDeg.toFixed(2)}°`,
    );
    onCalculated(solution);
  };

  const handleKeyDown = (ev: React.KeyboardEvent<HTMLDivElement>) => {
    if (ev.key >= "0" && ev.key <= "9") {
      ev.preventDefault();
      handleDigit(ev.key);
    } else if (ev.key === "." || ev.key === ",") {
      ev.preventDefault();
      handleDigit(".");
    } else if (ev.key === "-") {
      ev.preventDefault();
      handleToggleSign();
    } else if (ev.key === "Backspace") {
      ev.preventDefault();
      handleBackspace();
    } else if (ev.key === "Tab") {
      ev.preventDefault();
      setActiveField((f) => (f === "lat" ? "lon" : "lat"));
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      handleCompute();
    }
  };

  return (
    <div
      className="supercalc-shell"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="Orbital calculator"
    >
      <div className="supercalc-header">
        <div className="supercalc-title-row">
          <Calculator size={15} className="tag-earth" />
          <span className="eyebrow eyebrow-accent">
            ORBITAL CALCULATOR · ILARGI-CALC MK-I
          </span>
        </div>
        <span className="pill pill-cyan">Keyboard active</span>
      </div>

      <div className="supercalc-screen">
        <div className="supercalc-registers">
          <button
            type="button"
            className={`supercalc-reg ${activeField === "lat" ? "active" : ""}`}
            onClick={() => setActiveField("lat")}
          >
            <span className="supercalc-reg-label">LATITUDE (φ) [°]</span>
            <span className="supercalc-reg-val mono">
              {latInput === "" ? "___.__" : latInput}
              {activeField === "lat" && <span className="calc-cursor">▌</span>}
            </span>
          </button>

          <button
            type="button"
            className={`supercalc-reg ${activeField === "lon" ? "active" : ""}`}
            onClick={() => setActiveField("lon")}
          >
            <span className="supercalc-reg-label">LONGITUDE (λ) [°E]</span>
            <span className="supercalc-reg-val mono">
              {lonInput === "" ? "___.__" : lonInput}
              {activeField === "lon" && <span className="calc-cursor">▌</span>}
            </span>
          </button>
        </div>

        <div className="supercalc-output">
          {solvedInclination ? (
            <div className="supercalc-result-ok">
              <div className="supercalc-result-main">
                <CheckCircle2 size={16} className="tag-ok" />
                <span>
                  REQUIRED INCLINATION:{" "}
                  <strong className="mono">
                    {solvedInclination.requiredInclinationDeg.toFixed(2)}°
                  </strong>
                </span>
              </div>
              <div className="supercalc-result-sub mono">
                Node Ω: {solvedInclination.ascendingNodeDeg.toFixed(1)}°E ·
                Plane-change ΔV: {solvedInclination.planeChangeDeltaVMs} m/s
              </div>
            </div>
          ) : statusType === "error" && statusMsg ? (
            <div className="supercalc-result-err">{statusMsg}</div>
          ) : (
            <div className="supercalc-result-hint">
              Select LAT or LON and enter the displayed coordinates on the Moon
              to calculate the inclination.
            </div>
          )}
        </div>
      </div>

      <div
        className="supercalc-keypad"
        role="group"
        aria-label="Numeric keypad"
      >
        {["7", "8", "9", "4", "5", "6", "1", "2", "3"].map((digit) => (
          <button
            key={digit}
            type="button"
            className="calc-key"
            onClick={() => handleDigit(digit)}
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          className="calc-key calc-key-fn"
          onClick={handleToggleSign}
          title="Change sign (+/-)"
        >
          +/−
        </button>
        <button
          type="button"
          className="calc-key"
          onClick={() => handleDigit("0")}
        >
          0
        </button>
        <button
          type="button"
          className="calc-key"
          onClick={() => handleDigit(".")}
        >
          .
        </button>
      </div>

      <div className="supercalc-actions">
        <button
          type="button"
          className="calc-key calc-key-fn"
          onClick={handleBackspace}
          title="Delete last digit"
        >
          <Delete size={14} />
          Delete
        </button>
        <button
          type="button"
          className="calc-key calc-key-fn"
          onClick={handleClear}
          title="Clear all"
        >
          <RotateCcw size={13} />C
        </button>
        <button
          type="button"
          className="calc-key calc-key-fn"
          onClick={() => setActiveField((f) => (f === "lat" ? "lon" : "lat"))}
        >
          {activeField === "lat" ? "Go to LON →" : "← Go to LAT"}
        </button>
        <button
          type="button"
          className="calc-key calc-key-enter"
          onClick={handleCompute}
        >
          CALCULATE i°
        </button>
      </div>
    </div>
  );
}
