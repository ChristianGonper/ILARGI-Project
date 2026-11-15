import { useEffect, useState, type ReactNode } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
export function ViewportFrame({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", close);
    };
  }, [expanded]);
  return (
    <div className={`viewport-frame ${expanded ? "viewport-expanded" : ""}`}>
      <button
        type="button"
        className="btn-secondary viewport-expand"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        {expanded ? "Close large view (Esc)" : "Enlarge Moon"}
      </button>
      {children}
    </div>
  );
}
