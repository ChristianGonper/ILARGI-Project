"""Prototipo de análisis desde un único lugar de aterrizaje."""

from datetime import UTC, date, datetime, time
from pathlib import Path

import numpy as np
import streamlit as st
from spiceypy.utils.exceptions import SpiceyError

from ilargi.horizon import calculate_horizon, coverage_at, horizon_at
from ilargi.series import sky_series
from ilargi.terrain import SAMPLE, sample_elevation
from ilargi.terrain_image import render_terrain_png
from ilargi.ui.presentation import elevation_figure, sky_figure

SAMPLE_20 = SAMPLE.with_name("lola_20m_south_pole_sample.tif")


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


def run() -> None:
    st.set_page_config(
        page_title="ILARGI | Emplazamiento lunar", page_icon="🌕", layout="wide"
    )
    st.title("ILARGI · Cielo desde el lugar de aterrizaje")
    st.write(
        "Explora las trayectorias aparentes del Sol y la Tierra desde un emplazamiento lunar y compáralas con el relieve muestreado."
    )
    with st.form("scenario"):
        st.subheader("Escenario")
        a, b, c = st.columns(3)
        with a:
            day = st.date_input(
                "Fecha inicial UTC",
                value=date(2026, 4, 2),
                min_value=date(1972, 1, 1),
                max_value=date(2100, 12, 31),
            )
            lat = st.number_input(
                "Latitud planetocéntrica (°)",
                min_value=-89.999,
                max_value=89.999,
                value=-89.5,
                format="%.3f",
            )
        with b:
            hour = st.time_input("Hora inicial UTC", value=time(15), step=60)
            lon = st.number_input(
                "Longitud este (°)",
                min_value=-180.0,
                max_value=180.0,
                value=0.0,
                format="%.3f",
            )
        with c:
            hours = st.number_input(
                "Duración (horas)", min_value=1, max_value=2160, value=168, step=24
            )
            step = st.selectbox(
                "Paso temporal",
                ["1 hora", "30 minutos", "15 minutos", "3 horas", "6 horas"],
                index=0,
            )
        left, middle, right = st.columns(3)
        with left:
            source = st.selectbox(
                "Recorte LOLA",
                ["20 m/píxel · zona local", "80 m/píxel · zona más amplia"],
            )
        with middle:
            instrument = st.number_input(
                "Altura del instrumento sobre el terreno (m)",
                min_value=0.0,
                max_value=1000.0,
                value=2.0,
                step=1.0,
            )
        with right:
            search = st.number_input(
                "Distancia de búsqueda del horizonte (km)",
                min_value=1.0,
                max_value=100.0,
                value=20.0,
                step=1.0,
            )
        az_step = st.selectbox(
            "Separación angular de los rayos",
            [0.5, 0.25, 0.1, 1.0, 2.0],
            format_func=lambda value: f"{value:g}°",
        )
        submitted = st.form_submit_button("Calcular escenario", type="primary")
    if not submitted and "scenario_result" not in st.session_state:
        st.info("Configura el emplazamiento y pulsa «Calcular escenario».")
        return
    if submitted:
        try:
            path = SAMPLE_20 if source.startswith("20") else SAMPLE
            start = datetime.combine(day, hour, tzinfo=UTC)
            minutes = {
                "1 hora": 60,
                "30 minutos": 30,
                "15 minutos": 15,
                "3 horas": 180,
                "6 horas": 360,
            }[step]
            terrain, horizon, series = analyse(
                start, hours, minutes, lat, lon, instrument, search, az_step, str(path)
            )
            st.session_state.scenario_result = (
                terrain,
                horizon,
                series,
                str(path),
                lat,
                lon,
                instrument,
                start,
                minutes,
            )
        except (ValueError, OSError, SpiceyError) as exc:
            st.error(f"No se ha podido calcular el escenario: {exc}")
            return
    terrain, horizon, series, path, lat, lon, instrument, start, minutes = (
        st.session_state.scenario_result
    )
    st.caption(
        f"Lugar: {lat:.3f}° latitud, {lon:.3f}° longitud este · inicio {start.isoformat()} · SPICE MOON_ME_DE440_ME421 · LT+S"
    )
    c1, c2, c3 = st.columns(3)
    c1.metric("Altura del terreno sobre la esfera", f"{terrain.elevation_m:.1f} m")
    c2.metric("Altura del instrumento sobre el terreno", f"{instrument:.1f} m")
    c3.metric("Resolución nominal del DEM", f"{horizon.pixel_m:.0f} m/píxel")
    min_coverage, max_coverage = (
        np.min(horizon.coverage_m) / 1000,
        np.max(horizon.coverage_m) / 1000,
    )
    st.warning(
        f"Horizonte experimental y parcial: el terreno disponible alcanza entre {min_coverage:.1f} y {max_coverage:.1f} km según el azimut, frente a {horizon.requested_m / 1000:.1f} km solicitados. {np.count_nonzero(~np.isfinite(horizon.elevation_deg))} direcciones carecen de perfil. Puede haber obstáculos fuera del recorte o entre muestras; no se certifica visibilidad."
    )
    st.caption(
        "La altitud LOLA de DE421 ME se aproxima en DE440 ME421 para esta demostración; ambos marcos no son idénticos. Las trayectorias representan los centros de los cuerpos, sin discos ni eclipses."
    )
    lateral_m = horizon.requested_m * np.deg2rad(360 / len(horizon.azimuth_deg))
    st.caption(
        f"A la distancia solicitada, los rayos están separados unos {lateral_m:.0f} m: entre ellos pueden faltar obstáculos. Reduce el paso angular y compara los perfiles para estudiar la sensibilidad."
    )
    st.subheader("Trayectorias sobre el horizonte del lugar")
    st.plotly_chart(sky_figure(series, horizon), width="stretch")
    st.subheader("Elevación a lo largo del tiempo")
    st.plotly_chart(elevation_figure(series, horizon), width="stretch")
    st.caption(
        "Las líneas punteadas muestran el perfil muestreado hacia cada cuerpo; la línea horizontal es el plano ideal. El horizonte depende de la dirección y es incompleto."
    )
    with st.expander("Datos del escenario"):
        st.dataframe(series, hide_index=True, width="stretch")
        export = series.assign(
            latitud_deg=lat,
            longitud_este_deg=lon,
            instrumento_sobre_terreno_m=instrument,
            terreno_m=terrain.elevation_m,
            resolucion_nominal_dem_m=horizon.pixel_m,
            paso_azimut_deg=360 / len(horizon.azimuth_deg),
            marco="MOON_ME_DE440_ME421",
            correccion="LT+S",
            dem=Path(path).name,
            paso_temporal_min=minutes,
            distancia_buscada_m=horizon.requested_m,
            horizonte="parcial; no certifica visibilidad",
        )
        st.download_button(
            "Descargar serie CSV",
            export.to_csv(index=False).encode("utf-8-sig"),
            "ilargi-serie-lunar.csv",
            "text/csv",
        )
    st.subheader("Muestra de topografía LOLA")
    style = st.radio(
        "Representación del terreno", ["Altura", "Relieve sombreado"], horizontal=True
    )
    zoom = st.radio(
        "Extensión", ["Recorte completo", "Detalle de 5 km"], horizontal=True
    )
    try:
        png = render_terrain_png(
            Path(path),
            terrain,
            relief=style == "Relieve sombreado",
            window_km=5 if zoom == "Detalle de 5 km" else None,
        )
        st.image(png, width="stretch")
        st.download_button(
            "Descargar imagen PNG", png, "ilargi-topografia-lola.png", "image/png"
        )
    except ValueError as exc:
        st.warning(str(exc))
    st.caption(
        "PNG generado con Matplotlib sin interpolar los píxeles del DEM. En pantalla puede reducirse para ajustarse; descarga la imagen para verla ampliada. El sombreado es ilustrativo y no representa la iluminación solar calculada."
    )
