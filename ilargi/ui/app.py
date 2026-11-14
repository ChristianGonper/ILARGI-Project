"""Prototipo de Streamlit para la geometría lunar aparente."""

from datetime import UTC, date, datetime, time

import numpy as np
import pandas as pd
import streamlit as st
from spiceypy.utils.exceptions import SpiceyError

from ilargi.apparent import apparent_from_lunar_center, apparent_from_lunar_surface
from ilargi.terrain import sample_elevation
from ilargi.ui.presentation import format_km, make_figure, terrain_figure

LABELS = {"EARTH": "Tierra", "SUN": "Sol"}


def run() -> None:
    st.set_page_config(
        page_title="ILARGI | Observador lunar", page_icon="🌕", layout="wide"
    )
    st.title("ILARGI · La Luna como observador")
    st.write(
        "Explora dónde aparecen la Tierra y el Sol desde el centro lunar y desde un punto de su superficie."
    )
    today = datetime.now(UTC)
    col1, col2 = st.columns(2)
    with col1:
        day = st.date_input(
            "Fecha UTC",
            value=today.date(),
            min_value=date(1972, 1, 1),
            max_value=date(2100, 12, 31),
        )
    with col2:
        hour = st.time_input("Hora UTC", value=time(today.hour, today.minute), step=60)
    instant = datetime.combine(day, hour, tzinfo=UTC)
    st.caption(
        "Marco MOON_ME_DE440_ME421 · Corrección aparente LT+S · Objetivos: centros de Tierra y Sol"
    )

    try:
        center = apparent_from_lunar_center(instant)
    except (ValueError, OSError, SpiceyError) as exc:
        st.error(f"No se han podido calcular las efemérides: {exc}")
        st.info("Comprueba los datos con `uv run python -m ilargi.kernels`.")
        st.stop()
    st.header("1 · Desde el centro de la Luna")
    c1, c2 = st.columns(2)
    c1.metric(
        "Distancia aparente a la Tierra",
        f"{format_km(center.target('EARTH').range_km)} km",
    )
    c2.metric(
        "Distancia aparente al Sol", f"{format_km(center.target('SUN').range_km)} km"
    )
    view = st.radio(
        "Vista de detalle",
        ["Tierra desde la Luna", "Sol desde la Luna"],
        horizontal=True,
    )
    target = "EARTH" if view.startswith("Tierra") else "SUN"
    position = np.array(center.target(target).position_km)
    st.plotly_chart(
        make_figure({"MOON": np.zeros(3), target: position}, ("MOON", target)),
        width="stretch",
    )
    st.caption(
        "Vectores aparentes con origen en el centro lunar. Posiciones a escala; marcadores ampliados. La vista se centra en un objetivo cada vez."
    )
    center_rows = [
        {
            "Objetivo": LABELS[item.target],
            "X (km)": item.position_km[0],
            "Y (km)": item.position_km[1],
            "Z (km)": item.position_km[2],
            "Distancia (km)": item.range_km,
            "Tiempo de luz (s)": item.light_time_s,
        }
        for item in center.targets
    ]
    st.dataframe(pd.DataFrame(center_rows), hide_index=True, width="stretch")

    st.header("2 · Desde un punto en la superficie")
    st.write(
        "La altura se mide sobre una esfera de referencia de 1.737,4 km de radio; no es automáticamente la altura del terreno."
    )
    left, middle, right = st.columns(3)
    with left:
        lat = st.number_input(
            "Latitud planetocéntrica (°)",
            min_value=-89.999,
            max_value=89.999,
            value=-89.5,
            step=0.1,
            format="%.3f",
        )
    with middle:
        lon = st.number_input(
            "Longitud este (°)",
            min_value=-180.0,
            max_value=180.0,
            value=0.0,
            step=1.0,
            format="%.3f",
        )
    with right:
        height_m = st.number_input(
            "Altura sobre la esfera (m)",
            min_value=-10000.0,
            max_value=100000.0,
            value=0.0,
            step=10.0,
        )
    try:
        surface = apparent_from_lunar_surface(instant, lat, lon, height_m / 1000)
        surface_rows = [
            {
                "Objetivo": LABELS[item.target],
                "Azimut (°)": item.azimuth_deg,
                "Elevación (°)": item.elevation_deg,
                "Distancia (km)": item.range_km,
                "Tiempo de luz (s)": item.light_time_s,
            }
            for item in surface.targets
        ]
        st.dataframe(pd.DataFrame(surface_rows), hide_index=True, width="stretch")
        st.caption(
            "Azimut desde el norte hacia el este; elevación sobre el plano horizontal local. Se calcula la dirección del centro de cada cuerpo, sin horizonte topográfico."
        )
        export = pd.DataFrame(surface_rows).assign(
            instante_utc=instant.isoformat(),
            latitud_deg=lat,
            longitud_este_deg=lon,
            altura_sobre_esfera_m=height_m,
            marco="MOON_ME_DE440_ME421",
            correccion="LT+S",
            observador="superficie esfera ideal",
            modelo="DE440s",
        )
        st.download_button(
            "Descargar observación CSV",
            export.to_csv(index=False).encode("utf-8-sig"),
            "ilargi-observacion-lunar.csv",
            "text/csv",
        )
    except (ValueError, OSError, SpiceyError) as exc:
        st.error(f"No se ha podido calcular el observador de superficie: {exc}")

    st.header("3 · Una muestra de terreno LOLA")
    st.write(
        "Un recorte real de 80 m/píxel alrededor de 89,5° S, 0° E permite consultar la altura en el píxel que contiene el punto."
    )
    try:
        sample = sample_elevation(lat, lon)
        st.metric(
            "Altura LOLA del píxel",
            f"{sample.elevation_m:,.1f} m".replace(",", "\u202f"),
        )
        st.caption(
            "Esta altura no se aplica automáticamente al observador: puedes copiarla en el campo de altura si deseas explorar esa aproximación."
        )
    except ValueError:
        sample = None
        st.warning(
            "El punto está fuera del recorte disponible o no tiene datos. El cálculo de superficie sigue usando la esfera ideal."
        )
    st.plotly_chart(terrain_figure(sample), width="stretch")
    st.caption(
        "La imagen reduce la resolución para visualizarla. LOLA usa ME de DE421; el marco SPICE usado está muy próximo, pero no es idéntico."
    )
    st.info(
        "El recorte no permite calcular el horizonte completo. La elevación mostrada no implica visibilidad real, potencia solar ni comunicaciones. No se consideran relieve obstructor ni tamaño de los discos."
    )
    st.caption(
        "UTC futuro se interpreta con el último segundo intercalar disponible. El marco lunar, los datos y las limitaciones se describen en la documentación del proyecto."
    )
