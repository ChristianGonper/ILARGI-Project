"""Panel general PRO de ILARGI: globo lunar 3D, análisis puntual y comparativa."""

from datetime import UTC, date, datetime, time
from pathlib import Path

import numpy as np
import pandas as pd
import streamlit as st
from spiceypy.utils.exceptions import SpiceyError

from ilargi.analysis import (
    SiteAnalysis,
    analyze_site,
    format_events_summary,
    format_span,
)
from ilargi.horizon import calculate_horizon, coverage_at, horizon_at
from ilargi.materials import load_regions
from ilargi.series import sky_series
from ilargi.sites import HISTORICAL_SITES, SITE_BY_ID
from ilargi.terrain import SAMPLE, sample_elevation
from ilargi.terrain_image import render_terrain_png
from ilargi.ui.presentation import (
    elevation_figure,
    moon_globe_figure,
    sky_figure,
)

SAMPLE_20 = SAMPLE.with_name("lola_20m_south_pole_sample.tif")
MAX_POINTS = 10

STEP_MINUTES = {
    "10 minutos": 10,
    "20 minutos": 20,
    "30 minutos": 30,
    "1 hora": 60,
    "2 horas": 120,
    "3 horas": 180,
    "6 horas": 360,
    "12 horas": 720,
    "24 horas": 1440,
}

PRO_CSS = """
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

  html, body, [class*="css"] {
    font-family: 'Inter', system-ui, sans-serif;
  }
  .block-container {
    padding-top: 1.0rem;
    padding-bottom: 2.0rem;
    max-width: 1680px;
  }
  .ilargi-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #131B2E;
    border: 1px solid #26334D;
    border-radius: 8px;
    padding: 10px 16px;
    margin-bottom: 12px;
  }
  .ilargi-brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .ilargi-title {
    font-size: 18px;
    font-weight: 700;
    color: #F1F5F9;
    letter-spacing: -0.015em;
  }
  .ilargi-badge {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid #38BDF8;
    background: rgba(56, 189, 248, 0.12);
    color: #38BDF8;
  }
  .ilargi-pill-ok {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 500;
    padding: 3px 9px;
    border-radius: 4px;
    border: 1px solid #10B981;
    background: rgba(16, 185, 129, 0.12);
    color: #10B981;
  }
  .ilargi-pill-muted {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    padding: 3px 9px;
    border-radius: 4px;
    border: 1px solid #26334D;
    background: #0B101B;
    color: #94A3B8;
  }
  .ilargi-section-eyebrow {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #94A3B8;
    margin-bottom: 6px;
  }
  .ilargi-card {
    background: #131B2E;
    border: 1px solid #26334D;
    border-radius: 8px;
    padding: 12px 14px;
    margin-bottom: 10px;
  }
  .ilargi-card-accent {
    background: #131B2E;
    border: 1px solid #38BDF8;
    border-radius: 8px;
    padding: 12px 14px;
    margin-bottom: 10px;
  }
  .ilargi-mono {
    font-family: 'JetBrains Mono', monospace;
    font-variant-numeric: tabular-nums;
  }
  .ilargi-kpi-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin: 8px 0 12px 0;
  }
  .ilargi-kpi {
    background: #0B101B;
    border: 1px solid #26334D;
    border-radius: 6px;
    padding: 8px 10px;
  }
  .ilargi-kpi-label {
    font-size: 11px;
    color: #94A3B8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .ilargi-kpi-value {
    font-family: 'JetBrains Mono', monospace;
    font-variant-numeric: tabular-nums;
    font-size: 18px;
    font-weight: 600;
    color: #F1F5F9;
  }
  .ilargi-kpi-sub {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #94A3B8;
  }
  .ilargi-row-divider {
    border-top: 1px solid #26334D;
    margin: 4px 0;
  }
</style>
"""


@st.cache_data(show_spinner=False)
def analyse(start, hours, step, lat, lon, instrument, search_km, az_step, path):
    terrain = sample_elevation(lat, lon, Path(path))
    horizon = calculate_horizon(
        lat, lon, instrument, search_km * 1000, az_step, Path(path)
    )
    series = sky_series(start, hours, step, lat, lon, terrain.elevation_m + instrument)
    series["horizonte_parcial_deg"] = horizon_at(horizon, series.azimut_deg)
    series["margen_parcial_deg"] = series.elevacion_deg - series.horizonte_parcial_deg
    series["cobertura_minima_vecina_m"] = coverage_at(horizon, series.azimut_deg)
    return terrain, horizon, series


@st.cache_data(show_spinner=False)
def cached_regions():
    return load_regions()


@st.cache_data(show_spinner=False)
def run_point_analysis(
    label: str,
    site_name: str,
    lat: float,
    lon: float,
    start_iso: str,
    duration_hours: float,
    step_minutes: int,
    instrument_m: float,
    search_km: float,
    az_step_deg: float,
    dem_path_str: str,
) -> SiteAnalysis:
    start_utc = datetime.fromisoformat(start_iso).astimezone(UTC)
    regions = cached_regions()
    return analyze_site(
        label=label,
        site_name=site_name,
        latitude_deg=lat,
        longitude_east_deg=lon,
        start_utc=start_utc,
        duration_hours=duration_hours,
        step_minutes=step_minutes,
        instrument_height_m=instrument_m,
        search_km=search_km,
        azimuth_step_deg=az_step_deg,
        dem_path=Path(dem_path_str),
        regions=regions,
    )


@st.cache_data(show_spinner=False)
def terrain_png(path, terrain, relief, window_km):
    return render_terrain_png(Path(path), terrain, relief=relief, window_km=window_km)


def _new_point(
    uid: int,
    *,
    preset_id: str = "lola-center",
    start_date: date | None = None,
    start_time: time | None = None,
) -> dict:
    if preset_id in SITE_BY_ID:
        site = SITE_BY_ID[preset_id]
        name = site.name
        lat = site.latitude_deg
        lon = site.longitude_east_deg
    else:
        name = "Coordenada manual"
        lat = -89.500
        lon = 0.000
        preset_id = "manual"
    d = start_date or date(2026, 4, 2)
    t = start_time or time(15, 0)
    return {
        "uid": uid,
        "preset_id": preset_id,
        "name": name,
        "lat": float(lat),
        "lon": float(lon),
        "start_date": d,
        "start_time": t,
        "start_str": f"{d.isoformat()} {t.strftime('%H:%M')} UTC",
    }


def _init_state() -> None:
    if "points" not in st.session_state:
        st.session_state.points = [_new_point(1, preset_id="lola-center")]
        st.session_state.next_uid = 2
    if "compared_plot_ids" not in st.session_state:
        st.session_state.compared_plot_ids = []
    if "analysis_params" not in st.session_state:
        st.session_state.analysis_params = {
            "hours": 720,
            "step_label": "1 hora",
            "dem_label": "80 m/píxel · zona amplia",
            "instrument": 2.0,
            "search_km": 20.0,
            "az_step": 1.0,
        }


def _execute_launch() -> None:
    params = st.session_state.analysis_params
    dem_path = SAMPLE_20 if params["dem_label"].startswith("20") else SAMPLE
    step_minutes = STEP_MINUTES[params["step_label"]]
    results: list[SiteAnalysis] = []
    errors: list[str] = []
    for idx, pt in enumerate(st.session_state.points):
        label = f"P{idx + 1}"
        start_dt = datetime.combine(pt["start_date"], pt["start_time"], tzinfo=UTC)
        try:
            res = run_point_analysis(
                label=label,
                site_name=pt["name"],
                lat=float(pt["lat"]),
                lon=float(pt["lon"]),
                start_iso=start_dt.isoformat(),
                duration_hours=float(params["hours"]),
                step_minutes=step_minutes,
                instrument_m=float(params["instrument"]),
                search_km=float(params["search_km"]),
                az_step_deg=float(params["az_step"]),
                dem_path_str=str(dem_path),
            )
            results.append(res)
        except (ValueError, OSError, SpiceyError) as exc:
            errors.append(f"{label} ({pt['name']}): {exc}")
    st.session_state.launched_results = results
    st.session_state.launch_errors = errors
    valid_labels = {r.label for r in results}
    st.session_state.compared_plot_ids = [
        lbl for lbl in st.session_state.compared_plot_ids if lbl in valid_labels
    ]


def _add_historical_site(site_id: str) -> None:
    if len(st.session_state.points) >= MAX_POINTS:
        st.toast("Máximo de 10 puntos alcanzado.", icon="⚠️")
        return
    uid = st.session_state.next_uid
    st.session_state.next_uid += 1
    st.session_state.points.append(_new_point(uid, preset_id=site_id))


def _render_input_panel() -> bool:
    st.markdown(
        '<div class="ilargi-card">'
        '<div style="display:flex;justify-content:space-between;align-items:center;">'
        '<span class="ilargi-section-eyebrow" style="margin:0;">INPUT · Emplazamientos</span>'
        f'<span class="ilargi-pill-muted">{len(st.session_state.points)} / {MAX_POINTS} max</span>'
        "</div>"
        '<div style="font-size:12px;color:#94A3B8;margin-top:4px;">'
        "P<sub>i</sub>(λ, θ, t): elige puntos históricos o introduce coordenadas manuales."
        "</div></div>",
        unsafe_allow_html=True,
    )

    preset_options = [s.id for s in HISTORICAL_SITES] + ["manual"]
    preset_labels = {
        s.id: f"{s.name} ({s.latitude_deg:.1f}°, {s.longitude_east_deg:.1f}°)"
        for s in HISTORICAL_SITES
    }
    preset_labels["manual"] = "Manual · Coordenadas propias (λ, θ)"

    to_remove: int | None = None
    for idx, pt in enumerate(st.session_state.points):
        uid = pt["uid"]
        with st.container(border=True):
            h_left, h_right = st.columns([0.82, 0.18])
            with h_left:
                chosen = st.selectbox(
                    f"P{idx + 1}",
                    preset_options,
                    index=preset_options.index(pt["preset_id"])
                    if pt["preset_id"] in preset_options
                    else len(preset_options) - 1,
                    format_func=lambda key: preset_labels[key],
                    key=f"preset_{uid}",
                )
            with h_right:
                st.write("")
                if len(st.session_state.points) > 1 and st.button(
                    "✕", key=f"del_{uid}", help=f"Eliminar P{idx + 1}"
                ):
                    to_remove = idx

            if chosen != pt["preset_id"]:
                pt["preset_id"] = chosen
                if chosen in SITE_BY_ID:
                    site = SITE_BY_ID[chosen]
                    pt["name"] = site.name
                    pt["lat"] = float(site.latitude_deg)
                    pt["lon"] = float(site.longitude_east_deg)
                    st.session_state[f"lat_{uid}"] = float(site.latitude_deg)
                    st.session_state[f"lon_{uid}"] = float(site.longitude_east_deg)
                else:
                    pt["name"] = "Coordenada manual"

            c_lat, c_lon = st.columns(2)
            with c_lat:
                new_lat = st.number_input(
                    "λ Latitud (°)",
                    min_value=-89.999,
                    max_value=89.999,
                    value=float(pt["lat"]),
                    format="%.3f",
                    key=f"lat_{uid}",
                )
            with c_lon:
                new_lon = st.number_input(
                    "θ Longitud (°E)",
                    min_value=-180.0,
                    max_value=180.0,
                    value=float(pt["lon"]),
                    format="%.3f",
                    key=f"lon_{uid}",
                )

            if not np.isclose(new_lat, pt["lat"], atol=1e-6) or not np.isclose(
                new_lon, pt["lon"], atol=1e-6
            ):
                pt["lat"] = float(new_lat)
                pt["lon"] = float(new_lon)
                if pt["preset_id"] in SITE_BY_ID:
                    ref = SITE_BY_ID[pt["preset_id"]]
                    if not (
                        np.isclose(new_lat, ref.latitude_deg, atol=1e-4)
                        and np.isclose(new_lon, ref.longitude_east_deg, atol=1e-4)
                    ):
                        pt["preset_id"] = "manual"
                        pt["name"] = "Coordenada manual"

            c_d, c_t = st.columns(2)
            with c_d:
                pt["start_date"] = st.date_input(
                    "t Fecha UTC",
                    value=pt["start_date"],
                    min_value=date(1972, 1, 1),
                    max_value=date(2100, 12, 31),
                    key=f"date_{uid}",
                )
            with c_t:
                pt["start_time"] = st.time_input(
                    "Hora UTC",
                    value=pt["start_time"],
                    step=60,
                    key=f"time_{uid}",
                )
            pt["start_str"] = (
                f"{pt['start_date'].isoformat()} {pt['start_time'].strftime('%H:%M')} UTC"
            )

    if to_remove is not None:
        st.session_state.points.pop(to_remove)
        st.rerun()

    add_col, info_col = st.columns([0.55, 0.45])
    with add_col:
        at_limit = len(st.session_state.points) >= MAX_POINTS
        if st.button(
            "＋ Añadir punto",
            disabled=at_limit,
            use_container_width=True,
            key="add_point_btn",
        ):
            default_next = HISTORICAL_SITES[
                len(st.session_state.points) % len(HISTORICAL_SITES)
            ].id
            _add_historical_site(default_next)
            st.rerun()
    with info_col:
        st.caption(f"max {MAX_POINTS} puntos")

    with st.expander("Parámetros de ventana y DEM LOLA", expanded=False):
        params = st.session_state.analysis_params
        params["hours"] = st.number_input(
            "Duración del análisis (horas)",
            min_value=1,
            max_value=2160,
            value=int(params["hours"]),
            step=24,
        )
        step_keys = list(STEP_MINUTES.keys())
        params["step_label"] = st.selectbox(
            "Paso temporal",
            step_keys,
            index=step_keys.index(params["step_label"]),
        )
        dem_choices = ["80 m/píxel · zona amplia", "20 m/píxel · zona local"]
        params["dem_label"] = st.selectbox(
            "Recorte LOLA (polo sur)",
            dem_choices,
            index=dem_choices.index(params["dem_label"]),
        )
        p1, p2, p3 = st.columns(3)
        params["instrument"] = p1.number_input(
            "Altura (m)",
            min_value=0.0,
            max_value=1000.0,
            value=float(params["instrument"]),
            step=1.0,
        )
        params["search_km"] = p2.number_input(
            "Radio (km)",
            min_value=1.0,
            max_value=500.0,
            value=float(params["search_km"]),
            step=1.0,
        )
        az_vals = [1.0, 0.5, 0.25, 2.0]
        params["az_step"] = p3.selectbox(
            "Rayos (°)",
            az_vals,
            index=az_vals.index(params["az_step"]),
            format_func=lambda v: f"{v:g}°",
        )

    return st.button(
        "LAUNCH", type="primary", use_container_width=True, key="launch_btn"
    )


def _render_moon_panel(highlight_single: bool) -> None:
    st.markdown(
        '<div class="ilargi-section-eyebrow">VISTA 3D LUNAR · PUNTOS HISTÓRICOS Y ACTIVOS</div>',
        unsafe_allow_html=True,
    )
    fig = moon_globe_figure(
        HISTORICAL_SITES,
        st.session_state.points,
        highlight_single=highlight_single,
        height=490,
    )
    selection = st.plotly_chart(
        fig,
        width="stretch",
        key="moon_globe_3d",
        on_select="rerun",
        selection_mode=("points",),
    )

    # Si el usuario selecciona un marcador histórico en el globo 3D, añadirlo si no está ya.
    if selection and getattr(selection, "selection", None):
        pts = selection.selection.get("points", [])
        if pts:
            picked = pts[0]
            site_id = picked.get("customdata")
            if isinstance(site_id, str) and site_id in SITE_BY_ID:
                already = any(
                    p["preset_id"] == site_id for p in st.session_state.points
                )
                if not already and len(st.session_state.points) < MAX_POINTS:
                    _add_historical_site(site_id)
                    st.rerun()

    q1, q2 = st.columns([0.72, 0.28])
    with q1:
        quick_id = st.selectbox(
            "Añadir punto histórico desde catálogo",
            [s.id for s in HISTORICAL_SITES],
            format_func=lambda sid: (
                f"{SITE_BY_ID[sid].name} · {SITE_BY_ID[sid].mission} "
                f"({SITE_BY_ID[sid].latitude_deg:.2f}°, {SITE_BY_ID[sid].longitude_east_deg:.2f}°E)"
            ),
            label_visibility="collapsed",
            key="quick_hist_select",
        )
    with q2:
        if st.button(
            "＋ Añadir al INPUT",
            disabled=len(st.session_state.points) >= MAX_POINTS,
            use_container_width=True,
            key="quick_hist_add",
        ):
            _add_historical_site(quick_id)
            st.rerun()


def _format_incidence_summary(r: SiteAnalysis) -> str:
    inc = r.incidence
    if inc.min_incidence_deg is None:
        return f"Sombra permanente · Elev. Sol máx {inc.max_sun_elevation_deg:.2f}°"
    return (
        f"Mín {inc.min_incidence_deg:.2f}° · Máx {inc.max_incidence_deg:.2f}° · "
        f"Media {inc.mean_incidence_deg:.2f}° (mediana {inc.median_incidence_deg:.2f}°, σ {inc.std_incidence_deg:.2f}°)"
    )


def _format_materials_compact(r: SiteAnalysis) -> str:
    mat = r.materials
    if not mat.in_coverage:
        return "Fuera de LP-GRS (80°–90° S) · Agua/WEH: Sin datos"
    parts = []
    for sym, (val, unit, cat) in mat.elements.items():
        if val is None:
            parts.append(f"{sym}: s/d")
        else:
            parts.append(f"{sym}: {val:.2f}{unit.replace(' en masa', '')} ({cat})")
    parts.append("Agua/WEH: Sin datos validados")
    return " · ".join(parts)


def _render_single_outputs(r: SiteAnalysis) -> None:
    horizon_pill = (
        f'<span class="ilargi-pill-ok">{r.horizon_label}</span>'
        if r.horizon_mode == "lola"
        else f'<span class="ilargi-pill-muted">{r.horizon_label}</span>'
    )
    st.markdown(
        f'<div class="ilargi-card-accent">'
        f'<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">'
        f'<span class="ilargi-section-eyebrow" style="margin:0;color:#F1F5F9;">OUTPUTS · {r.label} · {r.site_name}</span>'
        f"{horizon_pill}"
        f"</div>"
        f'<div class="ilargi-mono" style="font-size:12px;color:#CBD5E1;margin-top:6px;">'
        f"λ = {r.latitude_deg:.3f}° · θ = {r.longitude_east_deg:.3f}° E · "
        + (
            f"Terreno LOLA = {r.terrain.elevation_m:.1f} m · "
            if r.terrain is not None
            else "Esfera ref. 1 737,4 km · "
        )
        + f"Inicio {r.start_utc.strftime('%Y-%m-%d %H:%M UTC')} ({r.duration_hours:g} h)"
        f"</div></div>",
        unsafe_allow_html=True,
    )

    st.plotly_chart(sky_figure(r.series, r.horizon, height=310), width="stretch")

    st.markdown(
        f'<div class="ilargi-kpi-grid">'
        f'<div class="ilargi-kpi">'
        f'<div class="ilargi-kpi-label">Visibilidad Sol</div>'
        f'<div class="ilargi-kpi-value" style="color:#F59E0B;">{r.sun_visible_pct:.1f}%</div>'
        f'<div class="ilargi-kpi-sub">{r.sun_visible_hours:.1f} / {r.duration_hours:g} h</div>'
        f"</div>"
        f'<div class="ilargi-kpi">'
        f'<div class="ilargi-kpi-label">Visibilidad Tierra</div>'
        f'<div class="ilargi-kpi-value" style="color:#38BDF8;">{r.earth_visible_pct:.1f}%</div>'
        f'<div class="ilargi-kpi-sub">{r.earth_visible_hours:.1f} / {r.duration_hours:g} h</div>'
        f"</div>"
        f'<div class="ilargi-kpi">'
        f'<div class="ilargi-kpi-label">Visibilidad Conjunta</div>'
        f'<div class="ilargi-kpi-value" style="color:#10B981;">{r.both_visible_pct:.1f}%</div>'
        f'<div class="ilargi-kpi-sub">{r.both_visible_hours:.1f} h simultáneas</div>'
        f"</div>"
        f"</div>",
        unsafe_allow_html=True,
    )

    with st.expander("Evolución temporal por días (Sol y Tierra)", expanded=True):
        st.plotly_chart(
            elevation_figure(r.series, r.horizon, height=250), width="stretch"
        )

    # Sunset y Earthset (con todos los cruces por oclusión del terreno)
    st.markdown('<div class="ilargi-card">', unsafe_allow_html=True)
    st.markdown("**Sunset y Earthset (cruces por oclusión/horizonte)**")
    st.markdown(
        f"- **Sunset ({len(r.sunsets)}):** `{format_events_summary(r.sunsets)}`"
    )
    st.markdown(
        f"- **Earthset ({len(r.earthsets)}):** `{format_events_summary(r.earthsets)}`"
    )

    # Duración de las noches (primero la noche más larga, aparte las otras noches)
    st.markdown("**Duración de las noches (sombras de luz solar)**")
    if r.longest_night is None:
        st.markdown(
            "- Sin noche / sombra solar en el periodo evaluado (100% iluminado)."
        )
    else:
        st.markdown(f"- **Noche más larga:** `{format_span(r.longest_night)}`")
        if r.other_nights:
            others = " · ".join(format_span(n) for n in r.other_nights)
            st.markdown(f"- **Otras noches ({len(r.other_nights)}):** `{others}`")
        else:
            st.markdown("- **Otras noches:** Ninguna adicional.")
    if r.earth_outages:
        outages = " · ".join(format_span(o) for o in r.earth_outages)
        st.markdown(f"- **Oclusiones de Tierra ({len(r.earth_outages)}):** `{outages}`")

    # Ángulo de incidencia solar
    st.markdown("**Ángulo de incidencia solar (respecto a la normal local)**")
    st.markdown(f"- `{_format_incidence_summary(r)}`")

    # Minerales, agua y temperatura
    st.markdown("**Minerales, agua y temperatura (`Elements & Temp`)**")
    st.markdown(f"- **Elementos y Agua:** `{_format_materials_compact(r)}`")
    st.markdown(f"- **Temperatura:** `{r.temperature_status}`")
    st.markdown("</div>", unsafe_allow_html=True)

    with st.expander("Datos de serie, CSV y muestra LOLA", expanded=False):
        st.dataframe(r.series, hide_index=True, width="stretch")
        st.download_button(
            "Descargar serie CSV",
            r.series.to_csv(index=False).encode("utf-8-sig"),
            f"ilargi-{r.label.lower()}-serie.csv",
            "text/csv",
            key="single_csv_dl",
        )
        if r.terrain is not None:
            dem_path = (
                SAMPLE_20
                if st.session_state.analysis_params["dem_label"].startswith("20")
                else SAMPLE
            )
            try:
                png = terrain_png(str(dem_path), r.terrain, relief=True, window_km=None)
                st.image(png, width="stretch")
            except ValueError as exc:
                st.caption(str(exc))


def _comparison_dataframe(results: list[SiteAnalysis]) -> pd.DataFrame:
    rows = []
    for r in results:
        inc = r.incidence
        inc_str = (
            "Sombra perm."
            if inc.min_incidence_deg is None
            else f"{inc.min_incidence_deg:.1f}° / {inc.max_incidence_deg:.1f}° (μ={inc.mean_incidence_deg:.1f}°)"
        )
        rows.append(
            {
                "Punto": r.label,
                "Emplazamiento": r.site_name,
                "Latitud (°)": round(r.latitude_deg, 3),
                "Longitud (°E)": round(r.longitude_east_deg, 3),
                "Inicio UTC": r.start_utc.strftime("%Y-%m-%d %H:%M"),
                "Horizonte": r.horizon_label,
                "Sol (%)": round(r.sun_visible_pct, 1),
                "Tierra (%)": round(r.earth_visible_pct, 1),
                "Conjunta (%)": round(r.both_visible_pct, 1),
                "Sunset(s)": format_events_summary(r.sunsets),
                "Earthset(s)": format_events_summary(r.earthsets),
                "Noche más larga (h)": (
                    round(r.longest_night.duration_hours, 2) if r.longest_night else 0.0
                ),
                "Otras noches": len(r.other_nights),
                "Incidencia solar (mín/máx/μ)": inc_str,
                "Minerales y Agua": _format_materials_compact(r),
                "Temperatura": r.temperature_status,
            }
        )
    return pd.DataFrame(rows)


def _render_comparison_section(results: list[SiteAnalysis]) -> None:
    top_l, top_r = st.columns([0.74, 0.26])
    with top_l:
        st.markdown(
            f'<div class="ilargi-section-eyebrow" style="margin-top:6px;">'
            f"COMP · TABLA COMPARATIVA ({len(results)} EMPLAZAMIENTOS) · PULSA EL BOTÓN DERECHO PARA APILAR GRÁFICOS ACIMUT vs ELEVACIÓN"
            f"</div>",
            unsafe_allow_html=True,
        )
    with top_r:
        c_dl, c_clr = st.columns(2)
        with c_dl:
            comp_df = _comparison_dataframe(results)
            st.download_button(
                "CSV comparativa",
                comp_df.to_csv(index=False).encode("utf-8-sig"),
                "ilargi-comparativa.csv",
                "text/csv",
                use_container_width=True,
                key="comp_csv_dl",
            )
        with c_clr:
            if st.session_state.compared_plot_ids and st.button(
                "Limpiar plots", use_container_width=True, key="clear_comp_plots"
            ):
                st.session_state.compared_plot_ids = []
                st.rerun()

    col_widths = [0.95, 0.95, 0.95, 1.35, 1.25, 1.15, 1.45, 0.65]
    headers = [
        "Punto / Coords",
        "Visibilidad (Sol · Tierra · Conj.)",
        "Sunset / Earthset",
        "Noches (Más larga · Otras)",
        "Incidencia solar",
        "Minerales y Agua",
        "Temp. / Horizonte",
        "Acimut–Elev.",
    ]
    with st.container(border=True):
        hdr_cols = st.columns(col_widths)
        for col, text in zip(hdr_cols, headers, strict=True):
            col.markdown(
                f'<div style="font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;">{text}</div>',
                unsafe_allow_html=True,
            )

        for r in results:
            st.markdown(
                '<div class="ilargi-row-divider"></div>', unsafe_allow_html=True
            )
            row_cols = st.columns(col_widths)

            row_cols[0].markdown(
                f"**{r.label} · {r.site_name}**  \n"
                f"`λ={r.latitude_deg:.3f}°, θ={r.longitude_east_deg:.3f}°E`  \n"
                f"`{r.start_utc.strftime('%Y-%m-%d %H:%M UTC')}`"
            )
            row_cols[1].markdown(
                f"Sol: **{r.sun_visible_pct:.1f}%** ({r.sun_visible_hours:.1f} h)  \n"
                f"Tierra: **{r.earth_visible_pct:.1f}%** ({r.earth_visible_hours:.1f} h)  \n"
                f"Ambos: **{r.both_visible_pct:.1f}%**"
            )
            row_cols[2].markdown(
                f"**Sunset ({len(r.sunsets)}):** {format_events_summary(r.sunsets)}  \n"
                f"**Earthset ({len(r.earthsets)}):** {format_events_summary(r.earthsets)}"
            )
            if r.longest_night is None:
                night_md = "Sin noches (100% iluminado)"
            else:
                others_txt = (
                    f"{len(r.other_nights)} más: "
                    + ", ".join(f"{n.duration_hours:.1f}h" for n in r.other_nights)
                    if r.other_nights
                    else "Sin otras noches"
                )
                night_md = f"**Máx:** {format_span(r.longest_night)}  \n**Otras:** {others_txt}"
            row_cols[3].markdown(night_md)
            row_cols[4].markdown(_format_incidence_summary(r))
            row_cols[5].markdown(_format_materials_compact(r))
            row_cols[6].markdown(
                f"**Horizonte:** {r.horizon_label}  \n**Temp.:** {r.temperature_status}"
            )
            is_open = r.label in st.session_state.compared_plot_ids
            btn_label = "✕ Ocultar" if is_open else "📈 Gráfico"
            if row_cols[7].button(
                btn_label,
                key=f"toggle_plot_{r.label}",
                type="primary" if is_open else "secondary",
                use_container_width=True,
            ):
                if is_open:
                    st.session_state.compared_plot_ids.remove(r.label)
                else:
                    st.session_state.compared_plot_ids.append(r.label)
                st.rerun()

    if st.session_state.compared_plot_ids:
        by_label = {r.label: r for r in results}
        st.markdown(
            '<div class="ilargi-section-eyebrow" style="margin-top:12px;">'
            "GRÁFICOS COMPARATIVOS APILADOS · ACIMUT vs ELEVACIÓN Y EVOLUCIÓN DIARIA"
            "</div>",
            unsafe_allow_html=True,
        )
        for lbl in st.session_state.compared_plot_ids:
            r = by_label.get(lbl)
            if r is None:
                continue
            with st.container(border=True):
                st.markdown(
                    f"**{r.label} · {r.site_name}** — "
                    f"`λ={r.latitude_deg:.3f}°, θ={r.longitude_east_deg:.3f}°E` · "
                    f"`{r.horizon_label}` · "
                    f"Sol `{r.sun_visible_pct:.1f}%` · Tierra `{r.earth_visible_pct:.1f}%`"
                )
                p_left, p_right = st.columns([1.25, 1.0])
                with p_left:
                    st.plotly_chart(
                        sky_figure(r.series, r.horizon, height=340),
                        width="stretch",
                        key=f"comp_sky_{r.label}",
                    )
                with p_right:
                    st.plotly_chart(
                        elevation_figure(r.series, r.horizon, height=340),
                        width="stretch",
                        key=f"comp_elev_{r.label}",
                    )


def run() -> None:
    st.set_page_config(
        page_title="ILARGI · PRO Lunar Navigator",
        page_icon="🌕",
        layout="wide",
        initial_sidebar_state="collapsed",
    )
    st.markdown(PRO_CSS, unsafe_allow_html=True)
    _init_state()

    st.markdown(
        '<div class="ilargi-topbar">'
        '<div class="ilargi-brand">'
        '<span class="ilargi-title">ILARGI</span>'
        '<span class="ilargi-badge">PRO</span>'
        '<span style="color:#94A3B8;font-size:12px;">Interactive Lunar Analyzer for Radiance, Geometry, and Intervisibility</span>'
        "</div>"
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
        '<span class="ilargi-pill-muted">MOON_ME_DE440_ME421 · LT+S</span>'
        '<span class="ilargi-pill-ok">DE440s · OK</span>'
        "</div>"
        "</div>",
        unsafe_allow_html=True,
    )

    if "launched_results" not in st.session_state:
        _execute_launch()

    results: list[SiteAnalysis] = st.session_state.get("launched_results", [])
    single_mode = len(results) == 1

    if single_mode:
        col_input, col_moon, col_outputs = st.columns([1.05, 1.35, 1.55], gap="medium")
    else:
        col_input, col_moon = st.columns([1.05, 2.55], gap="medium")
        col_outputs = None

    with col_input:
        launched = _render_input_panel()

    if launched:
        _execute_launch()
        st.rerun()

    with col_moon:
        _render_moon_panel(highlight_single=single_mode)

    for err in st.session_state.get("launch_errors", []):
        st.error(err)

    if single_mode and col_outputs is not None:
        with col_outputs:
            _render_single_outputs(results[0])
    elif len(results) > 1:
        _render_comparison_section(results)
    elif not results:
        st.info("Configura al menos un punto válido y pulsa LAUNCH.")
