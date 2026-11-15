import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Volume2 } from "lucide-react";
import { ILARGI_FUN_FACTS } from "../data/educationFacts";

interface IlargiMascotProps {
  message: string;
  speakerMood?: string;
  compact?: boolean;
  showFunFacts?: boolean;
}

export function IlargiMascot({
  message,
  speakerMood = "Lunar guide",
  compact = false,
  showFunFacts = true,
}: IlargiMascotProps) {
  const [factIdx, setFactIdx] = useState(() =>
    Math.floor(Math.random() * ILARGI_FUN_FACTS.length),
  );
  const [speaking, setSpeaking] = useState(true);
  const [bubbleMode, setBubbleMode] = useState<"guide" | "fact">(
    showFunFacts ? "fact" : "guide",
  );
  const initialMessage = useRef(true);

  useEffect(() => {
    if (initialMessage.current) initialMessage.current = false;
    else setBubbleMode("guide");
    setSpeaking(true);
    const timer = window.setTimeout(() => setSpeaking(false), 2600);
    return () => window.clearTimeout(timer);
  }, [message]);

  const handleTriggerFact = (delta: number) => {
    setBubbleMode("fact");
    setFactIdx((prev) =>
      bubbleMode === "guide" && delta === 1
        ? prev
        : (prev + delta + ILARGI_FUN_FACTS.length) % ILARGI_FUN_FACTS.length,
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
        title="Click to greet ILARGI"
      >
        <span className="ilargi-pulse-ring" aria-hidden="true" />
        <span className="ilargi-pulse-ring delay" aria-hidden="true" />
        <img
          src="/ilargi-mascot.png"
          alt="ILARGI mascot"
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
              {bubbleMode === "fact" ? "DID YOU KNOW?" : speakerMood}
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
                  Return to location
                </button>
              )}
              <button
                type="button"
                className="btn-mini"
                onClick={() => handleTriggerFact(-1)}
                title="Previous fact"
                aria-label="Previous fact"
              >
                <ChevronLeft size={13} />
              </button>
              <button
                type="button"
                className="btn-mini ilargi-fact-btn"
                onClick={() => handleTriggerFact(1)}
              >
                Did you know ({factIdx + 1}/{ILARGI_FUN_FACTS.length})
                <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
        {bubbleMode === "fact" && (
          <p className="ilargi-bubble-text">
            <strong>{activeFact.question}</strong>
          </p>
        )}
        {showFunFacts ? (
          <button
            type="button"
            className="ilargi-fact-next"
            onClick={() => handleTriggerFact(1)}
            aria-label="Next lunar discovery"
          >
            {shownText} <span aria-hidden="true"> →</span>
          </button>
        ) : (
          <p className="ilargi-bubble-text">{shownText}</p>
        )}
      </div>
    </div>
  );
}
