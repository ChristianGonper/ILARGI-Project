import { ArrowRight, Compass, GraduationCap, Microscope } from "lucide-react";
import type { AppMode, HealthResponse } from "../types";
import { IlargiMascot } from "./IlargiMascot";

interface HomeScreenProps {
  health: HealthResponse | null;
  onSelectMode: (mode: Exclude<AppMode, "home">) => void;
}

export function HomeScreen({ health, onSelectMode }: HomeScreenProps) {
  return (
    <div className="home-shell">
      <header className="home-topbar">
        <div className="topbar-left">
          <span className="brand-title">ILARGI</span>
          <span className="pill pill-cyan">
            NASA Space Apps · Lunar Explorer
          </span>
        </div>
        <span className={`pill ${health ? "pill-ok" : "pill-muted"}`}>
          {health
            ? `${health.kernels} · Connected`
            : "Connecting to the science engine…"}
        </span>
      </header>
      <main className="home-main">
        <section className="home-hero">
          <div className="eyebrow">
            Interactive Lunar Analyzer for Radiance, Geometry, and
            Intervisibility
          </div>
          <h1 className="home-title">
            Explore lunar light, shadows and motion
          </h1>
          <p className="home-lead">
            Choose a guided journey through the lunar day or examine sites,
            terrain horizons and visibility in the technical explorer.
          </p>
          <IlargiMascot
            speakerMood="Welcome aboard"
            message="I am ILARGI, your lunar guide. Follow the changing sunlight in Education, or compare lunar locations and export their results in PRO."
            compact
            showFunFacts={false}
          />
        </section>
        <section className="home-cards" aria-label="Choose an experience">
          <article className="mode-card mode-card-edu">
            <div className="mode-icon-badge edu">
              <GraduationCap size={30} />
            </div>
            <span className="pill pill-cyan">Learn · Explore</span>
            <h2>Education</h2>
            <p className="mode-desc">
              Follow a full lunar solar cycle, rotate the Moon, and discover how
              location changes the view.
            </p>
            <ul className="mode-features">
              <li>A moving day–night boundary over the lunar globe.</li>
              <li>
                Landing sites, illuminated ridges and polar shadow regions.
              </li>
              <li>Water-equivalent hydrogen and laser retroreflectors.</li>
              <li>A three-body view and an educational landing game.</li>
            </ul>
            <button
              className="btn-primary mode-cta"
              type="button"
              onClick={() => onSelectMode("education")}
            >
              <Compass size={16} /> Explore with ILARGI <ArrowRight size={16} />
            </button>
          </article>
          <article className="mode-card mode-card-pro">
            <div className="mode-icon-badge pro">
              <Microscope size={30} />
            </div>
            <span className="pill pill-ok">Science · Compare</span>
            <h2>PRO explorer</h2>
            <p className="mode-desc">
              Inspect the geometry behind each result and compare up to ten
              lunar locations.
            </p>
            <ul className="mode-features">
              <li>Select a catalog location or place a point on the globe.</li>
              <li>Compare apparent Sun and Earth tracks with LOLA terrain.</li>
              <li>
                Inspect visibility intervals, disc fractions and eclipses.
              </li>
              <li>Explore regional abundances and export CSV results.</li>
            </ul>
            <button
              className="btn-primary mode-cta"
              type="button"
              onClick={() => onSelectMode("pro")}
            >
              <Microscope size={16} /> Open the explorer{" "}
              <ArrowRight size={16} />
            </button>
          </article>
        </section>
      </main>
    </div>
  );
}
