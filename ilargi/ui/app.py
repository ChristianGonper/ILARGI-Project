"""Prototipo de análisis desde un único lugar de aterrizaje."""

from datetime import UTC, date, datetime, time
from pathlib import Path

import numpy as np
import plotly.graph_objects as go
import streamlit as st
from spiceypy.utils.exceptions import SpiceyError

from ilargi.discs import angular_radius, directions, disc_visibility
from ilargi.horizon import (
    calculate_horizon,
    coverage_at,
    estimate_search_radius,
    horizon_at,
)
from ilargi.materials import MATERIALS, load_regions, region_at
from ilargi.series import sky_series
from ilargi.terrain import GLOBAL, POLAR, SAMPLE, sample_elevation
from ilargi.terrain_image import render_terrain_png
from ilargi.ui.presentation import elevation_figure, materials_figure, sky_figure

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
    series["radio_angular_deg"] = [
        np.rad2deg(angular_radius(row.objetivo, row.distancia_km))
        for row in series.itertuples()
    ]
    series["fraccion_sobre_horizonte"] = np.nan
    series["fraccion_eclipsada"] = np.nan
    series["fraccion_visible_directa"] = np.nan
    for _, group in series.groupby("utc", sort=False):
        earth = group[group.objetivo == "EARTH"].iloc[0]
        for index, row in group.iterrows():
            values = disc_visibility(row.objetivo, row, horizon, earth)
            series.loc[
                index,
                [
                    "fraccion_sobre_horizonte",
                    "fraccion_eclipsada",
                    "fraccion_visible_directa",
                ],
            ] = values
    return terrain, horizon, series


@st.cache_data(show_spinner=False)
def terrain_png(path, terrain, relief, window_km):
    return render_terrain_png(Path(path), terrain, relief=relief, window_km=window_km)


def run() -> None:
    st.set_page_config(
        page_title="ILARGI | Emplazamiento lunar", page_icon="🌕", layout="wide"
    )
    st.title("ILARGI · Cielo desde el lugar de aterrizaje")
    st.write(
        "Explora las trayectorias aparentes del Sol y la Tierra desde un emplazamiento lunar y compáralas con el relieve muestreado."
    )
    st.subheader("Materiales del polo sur")
    st.caption(
        "Abundancia regional estimada entre 80° S y 90° S; no describe una parcela concreta."
    )
    try:
        regions = load_regions()
        material = st.selectbox("Material", list(MATERIALS))
        column, unit = MATERIALS[material]
        st.plotly_chart(materials_figure(regions, column, unit), width="stretch")
        with st.expander("Consultar una región por coordenadas"):
            ml, mn = st.columns(2)
            material_lat = ml.number_input(
                "Latitud regional (°)",
                min_value=-90.0,
                max_value=-80.0,
                value=-89.5,
                format="%.2f",
            )
            material_lon = mn.number_input(
                "Longitud regional este (°)",
                min_value=-180.0,
                max_value=180.0,
                value=0.0,
                format="%.2f",
            )
            region = region_at(regions, material_lat, material_lon)
            if region is None or not np.isfinite(region[column]):
                st.write("Sin datos para esta ubicación.")
            else:
                st.write(
                    f"Región {int(region.id)} · {region[column]:.2f} {unit} · abundancia {region[column + '_category'].lower()}"
                )
        st.caption("Hidrógeno equivalente en agua: sin datos disponibles.")
    except (OSError, ValueError) as exc:
        st.warning(f"No se han podido cargar los materiales: {exc}")
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
                [
                    "10 minutos",
                    "20 minutos",
                    "30 minutos",
                    "1 hora",
                    "2 horas",
                    "3 horas",
                    "6 horas",
                    "12 horas",
                    "24 horas",
                ],
                index=3,
            )
        left, middle, right = st.columns(3)
        with left:
            source = st.selectbox(
                "DEM LOLA",
                [
                    "20 m/píxel · zona local",
                    "80 m/píxel · muestra local",
                    "80 m/píxel · polo sur completo",
                    "≈237 m/píxel · global",
                ],
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
                max_value=500.0,
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
            path = {
                "80 m/píxel · polo sur completo": POLAR,
                "≈237 m/píxel · global": GLOBAL,
                "20 m/píxel · zona local": SAMPLE_20,
                "80 m/píxel · muestra local": SAMPLE,
            }[source]
            if path in (POLAR, GLOBAL):
                binary = POLAR if path == POLAR else GLOBAL.with_suffix(".img")
                expected = 189158392 if path == POLAR else 2123366400
                if not binary.exists() or binary.stat().st_size != expected:
                    raise ValueError(
                        "Falta el DEM completo. Ejecuta uv run python -m ilargi.download_terrain"
                    )
            start = datetime.combine(day, hour, tzinfo=UTC)
            minutes = {
                "1 hora": 60,
                "30 minutos": 30,
                "10 minutos": 10,
                "20 minutos": 20,
                "2 horas": 120,
                "12 horas": 720,
                "24 horas": 1440,
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
    radius_info = estimate_search_radius(
        horizon.observer_m, min_elevation_deg=horizon.elevation_deg
    )
    required_by_az = (
        np.asarray(radius_info.required_m, dtype=float)
        if horizon.required_m is None
        else horizon.required_m
    )
    physical_max_km = (
        horizon.physical_max_m
        if horizon.physical_max_m is not None
        else radius_info.spherical_horizon_m
    ) / 1000
    closed_count = int(np.count_nonzero(horizon.coverage_m >= required_by_az))
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Altura del terreno sobre la esfera", f"{terrain.elevation_m:.1f} m")
    c2.metric("Altura del instrumento sobre el terreno", f"{instrument:.1f} m")
    c3.metric("Resolución nominal del DEM", f"{horizon.pixel_m:.0f} m/píxel")
    c4.metric(
        "Radio físico máx. (relieve global)",
        f"{physical_max_km:.1f} km",
    )
    min_coverage, max_coverage = (
        np.min(horizon.coverage_m) / 1000,
        np.max(horizon.coverage_m) / 1000,
    )
    st.warning(
        f"Horizonte experimental y parcial: el terreno disponible alcanza entre {min_coverage:.1f} y {max_coverage:.1f} km según el azimut, frente a {horizon.requested_m / 1000:.1f} km solicitados. Según el horizonte hallado, el radio físico necesario para cerrar cada dirección varía entre {np.nanmin(required_by_az) / 1000:.1f} y {np.nanmax(required_by_az) / 1000:.1f} km ({closed_count}/{len(horizon.azimuth_deg)} direcciones cerradas; la cota del plano tangente a 0° sería {radius_info.tangent_plane_m / 1000:.1f} km solo para elevaciones ≥ 0°). {np.count_nonzero(~np.isfinite(horizon.elevation_deg))} direcciones carecen de perfil. Puede haber obstáculos fuera del recorte o entre muestras; no se certifica visibilidad."
    )
    st.caption(
        "La altitud LOLA de DE421 ME se aproxima en DE440 ME421 para esta demostración; ambos marcos no son idénticos. Las trayectorias muestran centros; las fracciones usan discos esféricos y horizonte muestreado."
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
    st.subheader("Discos visibles y eclipse")
    st.caption(
        "Fracción geométrica del disco sobre el horizonte y fracción solar directa tras ocultación por la Tierra. La atmósfera terrestre no se modela. El horizonte parcial puede sobrestimar la visibilidad; los valores vacíos indican falta de perfil."
    )
    st.line_chart(
        series.pivot(
            index="utc", columns="objetivo", values="fraccion_visible_directa"
        ),
        y_label="Fracción visible",
    )
    instant = st.select_slider(
        "Instante de los discos (UTC)", options=list(series.utc.unique())
    )
    selected = series[series.utc == instant]
    earth = selected[selected.objetivo == "EARTH"].iloc[0]
    cols = st.columns(2)
    for col, body in zip(cols, ("SUN", "EARTH"), strict=True):
        row = selected[selected.objetivo == body].iloc[0]
        rays = directions(
            row.azimut_deg, row.elevacion_deg, angular_radius(body, row.distancia_km)
        )
        az = np.rad2deg(np.arctan2(rays[:, 1], rays[:, 0])) % 360
        el = np.rad2deg(np.arcsin(np.clip(rays[:, 2], -1, 1)))
        x = ((az - row.azimut_deg + 180) % 360 - 180) * np.cos(
            np.deg2rad(row.elevacion_deg)
        )
        y = el - row.elevacion_deg
        height = horizon_at(horizon, az)
        state = np.where(
            np.isfinite(height),
            np.where(el > height, "Visible", "Relieve"),
            "Sin datos",
        )
        if body == "SUN":
            eaz, eel = np.deg2rad([earth.azimut_deg, earth.elevacion_deg])
            earth_center = np.array(
                [np.cos(eel) * np.cos(eaz), np.cos(eel) * np.sin(eaz), np.sin(eel)]
            )
            eclipsed = rays @ earth_center >= np.cos(
                angular_radius("EARTH", earth.distancia_km)
            )
            state = np.where(eclipsed, "Tierra", state)
        fig = go.Figure()
        for label, color in (
            ("Visible", "#f4bb43" if body == "SUN" else "#478dec"),
            ("Relieve", "#515968"),
            ("Tierra", "#2464ae"),
            ("Sin datos", "#c65353"),
        ):
            mask = state == label
            if np.any(mask):
                fig.add_scattergl(
                    x=x[mask],
                    y=y[mask],
                    mode="markers",
                    marker={"size": 3, "color": color},
                    name=label,
                )
        fig.update_layout(
            title="Sol" if body == "SUN" else "Tierra",
            xaxis_title="Desplazamiento angular (°)",
            yaxis_title="Elevación relativa (°)",
            height=360,
        )
        fig.update_yaxes(scaleanchor="x", scaleratio=1)
        col.plotly_chart(fig, width="stretch")
    st.caption(
        "Cada disco se representa ampliado por separado; los ejes están en grados y la escala es la misma dentro de cada gráfico. El relieve parcial puede ocultar obstáculos no muestreados."
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
    if Path(path) == GLOBAL:
        st.caption(
            "La vista local del DEM global aún no está disponible; el horizonte sí usa sus alturas."
        )
        return
    style = st.radio(
        "Representación del terreno", ["Altura", "Relieve sombreado"], horizontal=True
    )
    zoom = st.radio(
        "Extensión", ["Detalle de 5 km", "Recorte completo"], horizontal=True
    )
    try:
        png = terrain_png(
            path,
            terrain,
            style == "Relieve sombreado",
            5 if zoom == "Detalle de 5 km" else None,
        )
        st.image(png, width="stretch")
        st.download_button(
            "Descargar imagen PNG", png, "ilargi-topografia-lola.png", "image/png"
        )
        st.caption(
            "PNG generado sin suavizado ni remuestreo previo del DEM. La figura y la pantalla pueden redimensionar la imagen. El sombreado es ilustrativo y no representa la iluminación solar calculada."
        )
    except ValueError as exc:
        st.warning(str(exc))
