import { SpacecraftPreview } from "../SpacecraftPreview";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Orbit,
  RotateCcw,
} from "lucide-react";
import type { EducationSite } from "../../types";
import { IlargiMascot } from "../IlargiMascot";
import {
  FALLBACK_GAME_SITES,
  mapEducationSitesToGameSites,
  solveInclinationForSite,
  type GameLandingSite,
  type PlaneChangeSolution,
} from "./gamePhysics";
import { Phase1OrbitViewport3D } from "./Phase1OrbitViewport3D";
import { Phase2DescentView } from "./Phase2DescentView";
import { Phase3LandingCanvas } from "./Phase3LandingCanvas";

interface LunarLandingGameProps {
  educationSites: EducationSite[];
  initialSite?: EducationSite | null;
  onExitGame: () => void;
}

type GamePhase = 1 | 2 | 3;

export function LunarLandingGame({
  educationSites,
  initialSite,
  onExitGame,
}: LunarLandingGameProps) {
  const gameSites = useMemo(
    () => mapEducationSitesToGameSites(educationSites, initialSite),
    [educationSites, initialSite],
  );

  const [phase, setPhase] = useState<GamePhase>(1);
  const [selectedSite, setSelectedSite] = useState<GameLandingSite>(() => {
    if (initialSite && Math.abs(initialSite.latitude_deg) >= 2) {
      return (
        gameSites.find((s) => s.id === initialSite.id) ?? FALLBACK_GAME_SITES[0]
      );
    }
    return gameSites[0] ?? FALLBACK_GAME_SITES[0];
  });

  const [pinMode, setPinMode] = useState(false);

  const [solvedInclination, setSolvedInclination] =
    useState<PlaneChangeSolution | null>(null);
  const [currentInclinationDeg, setCurrentInclinationDeg] = useState(0);
  const [tiltingOrbit, setTiltingOrbit] = useState(false);
  const [groundTrackAligned, setGroundTrackAligned] = useState(false);

  const [ilargiState, setIlargiState] = useState<{
    mood: string;
    text: string;
  }>({
    mood: "Phase 1 · Parking Orbit",
    text: "Welcome aboard. Your lander starts in an equatorial parking orbit. Choose a landing site and calculate the orbit needed to reach it.",
  });

  const handleIlargiSpeak = useCallback((mood: string, text: string) => {
    setIlargiState({ mood, text });
  }, []);

  const targetSolutionPreview = useMemo(
    () =>
      solveInclinationForSite(
        selectedSite.latitudeDeg,
        selectedSite.longitudeEastDeg,
        selectedSite.orbitAltitudeKm,
        0,
      ),
    [selectedSite],
  );

  useEffect(() => {
    if (!tiltingOrbit || !solvedInclination) return;
    const startInc = currentInclinationDeg;
    const targetInc = solvedInclination.requiredInclinationDeg;
    const durationMs = 2200;
    const startTs = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const p = Math.min(1, (now - startTs) / durationMs);
      const eased = 1 - Math.pow(1 - p, 2.4);
      setCurrentInclinationDeg(startInc + (targetInc - startInc) * eased);
      if (p < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setTiltingOrbit(false);
        setGroundTrackAligned(true);
        handleIlargiSpeak(
          "Ground track aligned",
          `With inclination i = ${targetInc.toFixed(2)}° (the angle between the orbital plane and equator), the ground track crosses ${selectedSite.name}. Select Phase 2 to prepare the descent.`,
        );
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [tiltingOrbit, solvedInclination, selectedSite.name, handleIlargiSpeak]);

  const resetToPhase1 = (siteToUse: GameLandingSite) => {
    setPhase(1);
    setSelectedSite(siteToUse);
    setSolvedInclination(null);
    setCurrentInclinationDeg(0);
    setTiltingOrbit(false);
    setGroundTrackAligned(false);
    setPinMode(false);
    handleIlargiSpeak(
      "Phase 1 · Parking Orbit",
      `Target set to ${siteToUse.name} (Lat ${siteToUse.latitudeDeg.toFixed(2)}°, Lon ${siteToUse.longitudeEastDeg.toFixed(2)}°E). Start from an equatorial parking orbit (i = 0°). Calculate the required orbital inclination.`,
    );
  };

  const handleSelectSite = (site: GameLandingSite) => {
    resetToPhase1(site);
  };

  const handleCustomSurfacePick = (latDeg: number, lonDeg: number) => {
    const safeLat = Math.abs(latDeg) < 1 ? (latDeg >= 0 ? 1.5 : -1.5) : latDeg;
    const custom: GameLandingSite = {
      id: "custom-surface",
      name: "Custom location",
      mission: "Free 3D selection",
      latitudeDeg: Number(safeLat.toFixed(2)),
      longitudeEastDeg: Number(lonDeg.toFixed(2)),
      orbitAltitudeKm: 110,
      landingGateKm: 5,
      hint: "Coordinates selected on the lunar globe",
    };
    resetToPhase1(custom);
  };

  const handleApplyInclination = () => {
    if (!solvedInclination || tiltingOrbit || groundTrackAligned) return;
    setTiltingOrbit(true);
    handleIlargiSpeak(
      "Changing orbital inclination",
      `Applying the plane-change maneuver (ΔV = ${solvedInclination.planeChangeDeltaVMs} m/s) to reach inclination ${solvedInclination.requiredInclinationDeg.toFixed(2)}° and cross the target location.`,
    );
  };

  const goToPhase2 = () => {
    setPhase(2);
    handleIlargiSpeak(
      "Phase 2 · Orbital altitude and ΔV",
      `Your orbital altitude is ${selectedSite.orbitAltitudeKm} km and final landing mode (Phase 3) begins at ${selectedSite.landingGateKm} km. Subtract the altitudes, enter the descent distance and press the launch button.`,
    );
  };

  return (
    <div className="game-shell">
      {/* ILARGI mascot guiding the game */}
      <div className="panel game-mascot-dock">
        <IlargiMascot
          speakerMood={ilargiState.mood}
          message={ilargiState.text}
          showFunFacts={false}
        />
      </div>

      {/* Active phase content */}
      {phase === 1 && (
        <div className="phase1-grid">
          <aside className="panel phase1-sidebar">
            <div className="panel-header">
              <div>
                <div className="eyebrow eyebrow-accent">
                  1. CHOOSE A LANDING SITE
                </div>
                <div className="panel-sub">
                  Select a destination for your mission
                </div>
              </div>
            </div>

            <SpacecraftPreview />
            <div className="phase1-site-list">
              {gameSites.map((s) => {
                const active = selectedSite.id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`edu-site-chip ${active ? "active" : ""}`}
                    onClick={() => handleSelectSite(s)}
                  >
                    <Orbit size={13} className="tag-earth" />
                    <span className="edu-site-chip-name">{s.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="phase1-target-readout">
              <div className="eyebrow">SURFACE COORDINATES</div>
              <div className="phase1-coord-pair mono">
                <div>
                  <span className="muted-note">Latitude:</span>{" "}
                  <strong className="kpi-sun">
                    {selectedSite.latitudeDeg.toFixed(2)}°
                  </strong>
                </div>
                <div>
                  <span className="muted-note">Longitude:</span>{" "}
                  <strong className="kpi-earth">
                    {selectedSite.longitudeEastDeg.toFixed(2)}°E
                  </strong>
                </div>
              </div>
            </div>

            {/* Orbital calculation trigger */}
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setSolvedInclination(targetSolutionPreview);
                handleIlargiSpeak(
                  "Orbital inclination",
                  `To reach ${selectedSite.name}, tilt the orbit to ${targetSolutionPreview.requiredInclinationDeg.toFixed(2)} degrees.`,
                );
              }}
            >
              Calculate my orbit
            </button>

            {solvedInclination && !groundTrackAligned && (
              <button
                type="button"
                className="btn-primary phase1-apply-btn"
                disabled={tiltingOrbit}
                onClick={handleApplyInclination}
              >
                <Orbit size={16} />
                {tiltingOrbit
                  ? "Changing orbit and ground track…"
                  : `Apply inclination (${solvedInclination.requiredInclinationDeg.toFixed(2)}°) to orbit`}
              </button>
            )}

            {groundTrackAligned && (
              <button
                type="button"
                className="btn-primary phase1-next-btn"
                onClick={goToPhase2}
              >
                <CheckCircle2 size={16} />
                Continue to Phase 2: Orbital descent
                <ArrowRight size={16} />
              </button>
            )}
          </aside>

          <div className="panel phase1-globe-card">
            <Phase1OrbitViewport3D
              sites={gameSites}
              selectedSite={selectedSite}
              currentInclinationDeg={currentInclinationDeg}
              targetNodeDeg={targetSolutionPreview.ascendingNodeDeg}
              groundTrackAligned={groundTrackAligned}
              pinMode={pinMode}
              onSelectSite={handleSelectSite}
              onCustomSurfacePick={handleCustomSurfacePick}
            />
          </div>
        </div>
      )}

      {phase === 2 && (
        <Phase2DescentView
          site={selectedSite}
          onIlargiSpeak={handleIlargiSpeak}
          onCompletePhase2={() => {
            setPhase(3);
          }}
        />
      )}

      {phase === 3 && (
        <Phase3LandingCanvas
          site={selectedSite}
          onIlargiSpeak={handleIlargiSpeak}
          onRestartMission={() => resetToPhase1(selectedSite)}
          onExitToEducation={onExitGame}
        />
      )}

      {/* Bottom mission bar and 3-phase progress */}
      <div className="panel game-topbar">
        <div className="game-topbar-left">
          <button
            type="button"
            className="btn-secondary btn-compact"
            onClick={onExitGame}
          >
            <ArrowLeft size={14} />
            Return to Education
          </button>
          <div className="game-title-block">
            <span className="eyebrow eyebrow-accent">
              LUNAR LANDING MISSION · GAME MODE
            </span>
            <span className="muted-note">
              Target: {selectedSite.name} ({selectedSite.latitudeDeg.toFixed(2)}
              °, {selectedSite.longitudeEastDeg.toFixed(2)}°E)
            </span>
          </div>
        </div>

        <div
          className="game-stepper"
          role="navigation"
          aria-label="Game phases"
        >
          <div
            className={`game-step ${phase === 1 ? "active" : phase > 1 ? "done" : ""}`}
          >
            <span className="game-step-num">1</span>
            <span>Parking orbit and inclination</span>
          </div>
          <span className="game-step-sep">→</span>
          <div
            className={`game-step ${phase === 2 ? "active" : phase > 2 ? "done" : ""}`}
          >
            <span className="game-step-num">2</span>
            <span>Descent and ΔV</span>
          </div>
          <span className="game-step-sep">→</span>
          <div className={`game-step ${phase === 3 ? "active" : ""}`}>
            <span className="game-step-num">3</span>
            <span>Landing mode</span>
          </div>
        </div>

        <button
          type="button"
          className="btn-secondary btn-compact"
          onClick={() => resetToPhase1(selectedSite)}
          title="Restart game from Phase 1"
        >
          <RotateCcw size={13} />
          Restart
        </button>
      </div>
    </div>
  );
}
