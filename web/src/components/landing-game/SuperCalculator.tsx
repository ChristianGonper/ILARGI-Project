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

  // Si cambia el punto seleccionado, reiniciamos los registros de la calculadora
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
        "Introduce tanto la latitud como la longitud con el teclado de la supercalculadora.";
      setStatusType("error");
      setStatusMsg(msg);
      onErrorFeedback(msg);
      return;
    }

    const latDiff = Math.abs(parsedLat - targetLatitudeDeg);
    const lonDiffRaw = Math.abs(parsedLon - targetLongitudeDeg);
    const lonDiff = Math.min(lonDiffRaw, Math.abs(lonDiffRaw - 360));

    if (latDiff > 0.6 || lonDiff > 0.6) {
      const msg = `Las coordenadas introducidas (${parsedLat.toFixed(2)}°, ${parsedLon.toFixed(2)}°E) no coinciden con el punto marcado en la superficie (${targetLatitudeDeg.toFixed(2)}°, ${targetLongitudeDeg.toFixed(2)}°E). ¡Revísalo y vuelve a calcular!`;
      setStatusType("error");
      setStatusMsg(msg);
      onErrorFeedback(msg);
      return;
    }

    const sol = solveInclinationForSite(
      targetLatitudeDeg,
      targetLongitudeDeg,
      orbitAltitudeKm,
      0,
    );
    setStatusType("ok");
    setStatusMsg(
      `Inclinación calculada: i = ${sol.requiredInclinationDeg.toFixed(2)}°`,
    );
    onCalculated(sol);
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
      aria-label="Supercalculadora Orbital"
    >
      <div className="supercalc-header">
        <div className="supercalc-title-row">
          <Calculator size={15} className="tag-earth" />
          <span className="eyebrow eyebrow-accent">
            SUPERCALCULADORA ORBITAL · ILARGI-CALC MK-I
          </span>
        </div>
        <span className="pill pill-cyan">Teclado activo</span>
      </div>

      <div className="supercalc-screen">
        <div className="supercalc-registers">
          <button
            type="button"
            className={`supercalc-reg ${activeField === "lat" ? "active" : ""}`}
            onClick={() => setActiveField("lat")}
          >
            <span className="supercalc-reg-label">LATITUD (φ) [°]</span>
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
            <span className="supercalc-reg-label">LONGITUD (λ) [°E]</span>
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
                  INCLINACIÓN ÓPTIMA:{" "}
                  <strong className="mono">
                    {solvedInclination.requiredInclinationDeg.toFixed(2)}°
                  </strong>
                </span>
              </div>
              <div className="supercalc-result-sub mono">
                Nodo Ω: {solvedInclination.ascendingNodeDeg.toFixed(1)}°E · ΔV
                plano: {solvedInclination.planeChangeDeltaVMs} m/s
              </div>
            </div>
          ) : statusType === "error" && statusMsg ? (
            <div className="supercalc-result-err">{statusMsg}</div>
          ) : (
            <div className="supercalc-result-hint">
              Pulsa un registro (LAT / LON) e introduce las coordenadas visibles
              en la Luna para calcular la inclinación.
            </div>
          )}
        </div>
      </div>

      <div
        className="supercalc-keypad"
        role="group"
        aria-label="Teclado numérico"
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
          title="Cambiar signo (+/-)"
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
          title="Borrar último dígito"
        >
          <Delete size={14} />
          Borrar
        </button>
        <button
          type="button"
          className="calc-key calc-key-fn"
          onClick={handleClear}
          title="Limpiar todo"
        >
          <RotateCcw size={13} />C
        </button>
        <button
          type="button"
          className="calc-key calc-key-fn"
          onClick={() => setActiveField((f) => (f === "lat" ? "lon" : "lat"))}
        >
          {activeField === "lat" ? "Ir a LON →" : "← Ir a LAT"}
        </button>
        <button
          type="button"
          className="calc-key calc-key-enter"
          onClick={handleCompute}
        >
          CALCULAR i°
        </button>
      </div>
    </div>
  );
}
