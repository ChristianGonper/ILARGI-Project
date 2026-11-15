import { useEffect, useMemo, useState } from "react";
import {
  Crosshair,
  Droplets,
  Info,
  Pause,
  Play,
  Rocket,
  RotateCcw,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import {
  fetchEducationCycle,
  fetchEducationSites,
  formatUtcShort,
  interpolateEducationFrame,
} from "../api";
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
  ThreeBodyOrbitMini,
  phaseLabelFromFraction,
} from "./ThreeBodyOrbitMini";

const CATEGORY_OPTIONS: {
  id: "all" | EducationCategory;
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "eternal_light", label: "Illuminated terrain" },
  { id: "psr", label: "Shadow (PSR)" },
  { id: "landing", label: "Landing" },
  { id: "mirror", label: "Reflectors" },
];

const CATEGORY_BADGE_CLASS: Record<EducationCategory, string> = {
  eternal_light: "pill-amber",
  psr: "pill-cyan",
  landing: "pill-violet",
  mirror: "pill-ok",
};

export function EducationWorkspace() {
  const [sites, setSites] = useState<EducationSite[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<
    "all" | EducationCategory
  >("all");
  const [selectedSite, setSelectedSite] = useState<EducationSite | null>(null);
  const [manualCoords, setManualCoords] = useState<{
    latitudeDeg: number;
    longitudeEastDeg: number;
  } | null>(null);
  const [pinMode, setPinMode] = useState(false);

  const [startDate, setStartDate] = useState("2026-04-02");
  const [cycleData, setCycleData] = useState<EducationCycleResponse | null>(
    null,
  );
  const [loadingCycle, setLoadingCycle] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [hoursOffset, setHoursOffset] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedHoursPerSec, setSpeedHoursPerSec] = useState(36);

  const [showWaterLayer, setShowWaterLayer] = useState(false);
  const [showMirrorGuide, setShowMirrorGuide] = useState(false);
  const [gameActive, setGameActive] = useState(false);
  const [ilargiOverride, setIlargiOverride] = useState<{
    mood: string;
    text: string;
  } | null>(null);

  useEffect(() => {
    void fetchEducationSites()
      .then((list) => {
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
    setLoadingCycle(true);
    setErrorMsg(null);
    void fetchEducationCycle({
      latitudeDeg: activeLat,
      longitudeEastDeg: activeLon,
      startDate,
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
  }, [activeLat, activeLon, startDate]);

  const maxHours = cycleData?.duration_hours ?? 709.0;

  useEffect(() => {
    if (!playing || !cycleData) return;
    let rafId = 0;
    let lastTs = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastTs) / 1000);
      lastTs = now;
      setHoursOffset((prev) => {
        const next = prev + dt * speedHoursPerSec;
        return next >= maxHours ? 0 : next;
      });
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [playing, cycleData, speedHoursPerSec, maxHours]);

  const currentFrame = useMemo(() => {
    if (!cycleData) return null;
    return interpolateEducationFrame(cycleData.frames, hoursOffset);
  }, [cycleData, hoursOffset]);

  const filteredSites = useMemo(() => {
    if (categoryFilter === "all") return sites;
    return sites.filter((s) => s.category === categoryFilter);
  }, [sites, categoryFilter]);

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
        ? `You selected a polar location (${latitudeDeg.toFixed(1)}°, ${longitudeEastDeg.toFixed(1)}°E). Watch the low Sun move over the terrain during the cycle.`
        : `You selected the location (${latitudeDeg.toFixed(1)}°, ${longitudeEastDeg.toFixed(1)}°E). Play the animation to follow the lunar day–night boundary.`,
    });
  };

  const handleToggleWater = () => {
    const next = !showWaterLayer;
    setShowWaterLayer(next);
    if (next) {
      setIlargiOverride({
        mood: "Water-equivalent hydrogen",
        text: "WEH expresses estimated hydrogen as an equivalent amount of water. Stronger intensity means higher WEH, without confirming water or ice. The source is Lunar Prospector data from Lawrence and colleagues (2022).",
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
        mood: "Lunar retroreflectors",
        text: "Lunar retroreflectors use corner-cube prisms to return laser light toward its source. Round-trip timing helps measure the changing Earth–Moon distance.",
      });
    } else {
      setIlargiOverride(null);
    }
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
      text: "Choose a landing site, illuminated ridge or polar shadow region, then press Play to follow a full lunar solar cycle.",
    };
  }, [ilargiOverride, selectedSite]);

  const lunarDaysElapsed = hoursOffset / 24.0;
  const lunarDayPct = Math.min(100, (hoursOffset / 708.734) * 100);

  if (gameActive) {
    return (
      <LunarLandingGame
        educationSites={sites}
        initialSite={selectedSite}
        onExitGame={() => setGameActive(false)}
      />
    );
  }

  return (
    <div className="edu-shell">
      <div className="panel edu-game-launch-bar">
        <div className="edu-game-launch-info">
          <span className="pill pill-amber">
            INTERACTIVE MISSION · 3 PHASES
          </span>
          <div>
            <strong>Lunar landing game with ILARGI</strong>
            <div className="panel-sub">
              Set the orbital inclination, plan the descent, and pilot the
              lander toward the target.
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
        {/* Location, timeline and educational layers */}
        <aside className="panel edu-sidebar">
          <div className="panel-header">
            <div>
              <div className="eyebrow">1. CHOOSE A LOCATION</div>
              <div className="panel-sub">
                Landing sites, illuminated terrain, polar shadows and reflectors
              </div>
            </div>
          </div>

          <div className="edu-cat-tabs" role="tablist">
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`btn-mini ${categoryFilter === cat.id ? "active" : ""}`}
                onClick={() => setCategoryFilter(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="edu-site-select-wrap">
            <select
              className="input-select"
              value={manualCoords ? "__manual__" : (selectedSite?.id ?? "")}
              onChange={(e) => {
                const found = sites.find((s) => s.id === e.target.value);
                if (found) handleSelectSite(found);
              }}
              aria-label="Select lunar location"
            >
              {manualCoords && (
                <option value="__manual__">
                  Manual ({manualCoords.latitudeDeg.toFixed(2)}°,{" "}
                  {manualCoords.longitudeEastDeg.toFixed(2)}°E)
                </option>
              )}
              {filteredSites.map((s) => (
                <option key={s.id} value={s.id}>
                  [{s.category_label}] {s.name}
                </option>
              ))}
            </select>

            <div className="edu-site-quick-list">
              {filteredSites.map((s) => {
                const active = !manualCoords && selectedSite?.id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`edu-site-chip ${active ? "active" : ""}`}
                    onClick={() => handleSelectSite(s)}
                  >
                    <span
                      className={`pill ${CATEGORY_BADGE_CLASS[s.category]}`}
                    >
                      {s.category === "eternal_light"
                        ? "Light"
                        : s.category === "psr"
                          ? "PSR"
                          : s.category === "mirror"
                            ? "Reflector"
                            : "Landing"}
                    </span>
                    <span className="edu-site-chip-name">{s.name}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className={`btn-secondary btn-compact ${pinMode ? "active" : ""}`}
              onClick={() => setPinMode((v) => !v)}
            >
              <Crosshair size={14} />
              {pinMode
                ? "Globe pin: ACTIVE (click the Moon)"
                : "Place a point on the globe"}
            </button>
          </div>

          {/* Full-cycle timeline */}
          <div className="edu-movie-box">
            <div className="panel-header">
              <div>
                <div className="eyebrow eyebrow-accent">
                  2. ANIMATION · FULL LUNAR CYCLE
                </div>
                <div className="panel-sub">
                  1 lunar solar day ≈ 29.53 Earth days (709 h)
                </div>
              </div>
              {loadingCycle && <span className="pill pill-cyan">SPICE…</span>}
            </div>

            <div className="edu-movie-controls">
              <button
                type="button"
                className="btn-primary edu-play-btn"
                disabled={!cycleData}
                onClick={() => {
                  setPlaying((p) => !p);
                  if (!playing) {
                    setIlargiOverride({
                      mood: "Solar animation playing",
                      text: "Watch sunlight move over the craters. Rotate the globe with your mouse while the animation continues.",
                    });
                  }
                }}
              >
                {playing ? <Pause size={15} /> : <Play size={15} />}
                {playing ? "Pause animation" : "Play animation"}
              </button>

              <button
                type="button"
                className="btn-secondary btn-compact"
                onClick={() => {
                  setPlaying(false);
                  setHoursOffset(0);
                }}
                title="Return to cycle start"
              >
                <RotateCcw size={14} />
              </button>

              <select
                className="edu-speed-select"
                value={speedHoursPerSec}
                onChange={(e) => setSpeedHoursPerSec(Number(e.target.value))}
                aria-label="Animation speed"
              >
                <option value={12}>1× slow</option>
                <option value={36}>3× normal</option>
                <option value={72}>6× fast</option>
                <option value={144}>12× turbo</option>
              </select>
            </div>

            <label className="edu-slider-label">
              <div className="edu-slider-meta">
                <span className="mono">
                  Day {lunarDaysElapsed.toFixed(1)} / 29.5 (
                  {Math.round(hoursOffset)} h)
                </span>
                <span className="mono">{lunarDayPct.toFixed(0)}% of cycle</span>
              </div>
              <input
                type="range"
                className="disc-slider"
                min={0}
                max={maxHours}
                step={0.5}
                value={hoursOffset}
                onChange={(e) => {
                  setPlaying(false);
                  setHoursOffset(Number(e.target.value));
                }}
              />
            </label>

            {currentFrame && (
              <div className="edu-live-telemetry">
                <div className="edu-live-row">
                  <span className="muted-note">UTC instant</span>
                  <span className="mono">
                    {formatUtcShort(currentFrame.utc)}
                  </span>
                </div>
                <div className="edu-live-row">
                  <span className="muted-note">Sun at this location</span>
                  <span
                    className={`pill ${currentFrame.sun_visible ? "pill-amber" : "pill-muted"}`}
                  >
                    <Sun size={11} />{" "}
                    {currentFrame.sun_visible
                      ? `Sunlit (${currentFrame.sun_elevation_deg.toFixed(1)}°)`
                      : `In shadow (${currentFrame.sun_elevation_deg.toFixed(1)}°)`}
                  </span>
                </div>
                <div className="edu-live-row">
                  <span className="muted-note">Lunar phase (from Earth)</span>
                  <span className="mono">
                    {Math.round(currentFrame.illumination_fraction * 100)}% ·{" "}
                    {phaseLabelFromFraction(currentFrame.illumination_fraction)}
                  </span>
                </div>
              </div>
            )}

            <label className="field edu-date-field">
              <span>Simulation start date (UTC)</span>
              <input
                type="date"
                min="1972-01-01"
                max="2100-12-31"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
          </div>

          {/* WEH and laser reflector explanations */}
          <div className="edu-extras-box">
            <div className="eyebrow">3. WEH AND LUNAR PHENOMENA</div>
            <button
              type="button"
              className={`btn-secondary edu-feature-btn ${showWaterLayer ? "active" : ""}`}
              onClick={handleToggleWater}
            >
              <Droplets size={15} className="tag-earth" />
              <span>Water-equivalent hydrogen (WEH)</span>
              <span className="pill pill-cyan">
                {showWaterLayer ? "ON" : "OFF"}
              </span>
            </button>

            <button
              type="button"
              className={`btn-secondary edu-feature-btn ${showMirrorGuide ? "active" : ""}`}
              onClick={handleToggleMirrorGuide}
            >
              <Sparkles size={15} className="tag-ok" />
              <span>How do lunar reflectors work?</span>
              <span className="pill pill-ok">LRRR</span>
            </button>

            <a
              href="https://pgda.gsfc.nasa.gov/products/69"
              target="_blank"
              rel="noreferrer"
              className="edu-pgda-link"
            >
              <Info size={13} />
              Polar illumination and shadow: NASA PGDA LOLA 69
            </a>
          </div>
        </aside>

        {/* Globe, three-body view and guide */}
        <section className="edu-stage">
          <div className="edu-dual-viewports">
            <div className="panel edu-globe-panel">
              <EducationMoonViewport3D
                sites={sites}
                selectedSite={selectedSite}
                manualCoords={manualCoords}
                currentFrame={currentFrame}
                showWaterLayer={showWaterLayer}
                showMirrorLaser={showMirrorGuide}
                pinMode={pinMode}
                onSelectSite={handleSelectSite}
                onSurfacePick={handleSurfacePick}
              />
            </div>

            <div className="edu-right-stack">
              <ThreeBodyOrbitMini
                frames={cycleData?.frames ?? []}
                currentFrame={currentFrame}
              />

              {showMirrorGuide ? (
                <div className="panel edu-info-card edu-mirror-card">
                  <div className="panel-header">
                    <div>
                      <div className="eyebrow tag-ok">
                        {LUNAR_MIRROR_GUIDE.title}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => setShowMirrorGuide(false)}
                      title="Close explanation"
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
              ) : (
                <div className="panel edu-info-card">
                  <div className="panel-header">
                    <div>
                      <div className="eyebrow">
                        {manualCoords
                          ? "MANUAL COORDINATES"
                          : (selectedSite?.category_label ??
                            "LOCATION DETAILS")}
                      </div>
                      <h3 className="edu-site-title">
                        {manualCoords
                          ? `Location (${manualCoords.latitudeDeg.toFixed(2)}°, ${manualCoords.longitudeEastDeg.toFixed(2)}°E)`
                          : (selectedSite?.name ?? "Select a location")}
                      </h3>
                    </div>
                    {selectedSite && !manualCoords && (
                      <span
                        className={`pill ${CATEGORY_BADGE_CLASS[selectedSite.category]}`}
                      >
                        {selectedSite.mission_or_source}
                      </span>
                    )}
                  </div>

                  {selectedSite && !manualCoords ? (
                    <div className="edu-site-facts">
                      <div>
                        <strong className="tag-sun">Sunlight:</strong>{" "}
                        {selectedSite.illumination_note}
                      </div>
                      <div>
                        <strong className="tag-earth">Earth:</strong>{" "}
                        {selectedSite.earth_visibility_note}
                      </div>
                      <div>
                        <strong className="tag-ok">Water (H₂O):</strong>{" "}
                        {selectedSite.water_note}
                      </div>
                    </div>
                  ) : (
                    <p className="edu-card-p">
                      The coordinates were selected on the lunar globe. Play the
                      cycle to inspect changing solar elevation, and enable{" "}
                      <strong>WEH</strong> to explore estimated hydrogen
                      abundance.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="panel edu-mascot-dock">
            <IlargiMascot
              speakerMood={ilargiDisplay.mood}
              message={ilargiDisplay.text}
              showFunFacts
            />
          </div>
        </section>
      </div>
    </div>
  );
}
