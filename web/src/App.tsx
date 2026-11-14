import { useCallback, useEffect, useState } from "react";
import {
  analyzePoints,
  fetchHealth,
  fetchHistoricalSites,
  fetchMaterialsOverlay,
} from "./api";
import { ComparisonPanel } from "./components/ComparisonPanel";
import { InputPanel, MAX_POINTS } from "./components/InputPanel";
import { MoonViewport3D } from "./components/MoonViewport3D";
import { OutputsPanel } from "./components/OutputsPanel";
import type {
  AnalysisParams,
  HealthResponse,
  HistoricalSite,
  MaterialsOverlayResponse,
  PointDraft,
  SiteAnalysisResult,
} from "./types";

function makePointFromSite(uid: number, site: HistoricalSite): PointDraft {
  return {
    uid,
    presetId: site.id,
    siteName: site.name,
    latitudeDeg: site.latitude_deg,
    longitudeEastDeg: site.longitude_east_deg,
    startDate: "2026-04-02",
    startTime: "15:00",
  };
}

function makeManualPoint(uid: number, lat = -89.5, lon = 0): PointDraft {
  return {
    uid,
    presetId: "manual",
    siteName: "Coordenada manual",
    latitudeDeg: lat,
    longitudeEastDeg: lon,
    startDate: "2026-04-02",
    startTime: "15:00",
  };
}

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [historicalSites, setHistoricalSites] = useState<HistoricalSite[]>([]);
  const [mineralOverlay, setMineralOverlay] =
    useState<MaterialsOverlayResponse | null>(null);
  const [selectedMinerals, setSelectedMinerals] = useState<string[]>([]);
  const [points, setPoints] = useState<PointDraft[]>([
    {
      uid: 1,
      presetId: "lola-center",
      siteName: "Polo Sur · Muestra LOLA Centro",
      latitudeDeg: -89.5,
      longitudeEastDeg: 0,
      startDate: "2026-04-02",
      startTime: "15:00",
    },
  ]);
  const [nextUid, setNextUid] = useState(2);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [pinMode, setPinMode] = useState(false);

  const [params, setParams] = useState<AnalysisParams>({
    durationHours: 720,
    stepMinutes: 60,
    instrumentHeightM: 2,
    azimuthStepDeg: 1,
    demMode: "auto",
  });

  // null al inicio: el panel de OUTPUTS solo aparece tras hacer una selección/LAUNCH.
  const [results, setResults] = useState<SiteAnalysisResult[] | null>(null);
  const [comparedLabels, setComparedLabels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    void fetchHealth()
      .then(setHealth)
      .catch(() => undefined);
    void fetchMaterialsOverlay()
      .then(setMineralOverlay)
      .catch(() => undefined);
    void fetchHistoricalSites()
      .then((sites) => {
        setHistoricalSites(sites);
      })
      .catch((err: unknown) => {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : "No se pudieron cargar los sitios históricos",
        );
      });
  }, []);

  const runAnalysis = useCallback(
    async (targetPoints: PointDraft[], activeParams: AnalysisParams) => {
      if (targetPoints.length === 0) return;
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await analyzePoints(targetPoints, activeParams);
        setResults(res);
        const valid = new Set(res.map((r) => r.label));
        setComparedLabels((prev) => prev.filter((l) => valid.has(l)));
      } catch (err: unknown) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : "Error al analizar emplazamientos",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handleSelectPreset = (index: number, presetId: string) => {
    setPoints((prev) =>
      prev.map((pt, i) => {
        if (i !== index) return pt;
        if (presetId === "manual") {
          return { ...pt, presetId: "manual", siteName: "Coordenada manual" };
        }
        const site = historicalSites.find((s) => s.id === presetId);
        if (!site) return pt;
        return {
          ...pt,
          presetId: site.id,
          siteName: site.name,
          latitudeDeg: site.latitude_deg,
          longitudeEastDeg: site.longitude_east_deg,
        };
      }),
    );
    setFocusedIndex(index);
  };

  const handleChangePoint = (index: number, patch: Partial<PointDraft>) => {
    setPoints((prev) =>
      prev.map((pt, i) => (i === index ? { ...pt, ...patch } : pt)),
    );
    setFocusedIndex(index);
  };

  const handleAddPoint = () => {
    if (points.length >= MAX_POINTS) return;
    const site =
      historicalSites.length > 0
        ? historicalSites[points.length % historicalSites.length]
        : null;
    const added = site
      ? makePointFromSite(nextUid, site)
      : makeManualPoint(nextUid);
    setNextUid((u) => u + 1);
    setPoints((prev) => [...prev, added]);
    setFocusedIndex(points.length);
  };

  const handleRemovePoint = (index: number) => {
    setPoints((prev) => prev.filter((_, i) => i !== index));
    setFocusedIndex((prev) => (prev === index ? null : prev));
  };

  const handleGlobeHistoricalClick = (site: HistoricalSite) => {
    // Si ya existe en INPUT, enfocarlo (y si es único, analizarlo directamente).
    const existingIdx = points.findIndex((p) => p.presetId === site.id);
    if (existingIdx >= 0) {
      setFocusedIndex(existingIdx);
      if (points.length === 1) {
        void runAnalysis(points, params);
      }
      return;
    }

    // Si estamos con 1 punto y aún no hay multi-selección, seleccionarlo y mostrar OUTPUTS.
    if (points.length <= 1) {
      const updated = [makePointFromSite(points[0]?.uid ?? nextUid, site)];
      if (points.length === 0) setNextUid((u) => u + 1);
      setPoints(updated);
      setFocusedIndex(0);
      void runAnalysis(updated, params);
      return;
    }

    // En modo multi-punto, añadir al INPUT (hasta max 10).
    if (points.length < MAX_POINTS) {
      const added = makePointFromSite(nextUid, site);
      setNextUid((u) => u + 1);
      setPoints((prev) => [...prev, added]);
      setFocusedIndex(points.length);
    }
  };

  const handleSurfacePick = (latitudeDeg: number, longitudeEastDeg: number) => {
    if (points.length === 0) {
      const created = [makeManualPoint(nextUid, latitudeDeg, longitudeEastDeg)];
      setNextUid((u) => u + 1);
      setPoints(created);
      setFocusedIndex(0);
      setPinMode(false);
      void runAnalysis(created, params);
      return;
    }
    const targetIdx =
      focusedIndex !== null && focusedIndex < points.length ? focusedIndex : 0;
    const updated = points.map((pt, i) =>
      i === targetIdx
        ? {
            ...pt,
            presetId: "manual",
            siteName: "Coordenada manual",
            latitudeDeg,
            longitudeEastDeg,
          }
        : pt,
    );
    setPoints(updated);
    setFocusedIndex(targetIdx);
    setPinMode(false);
    if (updated.length === 1) {
      void runAnalysis(updated, params);
    }
  };

  const singleResult = results && results.length === 1 ? results[0] : null;
  const multiResults = results && results.length > 1 ? results : null;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <span className="brand-title">ILARGI</span>
          <span className="badge-pro">PRO</span>
          <span className="brand-sub">
            Interactive Lunar Analyzer for Radiance, Geometry, and
            Intervisibility
          </span>
        </div>
        <div className="topbar-right">
          {health?.dem.polar_80m && (
            <span className="pill pill-cyan">LOLA 80m Polo Sur</span>
          )}
          {health?.dem.global_240m && (
            <span className="pill pill-cyan">LOLA ≈237m Global</span>
          )}
          <span className="pill pill-muted">
            {health?.frame ?? "MOON_ME_DE440_ME421"} ·{" "}
            {health?.abcorr ?? "LT+S"}
          </span>
          <span className="pill pill-ok">
            {health?.kernels ?? "DE440s"} · OK
          </span>
        </div>
      </header>

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

      <main
        className={`workspace-grid ${singleResult ? "with-outputs" : "globe-wide"}`}
      >
        <InputPanel
          points={points}
          historicalSites={historicalSites}
          mineralElements={mineralOverlay?.elements ?? []}
          selectedMinerals={selectedMinerals}
          params={params}
          focusedIndex={focusedIndex}
          pinMode={pinMode}
          loading={loading}
          onToggleMineral={(id) =>
            setSelectedMinerals((prev) =>
              prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
            )
          }
          onTogglePinMode={() => setPinMode((v) => !v)}
          onFocusPoint={setFocusedIndex}
          onChangePoint={handleChangePoint}
          onSelectPreset={handleSelectPreset}
          onAddPoint={handleAddPoint}
          onRemovePoint={handleRemovePoint}
          onChangeParams={(patch) => setParams((p) => ({ ...p, ...patch }))}
          onLaunch={() => void runAnalysis(points, params)}
        />

        <section className="panel moon-panel">
          <MoonViewport3D
            historicalSites={historicalSites}
            activePoints={points}
            focusedIndex={singleResult ? 0 : focusedIndex}
            pinMode={pinMode}
            mineralOverlay={mineralOverlay}
            selectedMinerals={selectedMinerals}
            onSelectHistoricalSite={handleGlobeHistoricalClick}
            onSelectActivePoint={(idx) => setFocusedIndex(idx)}
            onSurfacePick={handleSurfacePick}
          />
        </section>

        {singleResult && (
          <OutputsPanel
            result={singleResult}
            onClose={() => setResults(null)}
          />
        )}
      </main>

      {multiResults && (
        <ComparisonPanel
          results={multiResults}
          comparedLabels={comparedLabels}
          onTogglePlot={(label) =>
            setComparedLabels((prev) =>
              prev.includes(label)
                ? prev.filter((l) => l !== label)
                : [...prev, label],
            )
          }
          onClearPlots={() => setComparedLabels([])}
        />
      )}
    </div>
  );
}
