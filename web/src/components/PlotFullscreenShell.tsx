import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2 } from "lucide-react";

interface PlotFullscreenShellProps {
  title: string;
  subtitle?: string;
  height: number;
  children: (renderHeight: number, isFullscreen: boolean) => ReactNode;
}

function computeFullscreenHeight(): number {
  if (typeof window === "undefined") return 640;
  return Math.max(420, window.innerHeight - 132);
}

export function PlotFullscreenShell({
  title,
  subtitle,
  height,
  children,
}: PlotFullscreenShellProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [modalHeight, setModalHeight] = useState<number>(
    computeFullscreenHeight,
  );

  useEffect(() => {
    if (!isFullscreen) return;

    const handleResize = () => {
      setModalHeight(computeFullscreenHeight());
    };
    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        setIsFullscreen(false);
      }
    };

    handleResize();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen]);

  return (
    <>
      <div className="plot-shell">
        <div className="plot-shell-bar">
          <div className="chart-title">{title}</div>
          <button
            type="button"
            className="btn-mini plot-expand-btn"
            onClick={() => setIsFullscreen(true)}
            title={`Expand "${title}" to fullscreen`}
            aria-label={`Expand ${title} to fullscreen`}
          >
            <Maximize2 size={12} />
            <span>Expand</span>
          </button>
        </div>
        {!isFullscreen && children(height, false)}
      </div>

      {isFullscreen &&
        createPortal(
          <div
            className="plot-fullscreen-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={() => setIsFullscreen(false)}
          >
            <div
              className="plot-fullscreen-modal"
              onClick={(ev) => ev.stopPropagation()}
            >
              <div className="plot-fullscreen-head">
                <div>
                  <div className="chart-title">{title}</div>
                  {subtitle && <div className="mono-sub">{subtitle}</div>}
                </div>
                <button
                  type="button"
                  className="btn-secondary btn-compact"
                  onClick={() => setIsFullscreen(false)}
                  title="Exit fullscreen (Esc)"
                  aria-label="Close expanded view"
                >
                  <Minimize2 size={14} />
                  <span>Close (Esc)</span>
                </button>
              </div>
              <div className="plot-fullscreen-body">
                {children(modalHeight, true)}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
