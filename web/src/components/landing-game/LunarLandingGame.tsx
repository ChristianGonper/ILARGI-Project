import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Crosshair,
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
import { SuperCalculator } from "./SuperCalculator";

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

  // Estado de Fase 1: Parking orbit empieza en inclinación 0° (ecuatorial)
  const [solvedInclination, setSolvedInclination] =
    useState<PlaneChangeSolution | null>(null);
  const [currentInclinationDeg, setCurrentInclinationDeg] = useState(0);
  const [tiltingOrbit, setTiltingOrbit] = useState(false);
  const [groundTrackAligned, setGroundTrackAligned] = useState(false);

  const [ilargiState, setIlargiState] = useState<{
    mood: string;
    text: string;
  }>({
    mood: "Fase 1 · Parking Orbit",
    text: "¡Bienvenido a bordo! Tu aterrizador está en una parking orbit: una órbita circular de espera alrededor del ecuador lunar (inclinación 0°). Elige un punto de aterrizaje, observa su latitud y longitud sobre la Luna e introdúcelas en la Supercalculadora.",
  });

  const handleIlargiSpeak = useCallback((mood: string, text: string) => {
    setIlargiState({ mood, text });
  }, []);

  // Nodo ascendente calculado para alinear el plano orbital con la longitud del sitio elegido
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

  // Animación suave de cambio de plano orbital cuando el usuario aplica la inclinación calculada
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
          "¡Ground Track Alineado!",
          `¡Perfecto! Con inclinación i = ${targetInc.toFixed(2)}° (el ángulo entre el plano orbital y el ecuador), el ground track ya corta justo por encima de ${selectedSite.name}. ¡Pulsa "Pasar a Fase 2" para preparar el descenso!`,
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
      "Fase 1 · Parking Orbit",
      `Objetivo fijado en ${siteToUse.name} (Lat ${siteToUse.latitudeDeg.toFixed(2)}°, Lon ${siteToUse.longitudeEastDeg.toFixed(2)}°E). Ahora estamos en una parking orbit ecuatorial (i = 0°). Mete esas coordenadas en la Supercalculadora para descubrir qué inclinación necesitas.`,
    );
  };

  const handleSelectSite = (site: GameLandingSite) => {
    resetToPhase1(site);
  };

  const handleCustomSurfacePick = (latDeg: number, lonDeg: number) => {
    const safeLat = Math.abs(latDeg) < 1 ? (latDeg >= 0 ? 1.5 : -1.5) : latDeg;
    const custom: GameLandingSite = {
      id: "custom-surface",
      name: "Punto personalizado",
      mission: "Selección libre 3D",
      latitudeDeg: Number(safeLat.toFixed(2)),
      longitudeEastDeg: Number(lonDeg.toFixed(2)),
      orbitAltitudeKm: 110,
      landingGateKm: 5,
      hint: "Coordenada elegida sobre el globo lunar",
    };
    resetToPhase1(custom);
  };

  const handleApplyInclination = () => {
    if (!solvedInclination || tiltingOrbit || groundTrackAligned) return;
    setTiltingOrbit(true);
    handleIlargiSpeak(
      "Cambio de inclinación en curso",
      `Encendiendo motores laterales (ΔV = ${solvedInclination.planeChangeDeltaVMs} m/s) para inclinar la órbita hasta ${solvedInclination.requiredInclinationDeg.toFixed(2)}° y cruzar el punto objetivo.`,
    );
  };

  const goToPhase2 = () => {
    setPhase(2);
    handleIlargiSpeak(
      "Fase 2 · Altura de órbita y ΔV",
      `Tu órbita está a ${selectedSite.orbitAltitudeKm} km de altura y el Modo Aterrizar (Fase 3) empieza a ${selectedSite.landingGateKm} km. Resta ambas alturas, introduce cuántos km debes bajar y pulsa el botón rojo del cohete.`,
    );
  };

  return (
    <div className="game-shell">
      {/* BARRA SUPERIOR DE MISIÓN Y PROGRESO DE LAS 3 FASES */}
      <div className="panel game-topbar">
        <div className="game-topbar-left">
          <button
            type="button"
            className="btn-secondary btn-compact"
            onClick={onExitGame}
          >
            <ArrowLeft size={14} />
            Volver a Educación
          </button>
          <div className="game-title-block">
            <span className="eyebrow eyebrow-accent">
              MISIÓN ATERRIZAJE LUNAR · MODO JUEGO
            </span>
            <span className="muted-note">
              Objetivo: {selectedSite.name} (
              {selectedSite.latitudeDeg.toFixed(2)}
              °, {selectedSite.longitudeEastDeg.toFixed(2)}°E)
            </span>
          </div>
        </div>

        <div
          className="game-stepper"
          role="navigation"
          aria-label="Fases del juego"
        >
          <div
            className={`game-step ${phase === 1 ? "active" : phase > 1 ? "done" : ""}`}
          >
            <span className="game-step-num">1</span>
            <span>Parking Orbit e Inclinación</span>
          </div>
          <span className="game-step-sep">→</span>
          <div
            className={`game-step ${phase === 2 ? "active" : phase > 2 ? "done" : ""}`}
          >
            <span className="game-step-num">2</span>
            <span>Descenso y ΔV</span>
          </div>
          <span className="game-step-sep">→</span>
          <div className={`game-step ${phase === 3 ? "active" : ""}`}>
            <span className="game-step-num">3</span>
            <span>Modo Aterrizar</span>
          </div>
        </div>

        <button
          type="button"
          className="btn-secondary btn-compact"
          onClick={() => resetToPhase1(selectedSite)}
          title="Reiniciar juego desde la Fase 1"
        >
          <RotateCcw size={13} />
          Reiniciar
        </button>
      </div>

      {/* CONTENIDO DE LA FASE ACTIVA */}
      {phase === 1 && (
        <div className="phase1-grid">
          <aside className="panel phase1-sidebar">
            <div className="panel-header">
              <div>
                <div className="eyebrow eyebrow-accent">
                  1. ELIGE PUNTO DE ATERRIZAJE
                </div>
                <div className="panel-sub">
                  Observa su latitud y longitud en la superficie lunar
                </div>
              </div>
            </div>

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

            <button
              type="button"
              className={`btn-secondary btn-compact ${pinMode ? "active" : ""}`}
              onClick={() => setPinMode((v) => !v)}
            >
              <Crosshair size={14} />
              {pinMode
                ? "Pin 3D activo (haz clic en la Luna)"
                : "Elegir punto libre en la Luna 3D"}
            </button>

            {/* Tarjeta visible de coordenadas del punto elegido */}
            <div className="phase1-target-readout">
              <div className="eyebrow">COORDENADAS VISIBLES EN SUPERFICIE</div>
              <div className="phase1-coord-pair mono">
                <div>
                  <span className="muted-note">Latitud:</span>{" "}
                  <strong className="kpi-sun">
                    {selectedSite.latitudeDeg.toFixed(2)}°
                  </strong>
                </div>
                <div>
                  <span className="muted-note">Longitud:</span>{" "}
                  <strong className="kpi-earth">
                    {selectedSite.longitudeEastDeg.toFixed(2)}°E
                  </strong>
                </div>
              </div>
            </div>

            {/* SUPERCALCULADORA CON TECLADO */}
            <SuperCalculator
              targetLatitudeDeg={selectedSite.latitudeDeg}
              targetLongitudeDeg={selectedSite.longitudeEastDeg}
              orbitAltitudeKm={selectedSite.orbitAltitudeKm}
              solvedInclination={solvedInclination}
              onCalculated={(sol) => {
                setSolvedInclination(sol);
                handleIlargiSpeak(
                  "Definición: Inclinación Orbital",
                  `La supercalculadora indica inclinación i = ${sol.requiredInclinationDeg.toFixed(2)}°. La inclinación es el ángulo entre tu órbita y el ecuador lunar: al inclinar la órbita hasta ese ángulo, el ground track alcanza la latitud de tu objetivo. ¡Pulsa "Aplicar inclinación" para inclinar la órbita!`,
                );
              }}
              onErrorFeedback={(msg) =>
                handleIlargiSpeak("Comprueba las coordenadas", msg)
              }
            />

            {/* Botones de maniobra y avance a Fase 2 */}
            {solvedInclination && !groundTrackAligned && (
              <button
                type="button"
                className="btn-primary phase1-apply-btn"
                disabled={tiltingOrbit}
                onClick={handleApplyInclination}
              >
                <Orbit size={16} />
                {tiltingOrbit
                  ? "Inclinando órbita y ground track…"
                  : `Aplicar inclinación (${solvedInclination.requiredInclinationDeg.toFixed(2)}°) a la órbita`}
              </button>
            )}

            {groundTrackAligned && (
              <button
                type="button"
                className="btn-primary phase1-next-btn"
                onClick={goToPhase2}
              >
                <CheckCircle2 size={16} />
                Pasar a Fase 2: Descenso Orbital
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

      {/* MASCOTA ILARGI GUIANDO EL JUEGO EN TODO MOMENTO */}
      <div className="panel edu-mascot-dock game-mascot-dock">
        <IlargiMascot
          speakerMood={ilargiState.mood}
          message={ilargiState.text}
          showFunFacts={false}
        />
      </div>
    </div>
  );
}
