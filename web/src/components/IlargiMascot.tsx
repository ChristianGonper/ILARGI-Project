import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles, Volume2 } from "lucide-react";
import { ILARGI_FUN_FACTS } from "../data/educationFacts";

interface IlargiMascotProps {
  message: string;
  speakerMood?: string;
  compact?: boolean;
  showFunFacts?: boolean;
}

export function IlargiMascot({
  message,
  speakerMood = "Guía lunar",
  compact = false,
  showFunFacts = true,
}: IlargiMascotProps) {
  const [factIdx, setFactIdx] = useState(0);
  const [speaking, setSpeaking] = useState(true);
  const [bubbleMode, setBubbleMode] = useState<"guide" | "fact">("guide");

  // Cuando cambia el mensaje contextual, volvemos a la voz guía y activamos animación de habla.
  useEffect(() => {
    setBubbleMode("guide");
    setSpeaking(true);
    const timer = window.setTimeout(() => setSpeaking(false), 2600);
    return () => window.clearTimeout(timer);
  }, [message]);

  const handleTriggerFact = (delta: number) => {
    setBubbleMode("fact");
    setFactIdx(
      (prev) =>
        (prev + delta + ILARGI_FUN_FACTS.length) % ILARGI_FUN_FACTS.length,
    );
    setSpeaking(true);
    window.setTimeout(() => setSpeaking(false), 2400);
  };

  const activeFact = ILARGI_FUN_FACTS[factIdx];
  const shownText = bubbleMode === "fact" ? activeFact.text : message;

  return (
    <div className={`ilargi-mascot-wrap ${compact ? "compact" : ""}`}>
      <button
        type="button"
        className={`ilargi-avatar-stage ${speaking ? "is-speaking" : ""}`}
        onClick={() => {
          setSpeaking(true);
          window.setTimeout(() => setSpeaking(false), 1800);
        }}
        title="Pulsa para saludar a ILARGI"
      >
        <span className="ilargi-pulse-ring" aria-hidden="true" />
        <span className="ilargi-pulse-ring delay" aria-hidden="true" />
        <img
          src="/ilargi-mascot.png"
          alt="Mascota ILARGI"
          className="ilargi-avatar-img"
        />
        <span className="ilargi-nameplate">
          ILARGI
          {speaking && (
            <span className="ilargi-voice-bars" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          )}
        </span>
      </button>

      <div className="ilargi-bubble">
        <div className="ilargi-bubble-tail" aria-hidden="true" />
        <div className="ilargi-bubble-head">
          <div className="ilargi-bubble-badges">
            <span className="pill pill-cyan">
              <Volume2 size={11} />{" "}
              {bubbleMode === "fact"
                ? `¿Y sabías qué…? · ${activeFact.tag}`
                : speakerMood}
            </span>
          </div>
          {showFunFacts && (
            <div className="ilargi-fact-controls">
              {bubbleMode === "fact" && (
                <button
                  type="button"
                  className="btn-mini"
                  onClick={() => setBubbleMode("guide")}
                >
                  Volver al punto
                </button>
              )}
              <button
                type="button"
                className="btn-mini"
                onClick={() => handleTriggerFact(-1)}
                title="Dato anterior"
                aria-label="Dato curioso anterior"
              >
                <ChevronLeft size={13} />
              </button>
              <button
                type="button"
                className="btn-mini ilargi-fact-btn"
                onClick={() => handleTriggerFact(1)}
              >
                <Sparkles size={12} />
                ¿Y sabías qué…? ({factIdx + 1}/{ILARGI_FUN_FACTS.length})
                <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
        <p className="ilargi-bubble-text">{shownText}</p>
      </div>
    </div>
  );
}
