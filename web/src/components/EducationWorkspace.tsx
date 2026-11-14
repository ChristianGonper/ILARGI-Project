import { useEffect, useMemo, useState } from "react";
import {
  Crosshair,
  Droplets,
  Info,
  Pause,
  Play,
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
import {
  ThreeBodyOrbitMini,
  phaseLabelFromFraction,
} from "./ThreeBodyOrbitMini";

const CATEGORY_OPTIONS: {
  id: "all" | EducationCategory;
  label: string;
}[] = [
  { id: "all", label: "Todos" },
  { id: "eternal_light", label: "Luz continua" },
  { id: "psr", label: "Oscuridad (PSR)" },
  { id: "landing", label: "Landing" },
  { id: "mirror", label: "Espejos" },
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

  // Control de película del ciclo lunar completo (~29,53 días = 708,73 h)
  const [hoursOffset, setHoursOffset] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedHoursPerSec, setSpeedHoursPerSec] = useState(36);

  // Capas educativas: SOLO agua (materiales) + explicador del espejo de la Luna
  const [showWaterLayer, setShowWaterLayer] = useState(false);
  const [showMirrorGuide, setShowMirrorGuide] = useState(false);
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
            : "No se pudieron cargar los puntos educativos",
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
              : "Error al calcular el ciclo lunar",
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

  // Bucle de reproducción fluida ("como si fuese una película")
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
      mood: "Punto personalizado",
      text: isPolar
        ? `Has pinchado en una zona polar (${latitudeDeg.toFixed(1)}°, ${longitudeEastDeg.toFixed(1)}°E). ¡Fíjate cómo el Sol pasa rasante sobre el relieve durante todo el ciclo!`
        : `Has elegido el punto (${latitudeDeg.toFixed(1)}°, ${longitudeEastDeg.toFixed(1)}°E). Dale a reproducir la película para ver cómo avanza la frontera entre el día y la noche lunar.`,
    });
  };

  const handleToggleWater = () => {
    const next = !showWaterLayer;
    setShowWaterLayer(next);
    if (next) {
      setIlargiOverride({
        mood: "Agua y Hielo Lunar",
        text: "¡Capa de Agua activada! En la Luna no hay ríos ni nubes, pero en las regiones en sombra permanente (PSR) de NASA PGDA 69 la temperatura cae bajo −163 °C y el hielo de agua queda atrapado durante millones de años, como confirmó LCROSS en Cabeus.",
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
        mood: "El Espejo de la Luna",
        text: "¡Los espejos de la Luna son en realidad prismas en esquina de cubo! Devuelven cualquier rayo láser justo al mismo telescopio en la Tierra. Midiendo cuánto tarda en ir y volver (~2,5 s) descubrimos que la Luna se aleja 3,8 cm cada año.",
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
      mood: "Guía lunar",
      text: "Elige un punto de aterrizaje, un pico de luz continua o una zona en sombra permanente, y pulsa Reproducir para ver el ciclo completo de un día lunar.",
    };
  }, [ilargiOverride, selectedSite]);

  const lunarDaysElapsed = hoursOffset / 24.0;
  const lunarDayPct = Math.min(100, (hoursOffset / 708.734) * 100);

  return (
    <div className="edu-shell">
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
        {/* PANEL IZQUIERDO: Selector de punto + Slider ciclo lunar debajo + Solo Agua + Espejo */}
        <aside className="panel edu-sidebar">
          <div className="panel-header">
            <div>
              <div className="eyebrow">1. SELECTOR DEL PUNTO</div>
              <div className="panel-sub">
                Landing spots, luz continua, oscuridad (PGDA 69) y espejos
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
              aria-label="Seleccionar lugar lunar"
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
                        ? "Luz"
                        : s.category === "psr"
                          ? "PSR"
                          : s.category === "mirror"
                            ? "Espejo"
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
                ? "Pin en globo: ACTIVO (haz clic en la Luna)"
                : "Pin libre en globo 3D"}
            </button>
          </div>

          {/* SLIDER DEL CICLO COMPLETO LUNAR DIRECTAMENTE DEBAJO DEL SELECTOR */}
          <div className="edu-movie-box">
            <div className="panel-header">
              <div>
                <div className="eyebrow eyebrow-accent">
                  2. PELÍCULA · CICLO COMPLETO LUNAR
                </div>
                <div className="panel-sub">
                  1 día lunar completo ≈ 29,53 días terrestres (709 h)
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
                      mood: "Película solar en marcha",
                      text: "¡Observa cómo avanza la luz solar sobre los cráteres! Puedes girar el globo lunar libremente con el ratón mientras la película sigue proyectando el día y la noche lunar.",
                    });
                  }
                }}
              >
                {playing ? <Pause size={15} /> : <Play size={15} />}
                {playing ? "Pausar película" : "Reproducir película"}
              </button>

              <button
                type="button"
                className="btn-secondary btn-compact"
                onClick={() => {
                  setPlaying(false);
                  setHoursOffset(0);
                }}
                title="Volver al inicio del ciclo"
              >
                <RotateCcw size={14} />
              </button>

              <select
                className="edu-speed-select"
                value={speedHoursPerSec}
                onChange={(e) => setSpeedHoursPerSec(Number(e.target.value))}
                aria-label="Velocidad de la película"
              >
                <option value={12}>1× lento</option>
                <option value={36}>3× normal</option>
                <option value={72}>6× rápido</option>
                <option value={144}>12× turbo</option>
              </select>
            </div>

            <label className="edu-slider-label">
              <div className="edu-slider-meta">
                <span className="mono">
                  Día {lunarDaysElapsed.toFixed(1)} / 29,5 (
                  {Math.round(hoursOffset)} h)
                </span>
                <span className="mono">
                  {lunarDayPct.toFixed(0)}% del ciclo
                </span>
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
                  <span className="muted-note">Instante UTC</span>
                  <span className="mono">
                    {formatUtcShort(currentFrame.utc)}
                  </span>
                </div>
                <div className="edu-live-row">
                  <span className="muted-note">Sol en este punto</span>
                  <span
                    className={`pill ${currentFrame.sun_visible ? "pill-amber" : "pill-muted"}`}
                  >
                    <Sun size={11} />{" "}
                    {currentFrame.sun_visible
                      ? `Iluminado (${currentFrame.sun_elevation_deg.toFixed(1)}°)`
                      : `En sombra (${currentFrame.sun_elevation_deg.toFixed(1)}°)`}
                  </span>
                </div>
                <div className="edu-live-row">
                  <span className="muted-note">Fase lunar (desde Tierra)</span>
                  <span className="mono">
                    {Math.round(currentFrame.illumination_fraction * 100)}% ·{" "}
                    {phaseLabelFromFraction(currentFrame.illumination_fraction)}
                  </span>
                </div>
              </div>
            )}

            <label className="field edu-date-field">
              <span>Fecha inicio simulación (UTC)</span>
              <input
                type="date"
                min="1972-01-01"
                max="2100-12-31"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
          </div>

          {/* MATERIALES: SOLO AGUA + EXPLICACIÓN ESPEJO DE LA LUNA */}
          <div className="edu-extras-box">
            <div className="eyebrow">3. AGUA Y FENÓMENOS LUNARES</div>
            <button
              type="button"
              className={`btn-secondary edu-feature-btn ${showWaterLayer ? "active" : ""}`}
              onClick={handleToggleWater}
            >
              <Droplets size={15} className="tag-earth" />
              <span>Agua / Hielo Polar (Solo agua · PSR)</span>
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
              <span>¿Qué es el Espejo de la Luna?</span>
              <span className="pill pill-ok">LRRR</span>
            </button>

            <a
              href="https://pgda.gsfc.nasa.gov/products/69"
              target="_blank"
              rel="noreferrer"
              className="edu-pgda-link"
            >
              <Info size={13} />
              Datos PSR / Luz continua: NASA PGDA LOLA 69
            </a>
          </div>
        </aside>

        {/* ZONA PRINCIPAL: Globo 3D + Miniventana 3 Cuerpos SIMULTÁNEOS + Mascota ILARGI */}
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
                      title="Cerrar explicación"
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
                    <strong>¿Qué descubrimos gracias a ellos?</strong>
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
                          ? "COORDENADA MANUAL"
                          : (selectedSite?.category_label ?? "FICHA DEL LUGAR")}
                      </div>
                      <h3 className="edu-site-title">
                        {manualCoords
                          ? `Punto (${manualCoords.latitudeDeg.toFixed(2)}°, ${manualCoords.longitudeEastDeg.toFixed(2)}°E)`
                          : (selectedSite?.name ?? "Selecciona un punto")}
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
                        <strong className="tag-sun">Luz solar:</strong>{" "}
                        {selectedSite.illumination_note}
                      </div>
                      <div>
                        <strong className="tag-earth">Tierra:</strong>{" "}
                        {selectedSite.earth_visibility_note}
                      </div>
                      <div>
                        <strong className="tag-ok">Agua (H₂O):</strong>{" "}
                        {selectedSite.water_note}
                      </div>
                    </div>
                  ) : (
                    <p className="edu-card-p">
                      Coordenadas seleccionadas directamente sobre la esfera
                      lunar. Usa la película del ciclo lunar para observar cómo
                      varía la elevación solar y activa la capa de{" "}
                      <strong>Agua / Trampas Frías</strong> para ubicar los PSR
                      polares.
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
