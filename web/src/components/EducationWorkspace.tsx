import { ViewportFrame } from "./ViewportFrame";
import { useEffect, useMemo, useState } from "react";
import {
  Crosshair,
  Droplets,
  Eye,
  Globe,
  Play,
  Rocket,
  RotateCcw,
  Sun,
  X,
} from "lucide-react";
import {
  fetchEducationCycle,
  fetchEducationSites,
  interpolateEducationFrame,
} from "../api";
import { SpacecraftGuide } from "./SpacecraftGuide";
import { LUNAR_MIRROR_GUIDE } from "../data/educationFacts";
import type {
  EducationCategory,
  EducationCycleResponse,
  EducationSite,
} from "../types";
import { EducationMoonViewport3D } from "./EducationMoonViewport3D";
import { IlargiMascot } from "./IlargiMascot";
import { LunarLandingGame } from "./landing-game/LunarLandingGame";
import {
  LUNAR_PHASES,
  ThreeBodyOrbitMini,
  detectLunarPhase,
  findPhaseFrameHours,
  phaseLabelFromKey,
  type LunarPhaseKey,
} from "./ThreeBodyOrbitMini";

type SiteFilterId = "all" | "light_shadow" | "landing" | "mirror";

const FILTER_OPTIONS: {
  id: SiteFilterId;
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "light_shadow", label: "Light & Shadow" },
  { id: "landing", label: "Landing" },
  { id: "mirror", label: "Reflectors" },
];

const CATEGORY_BADGE_CLASS: Record<EducationCategory, string> = {
  eternal_light: "pill-amber",
  psr: "pill-cyan",
  landing: "pill-violet",
  mirror: "pill-ok",
};

const CATEGORY_SHORT_LABEL: Record<EducationCategory, string> = {
  eternal_light: "Illuminated",
  psr: "Shadow",
  landing: "Landing",
  mirror: "Reflector",
};

const CATEGORY_DOT_COLOR: Record<EducationCategory, string> = {
  eternal_light: "#F59E0B",
  psr: "#22D3EE",
  landing: "#C4B5FD",
  mirror: "#10B981",
};

function formatCoords(lat: number, lon: number): string {
  const latHem = lat >= 0 ? "N" : "S";
  const lonHem = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}° ${latHem}, ${Math.abs(lon).toFixed(2)}° ${lonHem}`;
}

function MoonPhaseGlyph({ phase }: { phase: LunarPhaseKey }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="edu-phase-glyph"
    >
      <circle
        cx="12"
        cy="12"
        r="9.5"
        fill="#141814"
        stroke="#94a3b8"
        strokeWidth="1.5"
      />
      {phase === "full_moon" && (
        <circle cx="12" cy="12" r="8.5" fill="#f1f5f9" />
      )}
      {phase === "first_quarter" && (
        <path d="M12 2.5 A9.5 9.5 0 0 1 12 21.5 Z" fill="#f1f5f9" />
      )}
      {phase === "last_quarter" && (
        <path d="M12 2.5 A9.5 9.5 0 0 0 12 21.5 Z" fill="#f1f5f9" />
      )}
    </svg>
  );
}

export function EducationWorkspace() {
  const [sites, setSites] = useState<EducationSite[]>([]);
  const [siteFilter, setSiteFilter] = useState<SiteFilterId>("all");
  const [selectedSite, setSelectedSite] = useState<EducationSite | null>(null);
  const [manualCoords, setManualCoords] = useState<{
    latitudeDeg: number;
    longitudeEastDeg: number;
  } | null>(null);
  const [pinMode, setPinMode] = useState(false);
  const [focusTrigger, setFocusTrigger] = useState(0);
  const [nearSideTrigger, setNearSideTrigger] = useState(0);
  const [cycleData, setCycleData] = useState<EducationCycleResponse | null>(
    null,
  );
  const [loadingCycle, setLoadingCycle] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hoursOffset, setHoursOffset] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showWaterLayer, setShowWaterLayer] = useState(false);
  const [showMirrorGuide, setShowMirrorGuide] = useState(false);
  const [gameActive, setGameActive] = useState(false);
  const [ilargiOverride, setIlargiOverride] = useState<{
    mood: string;
    text: string;
  } | null>(null);

  const animationSpeedHoursPerSec = 40;

  useEffect(() => {
    void fetchEducationSites()
      .then((list) => {
        // Keep one illuminated and one shadow example per hemisphere for clean polar coverage.
        const seen = new Set<string>();
        list = list.filter((site) => {
          if (site.category !== "eternal_light" && site.category !== "psr")
            return true;
          const key = `${site.category}-${site.latitude_deg < 0 ? "south" : "north"}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setSites(list);
        if (list.length > 0) {
          setSelectedSite(list[0]);
        }
      })
      .catch((err: unknown) => {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : "Could not load educational locations",
        );
      });
  }, []);

  const activeLat =
    manualCoords?.latitudeDeg ?? selectedSite?.latitude_deg ?? -89.45;
  const activeLon =
    manualCoords?.longitudeEastDeg ??
    selectedSite?.longitude_east_deg ??
    -137.31;

  useEffect(() => {
    let cancelled = false;
    setCycleData(null);
    setPlaying(false);
    setHoursOffset(0);
    setLoadingCycle(true);
    setErrorMsg(null);
    void fetchEducationCycle({
      latitudeDeg: activeLat,
      longitudeEastDeg: activeLon,
      startDate: "2026-04-02",
      startTime: "15:00",
      durationHours: 709.0,
      stepMinutes: 180,
    })
      .then((data) => {
        if (!cancelled) {
          setCycleData(data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setErrorMsg(
            err instanceof Error
              ? err.message
              : "Could not calculate lunar cycle",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCycle(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeLat, activeLon]);

  const maxHours = cycleData?.duration_hours ?? 709.0;

  useEffect(() => {
    if (!playing || !cycleData) return;
    let rafId = 0;
    let lastTs = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastTs) / 1000);
      lastTs = now;
      let finished = false;
      setHoursOffset((prev) => {
        const next = prev + dt * animationSpeedHoursPerSec;
        if (next >= maxHours) {
          finished = true;
          return maxHours;
        }
        return next;
      });
      if (finished) {
        setPlaying(false);
        return;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [playing, cycleData, maxHours]);

  const currentFrame = useMemo(() => {
    if (!cycleData) return null;
    return interpolateEducationFrame(cycleData.frames, hoursOffset);
  }, [cycleData, hoursOffset]);

  const currentPhase = useMemo(
    () => detectLunarPhase(cycleData?.frames ?? [], hoursOffset, currentFrame),
    [cycleData?.frames, hoursOffset, currentFrame],
  );

  const filteredSites = useMemo(() => {
    if (siteFilter === "all") return sites;
    if (siteFilter === "light_shadow") {
      return sites.filter(
        (s) => s.category === "eternal_light" || s.category === "psr",
      );
    }
    return sites.filter((s) => s.category === siteFilter);
  }, [sites, siteFilter]);

  const handleSelectSite = (site: EducationSite) => {
    setManualCoords(null);
    setSelectedSite(site);
    setPinMode(false);
    setShowMirrorGuide(site.category === "mirror");
    setIlargiOverride({
      mood: site.category_label,
      text: site.ilargi_story,
    });
  };

  const handleSurfacePick = (latitudeDeg: number, longitudeEastDeg: number) => {
    setManualCoords({ latitudeDeg, longitudeEastDeg });
    setPinMode(false);
    const isPolar = Math.abs(latitudeDeg) >= 80;
    setIlargiOverride({
      mood: "Custom location",
      text: isPolar
        ? `You picked a polar spot (${formatCoords(latitudeDeg, longitudeEastDeg)}). Start the animation to watch how low sunlight sweeps around the craters.`
        : `You picked a custom spot (${formatCoords(latitudeDeg, longitudeEastDeg)}). Start the animation to follow the lunar day–night boundary.`,
    });
  };

  const handleToggleWater = () => {
    const next = !showWaterLayer;
    setShowWaterLayer(next);
    if (next) {
      setIlargiOverride({
        mood: "Water-equivalent hydrogen",
        text: "Brighter cyan areas near the poles highlight higher hydrogen levels measured from orbit. High hydrogen can be a clue to water ice hidden in cold craters, though it doesn't confirm ice on its own.",
      });
    } else {
      setIlargiOverride(null);
    }
  };

  const handleToggleMirrorGuide = () => {
    const next = !showMirrorGuide;
    setShowMirrorGuide(next);
    if (next) {
      setIlargiOverride({
        mood: "Lunar laser reflectors",
        text: "Lunar reflectors use corner-cube prisms to bounce laser pulses straight back to Earth. Timing the round trip reveals how the Moon's distance changes.",
      });
    } else {
      setIlargiOverride(null);
    }
  };

  const handleAnimationAction = () => {
    if (!cycleData) return;
    setNearSideTrigger((n) => n + 1);
    if (playing) {
      setHoursOffset(0);
      setPlaying(true);
      setIlargiOverride({
        mood: "Animation restarted",
        text: "Restarted from the beginning of the lunar cycle. Drag the Moon to view any crater while sunlight moves.",
      });
      return;
    }

    if (hoursOffset >= maxHours - 0.5) {
      setHoursOffset(0);
    }
    setPlaying(true);
    setIlargiOverride({
      mood: "Lunar cycle playing",
      text: "Watch sunlight sweep across the Moon's Earth-facing side as it goes through a full cycle of phases.",
    });
  };

  const handlePhaseSelect = (phase: LunarPhaseKey) => {
    if (!cycleData) return;
    setPlaying(false);
    setNearSideTrigger((n) => n + 1);
    const targetHours = findPhaseFrameHours(cycleData.frames, phase);
    setHoursOffset(targetHours);
  };

  const ilargiDisplay = useMemo(() => {
    if (ilargiOverride) return ilargiOverride;
    if (selectedSite) {
      return {
        mood: selectedSite.category_label,
        text: selectedSite.ilargi_story,
      };
    }
    return {
      mood: "Lunar guide",
      text: "Pick any lunar site on the left, then start the animation on the right to explore a full cycle of Moon phases.",
    };
  }, [ilargiOverride, selectedSite]);

  if (gameActive) {
    return (
      <LunarLandingGame
        educationSites={sites}
        initialSite={selectedSite}
        onExitGame={() => setGameActive(false)}
      />
    );
  }

  const canLandAtSelectedSite =
    Boolean(selectedSite) &&
    !manualCoords &&
    Math.abs(selectedSite?.latitude_deg ?? 0) >= 2;

  return (
    <div className="edu-shell">
      <div className="panel edu-game-launch-bar">
        <div className="edu-game-launch-info">
          <span className="pill pill-amber">YOUR LUNAR MISSION</span>
          <div>
            <strong>Lunar landing game with ILARGI</strong>
            <div className="panel-sub">
              Choose your destination and guide the lander to a gentle
              touchdown.
            </div>
          </div>
        </div>
        <button
          type="button"
          className="btn-primary edu-game-start-btn"
          onClick={() => {
            setPlaying(false);
            setGameActive(true);
          }}
        >
          <Rocket size={16} />
          Start landing game
        </button>
      </div>

      {errorMsg && (
        <div className="error-banner" role="alert">
          <span>{errorMsg}</span>
          <button
            type="button"
            className="btn-icon"
            onClick={() => setErrorMsg(null)}
          >
            ×
          </button>
        </div>
      )}

      <div className="edu-workspace-grid">
        {/* LEFT COLUMN: Mascot + Expanded Locations List */}
        <div className="edu-left-col">
          <div className="panel edu-mascot-dock">
            <IlargiMascot
              speakerMood={ilargiDisplay.mood}
              message={ilargiDisplay.text}
              showFunFacts
            />
          </div>

          <aside className="panel edu-sidebar">
            <div className="edu-section-head">
              <h2 className="edu-panel-title">Lunar Locations</h2>
              <p className="panel-sub">
                Filter by category or select any site below
              </p>
            </div>

            <div
              className="edu-cat-tabs"
              role="tablist"
              aria-label="Filter locations by category"
            >
              {FILTER_OPTIONS.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`btn-mini ${siteFilter === cat.id ? "active" : ""}`}
                  onClick={() => setSiteFilter(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div
              className="edu-site-list"
              role="listbox"
              aria-label="Lunar sites"
            >
              {filteredSites.map((site) => {
                const isActive = !manualCoords && selectedSite?.id === site.id;
                return (
                  <button
                    key={site.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    className={`edu-site-row ${isActive ? "active" : ""}`}
                    onClick={() => handleSelectSite(site)}
                  >
                    <span
                      className="edu-site-dot"
                      style={{ background: CATEGORY_DOT_COLOR[site.category] }}
                      aria-hidden="true"
                    />
                    <span className="edu-site-row-body">
                      <span className="edu-site-row-name">{site.name}</span>
                      <span className="edu-site-row-meta">
                        <span
                          className={`pill edu-mini-pill ${CATEGORY_BADGE_CLASS[site.category]}`}
                        >
                          {CATEGORY_SHORT_LABEL[site.category]}
                        </span>
                        <span className="edu-site-row-region">
                          {site.region}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className={`btn-secondary btn-compact edu-pin-btn ${pinMode ? "active" : ""}`}
              onClick={() => setPinMode((v) => !v)}
            >
              <Crosshair size={14} />
              {pinMode
                ? "Globe pin active: click the Moon"
                : "Place a custom point on the globe"}
            </button>
          </aside>
        </div>

        {/* CENTER COLUMN: Moon Globe + Large Three-Body Orbit View Below */}
        <section className="edu-center-col">
          <div className="panel edu-globe-panel">
            <ViewportFrame>
              <EducationMoonViewport3D
                sites={sites}
                selectedSite={selectedSite}
                manualCoords={manualCoords}
                currentFrame={currentFrame}
                showWaterLayer={showWaterLayer}
                showMirrorLaser={showMirrorGuide}
                pinMode={pinMode}
                focusTrigger={focusTrigger}
                nearSideTrigger={nearSideTrigger}
                onSelectSite={handleSelectSite}
                onSurfacePick={handleSurfacePick}
              />
            </ViewportFrame>
          </div>

          <ThreeBodyOrbitMini
            frames={cycleData?.frames ?? []}
            currentFrame={currentFrame}
          />
        </section>

        {/* RIGHT COLUMN: Animation + Selected Site Info + WEH & Phenomena */}
        <aside className="edu-right-col">
          {/* Lunar Cycle Animation */}
          <div className="panel edu-animation-card">
            <div className="edu-anim-header">
              <div>
                <h2 className="edu-panel-title">Lunar Cycle Animation</h2>
                <p className="panel-sub">
                  Watch or jump to the four main Moon phases
                </p>
              </div>
              <button
                type="button"
                className="btn-primary edu-play-btn"
                disabled={!cycleData || loadingCycle}
                onClick={handleAnimationAction}
              >
                {playing ? <RotateCcw size={15} /> : <Play size={15} />}
                {playing ? "Restart animation" : "Start animation"}
              </button>
            </div>

            <div className="edu-phase-status-row">
              <div className="edu-phase-current">
                <MoonPhaseGlyph phase={currentPhase} />
                <div>
                  <div className="edu-phase-kicker">Current Moon phase</div>
                  <strong className="edu-phase-name">
                    {phaseLabelFromKey(currentPhase)}
                  </strong>
                </div>
              </div>
              {loadingCycle && <span className="pill pill-cyan">Loading…</span>}
            </div>

            <label className="field edu-phase-select-field">
              <span>Jump to a Moon phase</span>
              <select
                className="input-select"
                value={currentPhase}
                disabled={!cycleData}
                onChange={(e) =>
                  handlePhaseSelect(e.target.value as LunarPhaseKey)
                }
                aria-label="Select Moon phase"
              >
                {LUNAR_PHASES.map((phase) => (
                  <option key={phase.key} value={phase.key}>
                    {phase.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Selected Location Details */}
          <div className="panel edu-info-card">
            <div className="edu-section-head">
              <div className="edu-info-top-row">
                <h2 className="edu-panel-title">Selected Location</h2>
                {selectedSite && !manualCoords ? (
                  <span
                    className={`pill ${CATEGORY_BADGE_CLASS[selectedSite.category]}`}
                  >
                    {selectedSite.category_label}
                  </span>
                ) : (
                  <span className="pill pill-cyan">Custom pin</span>
                )}
              </div>
            </div>

            {selectedSite && !manualCoords ? (
              <>
                <div className="edu-site-hero">
                  <h3 className="edu-site-title">{selectedSite.name}</h3>
                  <div className="edu-site-submeta">
                    <span className="pill pill-muted">
                      {selectedSite.mission_or_source}
                    </span>
                    <span className="edu-site-coords mono">
                      {formatCoords(
                        selectedSite.latitude_deg,
                        selectedSite.longitude_east_deg,
                      )}
                    </span>
                  </div>
                </div>

                <p className="edu-site-story">{selectedSite.ilargi_story}</p>

                <div className="edu-site-facts-grid">
                  <div className="edu-fact-item">
                    <div className="edu-fact-label">
                      <Sun size={14} className="tag-sun" />
                      <span>Sunlight</span>
                      {currentFrame && (
                        <span
                          className={`pill ${currentFrame.sun_visible ? "pill-amber" : "pill-muted"}`}
                        >
                          {currentFrame.sun_visible ? "Sunlit" : "In shadow"}
                        </span>
                      )}
                    </div>
                    <p>{selectedSite.illumination_note}</p>
                  </div>

                  <div className="edu-fact-item">
                    <div className="edu-fact-label">
                      <Globe size={14} className="tag-earth" />
                      <span>Earth visibility</span>
                    </div>
                    <p>{selectedSite.earth_visibility_note}</p>
                  </div>

                  <div className="edu-fact-item">
                    <div className="edu-fact-label">
                      <Droplets size={14} className="tag-ok" />
                      <span>Water &amp; ice context</span>
                    </div>
                    <p>{selectedSite.water_note}</p>
                  </div>
                </div>

                <div className="edu-site-actions">
                  <button
                    type="button"
                    className="btn-secondary btn-compact"
                    onClick={() => setFocusTrigger((n) => n + 1)}
                  >
                    <Eye size={14} />
                    Focus on globe
                  </button>
                  {canLandAtSelectedSite && (
                    <button
                      type="button"
                      className="btn-primary btn-compact"
                      onClick={() => {
                        setPlaying(false);
                        setGameActive(true);
                      }}
                    >
                      <Rocket size={14} />
                      Land here
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="edu-site-hero">
                  <h3 className="edu-site-title">Custom Surface Location</h3>
                  {manualCoords && (
                    <span className="edu-site-coords mono">
                      {formatCoords(
                        manualCoords.latitudeDeg,
                        manualCoords.longitudeEastDeg,
                      )}
                    </span>
                  )}
                </div>
                <p className="edu-site-story">
                  You placed a custom pin on the Moon. Start the animation above
                  to see how sunlight changes here over a full lunar cycle, or
                  turn on the hydrogen layer below to explore polar water clues.
                </p>
                {currentFrame && (
                  <div className="edu-fact-item">
                    <div className="edu-fact-label">
                      <Sun size={14} className="tag-sun" />
                      <span>Current sunlight</span>
                      <span
                        className={`pill ${currentFrame.sun_visible ? "pill-amber" : "pill-muted"}`}
                      >
                        {currentFrame.sun_visible ? "Sunlit" : "In shadow"}
                      </span>
                    </div>
                  </div>
                )}
                <div className="edu-site-actions">
                  <button
                    type="button"
                    className="btn-secondary btn-compact"
                    onClick={() => setFocusTrigger((n) => n + 1)}
                  >
                    <Eye size={14} />
                    Focus on globe
                  </button>
                </div>
              </>
            )}
          </div>

          {/* WEH & Lunar Phenomena */}
          <div className="panel edu-phenomena-card">
            <div className="edu-section-head">
              <h2 className="edu-panel-title">WEH &amp; Lunar Phenomena</h2>
              <p className="panel-sub">
                Toggle surface water-ice clues and laser reflector guides
              </p>
            </div>

            <button
              type="button"
              className={`btn-secondary edu-feature-btn ${showWaterLayer ? "active" : ""}`}
              onClick={handleToggleWater}
            >
              <span className="edu-feature-btn-left">
                <Droplets size={15} className="tag-earth" />
                <span>Water-equivalent hydrogen (WEH)</span>
              </span>
              <span className="pill pill-cyan">
                {showWaterLayer ? "ON" : "OFF"}
              </span>
            </button>

            {showWaterLayer && (
              <p className="edu-phenomena-note">
                Brighter cyan regions mark places where orbital instruments
                detected higher hydrogen levels — an important clue when
                searching for hidden polar ice.
              </p>
            )}

            <button
              type="button"
              className={`btn-secondary edu-feature-btn ${showMirrorGuide ? "active" : ""}`}
              onClick={handleToggleMirrorGuide}
            >
              <span>How do lunar reflectors work?</span>
              <span className="pill pill-ok">
                {showMirrorGuide ? "Hide" : "Guide"}
              </span>
            </button>

            {showMirrorGuide && (
              <div className="edu-mirror-box">
                <div className="edu-mirror-head">
                  <strong>{LUNAR_MIRROR_GUIDE.title}</strong>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => setShowMirrorGuide(false)}
                    title="Close explanation"
                    aria-label="Close explanation"
                  >
                    <X size={14} />
                  </button>
                </div>
                <p className="edu-card-p">{LUNAR_MIRROR_GUIDE.summary}</p>
                <ul className="edu-card-list">
                  {LUNAR_MIRROR_GUIDE.steps.map((st) => (
                    <li key={st}>{st}</li>
                  ))}
                </ul>
                <div className="edu-discoveries">
                  <strong>What can we learn from them?</strong>
                  <ul>
                    {LUNAR_MIRROR_GUIDE.discoveries.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      <SpacecraftGuide />
    </div>
  );
}
