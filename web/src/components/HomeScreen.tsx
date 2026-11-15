import { ArrowRight, Compass, Moon, Telescope } from "lucide-react";
import type { ReactNode } from "react";
import { DataSourcesLink } from "./DataSourcesLink";
import type { AppMode, HealthResponse } from "../types";

interface HomeScreenProps {
  health: HealthResponse | null;
  demoNotice: ReactNode;
  onSelectMode: (mode: Exclude<AppMode, "home">) => void;
}

export function HomeScreen({ onSelectMode, demoNotice }: HomeScreenProps) {
  return (
    <div className="home-shell">
      <header className="home-topbar">
        <span className="home-wordmark">
          <Moon size={24} aria-hidden="true" /> ILARGI
        </span>
        <span className="home-edition">
          A LUNAR EXPLORATION PROJECT <span> / </span> NASA SPACE APPS
        </span>
      </header>
      <main className="home-main">
        <div className="home-intro">
          <div className="home-kicker">
            <span /> AN OPEN WINDOW TO THE MOON
          </div>
          <h1>
            Look closer.
            <br />
            <em>Go further.</em>
          </h1>
          <p>
            Explore the light, landscape and stories of our nearest neighbour.
          </p>
          {demoNotice}
          <div className="home-coordinate">
            MOON <span> / </span> 384,400 KM FROM EARTH ON AVERAGE
          </div>
        </div>
        <div className="home-moon-art" aria-hidden="true">
          <div className="home-moon-orbit orbit-one" />
          <div className="home-moon-orbit orbit-two" />
          <div className="home-moon-disc" />
          <span className="home-moon-caption">
            THE MOON <b>01 / 01</b>
          </span>
        </div>
        <section className="home-choices" aria-label="Choose an experience">
          <div className="home-choices-label">
            CHOOSE YOUR EXPERIENCE <span>↗</span>
          </div>
          <button
            className="home-choice"
            type="button"
            onClick={() => onSelectMode("education")}
          >
            <span className="home-choice-number">01</span>
            <span className="home-choice-icon">
              <Compass size={23} />
            </span>
            <span className="home-choice-copy">
              <strong>Explore with ILARGI</strong>
              <small>Discover, experiment and land on the Moon.</small>
            </span>
            <ArrowRight className="home-choice-arrow" size={20} />
          </button>
          <button
            className="home-choice"
            type="button"
            onClick={() => onSelectMode("pro")}
          >
            <span className="home-choice-number">02</span>
            <span className="home-choice-icon">
              <Telescope size={23} />
            </span>
            <span className="home-choice-copy">
              <strong>Mission analysis</strong>
              <small>Investigate lunar sites, visibility and terrain.</small>
            </span>
            <ArrowRight className="home-choice-arrow" size={20} />
          </button>
        </section>
      </main>
      <footer className="home-footer">
        <span>
          ILARGI <i> / </i> INTERACTIVE LUNAR ANALYZER
        </span>
        <span>BUILT FOR THE CURIOUS</span>
        <DataSourcesLink />
      </footer>
    </div>
  );
}
