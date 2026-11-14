import { useState } from "react";
import {
  Check,
  Crosshair,
  Plus,
  Rocket,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type {
  AnalysisParams,
  HistoricalSite,
  MineralLayerMeta,
  PointDraft,
} from "../types";

export const MAX_POINTS = 10;

interface InputPanelProps {
  points: PointDraft[];
  historicalSites: HistoricalSite[];
  mineralElements: MineralLayerMeta[];
  selectedMinerals: string[];
  params: AnalysisParams;
  focusedIndex: number | null;
  pinMode: boolean;
  loading: boolean;
  onToggleMineral: (id: string) => void;
  onTogglePinMode: () => void;
  onFocusPoint: (index: number) => void;
  onChangePoint: (index: number, patch: Partial<PointDraft>) => void;
  onSelectPreset: (index: number, presetId: string) => void;
  onAddPoint: () => void;
  onRemovePoint: (index: number) => void;
  onChangeParams: (patch: Partial<AnalysisParams>) => void;
  onLaunch: () => void;
}

export function InputPanel({
  points,
  historicalSites,
  mineralElements,
  selectedMinerals,
  params,
  focusedIndex,
  pinMode,
  loading,
  onToggleMineral,
  onTogglePinMode,
  onFocusPoint,
  onChangePoint,
  onSelectPreset,
  onAddPoint,
  onRemovePoint,
  onChangeParams,
  onLaunch,
}: InputPanelProps) {
  const [showParams, setShowParams] = useState(false);

  return (
    <aside className="panel input-panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow">INPUT</div>
          <div className="panel-sub">
            P<sub>i</sub>(λ, θ, t) · históricos o manuales
          </div>
        </div>
        <span className="pill pill-muted">
          {points.length} / {MAX_POINTS} max
        </span>
      </div>

      <div className="pin-mode-row">
        <button
          type="button"
          className={`btn-secondary btn-compact ${pinMode ? "active" : ""}`}
          onClick={onTogglePinMode}
          title="Permite hacer clic directamente sobre la esfera lunar para fijar coordenadas"
        >
          <Crosshair size={14} />
          {pinMode ? "Pin en globo: ACTIVO" : "Pin en globo 3D"}
        </button>
      </div>

      <div className="points-list">
        {points.length === 0 && (
          <div className="empty-hint">
            Haz clic en cualquier punto histórico del globo 3D o pulsa{" "}
            <strong>+</strong> para definir P<sub>1</sub>(λ, θ, t).
          </div>
        )}

        {points.map((pt, idx) => (
          <div
            key={pt.uid}
            className={`point-card ${focusedIndex === idx ? "focused" : ""}`}
            onClick={() => onFocusPoint(idx)}
          >
            <div className="point-card-head">
              <span className="point-tag">P{idx + 1}</span>
              <select
                className="input-select"
                value={pt.presetId}
                onChange={(e) => onSelectPreset(idx, e.target.value)}
                aria-label={`Emplazamiento P${idx + 1}`}
              >
                {historicalSites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.latitude_deg.toFixed(1)}°,{" "}
                    {s.longitude_east_deg.toFixed(1)}°)
                  </option>
                ))}
                <option value="manual">
                  Manual · Coordenadas propias (λ, θ)
                </option>
              </select>
              {points.length > 1 && (
                <button
                  type="button"
                  className="btn-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemovePoint(idx);
                  }}
                  title={`Eliminar P${idx + 1}`}
                  aria-label={`Eliminar P${idx + 1}`}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="field-grid-2">
              <label className="field">
                <span>λ Latitud (°)</span>
                <input
                  type="number"
                  step="0.001"
                  min={-89.999}
                  max={89.999}
                  value={pt.latitudeDeg}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v)) {
                      onChangePoint(idx, {
                        latitudeDeg: Math.max(-89.999, Math.min(89.999, v)),
                        presetId: "manual",
                        siteName: "Coordenada manual",
                      });
                    }
                  }}
                />
              </label>

              <label className="field">
                <span>θ Longitud (°E)</span>
                <input
                  type="number"
                  step="0.001"
                  min={-180}
                  max={180}
                  value={pt.longitudeEastDeg}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v)) {
                      onChangePoint(idx, {
                        longitudeEastDeg: Math.max(-180, Math.min(180, v)),
                        presetId: "manual",
                        siteName: "Coordenada manual",
                      });
                    }
                  }}
                />
              </label>
            </div>

            <div className="field-grid-2">
              <label className="field">
                <span>t Fecha UTC</span>
                <input
                  type="date"
                  min="1972-01-01"
                  max="2100-12-31"
                  value={pt.startDate}
                  onChange={(e) =>
                    onChangePoint(idx, { startDate: e.target.value })
                  }
                />
              </label>

              <label className="field">
                <span>Hora UTC</span>
                <input
                  type="time"
                  value={pt.startTime}
                  onChange={(e) =>
                    onChangePoint(idx, { startTime: e.target.value })
                  }
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="add-row">
        <button
          type="button"
          className="btn-secondary"
          disabled={points.length >= MAX_POINTS}
          onClick={onAddPoint}
        >
          <Plus size={15} />
          Añadir punto
        </button>
        <span className="muted-note">max {MAX_POINTS}</span>
      </div>

      <div className="params-section">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setShowParams((s) => !s)}
        >
          <SlidersHorizontal size={14} />
          {showParams
            ? "Ocultar parámetros LOLA / ventana"
            : "Parámetros LOLA / ventana"}
        </button>

        {showParams && (
          <div className="params-box">
            <div className="field-grid-2">
              <label className="field">
                <span>Duración (h)</span>
                <input
                  type="number"
                  min={1}
                  max={2160}
                  step={24}
                  value={params.durationHours}
                  onChange={(e) =>
                    onChangeParams({
                      durationHours: Math.max(
                        1,
                        Math.min(2160, Number(e.target.value) || 24),
                      ),
                    })
                  }
                />
              </label>

              <label className="field">
                <span>Paso temporal</span>
                <select
                  value={params.stepMinutes}
                  onChange={(e) =>
                    onChangeParams({ stepMinutes: Number(e.target.value) })
                  }
                >
                  <option value={10}>10 min</option>
                  <option value={20}>20 min</option>
                  <option value={30}>30 min</option>
                  <option value={60}>1 hora</option>
                  <option value={120}>2 horas</option>
                  <option value={180}>3 horas</option>
                  <option value={360}>6 horas</option>
                  <option value={720}>12 horas</option>
                  <option value={1440}>24 horas</option>
                </select>
              </label>
            </div>

            <label className="field">
              <span>Cobertura DEM LOLA</span>
              <select
                value={params.demMode}
                onChange={(e) =>
                  onChangeParams({
                    demMode: e.target.value as AnalysisParams["demMode"],
                  })
                }
              >
                <option value="auto">
                  Automático (80m Polo Sur / ≈237m Global)
                </option>
                <option value="polar">Polo Sur completo (80 m/px)</option>
                <option value="global">Luna completa (≈237 m/px)</option>
                <option value="sample20">
                  Muestra local Polo Sur (20 m/px)
                </option>
                <option value="ideal">Esfera ideal (0° sin relieve)</option>
              </select>
            </label>

            <div className="field-grid-2">
              <label className="field">
                <span>Altura (m)</span>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  step={1}
                  value={params.instrumentHeightM}
                  onChange={(e) =>
                    onChangeParams({
                      instrumentHeightM: Math.max(
                        0,
                        Number(e.target.value) || 0,
                      ),
                    })
                  }
                />
              </label>

              <label className="field">
                <span>Rayos (°)</span>
                <select
                  value={params.azimuthStepDeg}
                  onChange={(e) =>
                    onChangeParams({ azimuthStepDeg: Number(e.target.value) })
                  }
                >
                  <option value={0.25}>0.25°</option>
                  <option value={0.5}>0.5°</option>
                  <option value={1.0}>1°</option>
                  <option value={2.0}>2°</option>
                </select>
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="minerals-section">
        <div className="eyebrow">Minerales (máscara 3D)</div>
        <div className="mineral-list">
          {mineralElements.map((el) => {
            const checked = selectedMinerals.includes(el.id);
            return (
              <label
                key={el.id}
                className={`mineral-item ${checked ? "checked" : ""}`}
                title={
                  el.available
                    ? `Mostrar regiones LP-GRS de ${el.label}`
                    : (el.status ?? "Sin datos validados aún")
                }
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => onToggleMineral(el.id)}
                />
                <span
                  className="mineral-check-box"
                  style={
                    checked
                      ? {
                          backgroundColor: el.color,
                          borderColor: el.color,
                        }
                      : { borderColor: el.color }
                  }
                >
                  {checked && (
                    <Check size={12} strokeWidth={3} color="#0b101b" />
                  )}
                </span>
                <span className="mineral-label">{el.label}</span>
                {!el.available && (
                  <span className="mineral-future-tag">sin datos</span>
                )}
              </label>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        className="btn-primary launch-btn"
        disabled={points.length === 0 || loading}
        onClick={onLaunch}
      >
        <Rocket size={16} />
        {loading ? "CALCULANDO..." : "LAUNCH"}
      </button>
    </aside>
  );
}
