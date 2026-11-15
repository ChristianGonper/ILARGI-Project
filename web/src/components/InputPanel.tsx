import { useEffect, useState } from "react";
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

function CoordinateInput({
  value,
  min,
  max,
  onValue,
}: {
  value: number;
  min: number;
  max: number;
  onValue: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <input
      type="number"
      step="1"
      min={min}
      max={max}
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
        if (
          event.target.value !== "" &&
          Number.isFinite(event.target.valueAsNumber)
        ) {
          onValue(Math.max(min, Math.min(max, event.target.valueAsNumber)));
        }
      }}
      onBlur={() => setDraft(String(value))}
    />
  );
}

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
            P<sub>i</sub>(λ, θ, t) · catalog or manual
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
          title="Click the lunar globe to set coordinates"
        >
          <Crosshair size={14} />
          {pinMode ? "Globe pin: ACTIVE" : "Place a globe pin"}
        </button>
      </div>

      <div className="points-list">
        {points.length === 0 && (
          <div className="empty-hint">
            Click a catalog site on the globe or press <strong>+</strong> to
            define P<sub>1</sub>(λ, θ, t).
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
                aria-label={`Site P${idx + 1}`}
              >
                {historicalSites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.latitude_deg.toFixed(1)}°,{" "}
                    {s.longitude_east_deg.toFixed(1)}°)
                  </option>
                ))}
                <option value="manual">
                  Manual · Custom coordinates (λ, θ)
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
                  title={`Remove P${idx + 1}`}
                  aria-label={`Remove P${idx + 1}`}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="field-grid-2">
              <label className="field">
                <span>λ Latitude (°)</span>
                <CoordinateInput
                  value={pt.latitudeDeg}
                  min={-89.999}
                  max={89.999}
                  onValue={(value) =>
                    onChangePoint(idx, {
                      latitudeDeg: value,
                      presetId: "manual",
                      siteName: "Manual coordinates",
                    })
                  }
                />
              </label>

              <label className="field">
                <span>θ East longitude (°)</span>
                <CoordinateInput
                  value={pt.longitudeEastDeg}
                  min={-180}
                  max={180}
                  onValue={(value) =>
                    onChangePoint(idx, {
                      longitudeEastDeg: value,
                      presetId: "manual",
                      siteName: "Manual coordinates",
                    })
                  }
                />
              </label>
            </div>

            <div className="field-grid-2">
              <label className="field">
                <span>t UTC date</span>
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
                <span>UTC time</span>
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
          Add point
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
          {showParams ? "Hide Analysis settings" : "Analysis settings"}
        </button>

        {showParams && (
          <div className="params-box">
            <div className="field-grid-2">
              <label className="field">
                <span>Duration (h)</span>
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
                <span>Time step</span>
                <select
                  value={params.stepMinutes}
                  onChange={(e) =>
                    onChangeParams({ stepMinutes: Number(e.target.value) })
                  }
                >
                  <option value={10}>10 min</option>
                  <option value={20}>20 min</option>
                  <option value={30}>30 min</option>
                  <option value={60}>1 hour</option>
                  <option value={120}>2 hours</option>
                  <option value={180}>3 hours</option>
                  <option value={360}>6 hours</option>
                  <option value={720}>12 hours</option>
                  <option value={1440}>24 hours</option>
                </select>
              </label>
            </div>

            <div className="field-grid-2">
              <label className="field">
                <span>Height (m)</span>
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
            </div>
          </div>
        )}
      </div>

      <div className="minerals-section">
        <div className="eyebrow">Materials and WEH (3D overlay)</div>
        <div className="mineral-list">
          {[...mineralElements]
            .sort((a, b) => Number(b.id === "WEH") - Number(a.id === "WEH"))
            .map((el) => {
              const checked = selectedMinerals.includes(el.id);
              return (
                <label
                  key={el.id}
                  className={`mineral-item ${checked ? "checked" : ""}`}
                  title={
                    el.available
                      ? el.id === "WEH"
                        ? "Estimated global WEH: stronger intensity means higher abundance"
                        : `Show LP-GRS regions for ${el.label}`
                      : (el.status ?? "No validated data yet")
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
                    <span className="mineral-future-tag">no data</span>
                  )}
                </label>
              );
            })}
        </div>
        {selectedMinerals.includes("WEH") && (
          <p>
            WEH: stronger intensity means higher abundance; it does not confirm
            ice. Lawrence et al. (2022).
          </p>
        )}
      </div>

      <button
        type="button"
        className="btn-primary launch-btn"
        disabled={points.length === 0 || loading}
        onClick={onLaunch}
      >
        <Rocket size={16} />
        {loading ? "CALCULATING..." : "LAUNCH"}
      </button>
    </aside>
  );
}
