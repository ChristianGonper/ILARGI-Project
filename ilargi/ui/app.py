"""Punto de entrada de Streamlit; el cálculo científico vive en ilargi.ephemeris."""

from datetime import UTC, date, datetime, time

import numpy as np
import streamlit as st
from spiceypy.utils.exceptions import SpiceyError

from ilargi.ephemeris import positions
from ilargi.ui.presentation import format_km, make_figure, position_table


def run() -> None:
    st.set_page_config(page_title="ILARGI | Efemérides", page_icon="🌕", layout="wide")
    st.title("ILARGI · Sol, Tierra y Luna")
    st.write(
        "Explora la posición geométrica de los centros de los tres cuerpos en un instante UTC."
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

    try:
        heliocentric = positions(instant, "SUN")
        geocentric = positions(instant, "EARTH")
    except (ValueError, OSError, SpiceyError) as exc:
        st.error(f"No se han podido calcular las efemérides: {exc}")
        st.info(
            "Comprueba los datos con `uv run python -m ilargi.kernels` y reinicia la aplicación."
        )
        st.stop()

    a, b, c = st.columns(3)
    a.metric("Sol – Tierra", f"{format_km(np.linalg.norm(heliocentric['EARTH']))} km")
    b.metric("Tierra – Luna", f"{format_km(np.linalg.norm(geocentric['MOON']))} km")
    c.metric("Sol – Luna", f"{format_km(np.linalg.norm(heliocentric['MOON']))} km")
    view = st.radio(
        "Vista", ["Sistema Sol–Tierra", "Detalle Tierra–Luna"], horizontal=True
    )
    data = heliocentric if view == "Sistema Sol–Tierra" else geocentric
    shown = (
        ("SUN", "EARTH", "MOON") if view == "Sistema Sol–Tierra" else ("EARTH", "MOON")
    )
    st.plotly_chart(make_figure(data, shown), width="stretch")
    st.caption(
        "Ejes J2000; distancias a escala, marcadores ampliados. En la vista solar la Luna puede quedar superpuesta a la Tierra. Gira y amplía el gráfico con el ratón."
    )
    origin = "Sol" if view == "Sistema Sol–Tierra" else "Tierra"
    st.subheader(f"Coordenadas respecto al centro de {origin}")
    frame = position_table({body: data[body] for body in shown})
    st.dataframe(frame, hide_index=True, width="stretch")
    export = frame.assign(
        instante_utc=instant.isoformat(),
        origen=origin,
        origen_naif=10 if origin == "Sol" else 399,
        marco="SPICE J2000 (ICRF para DE440)",
        correccion="NONE",
        efemeride="DE440s",
    )
    st.download_button(
        "Descargar posiciones CSV",
        export.to_csv(index=False).encode("utf-8-sig"),
        "ilargi-posiciones.csv",
        "text/csv",
    )
    st.caption(
        f"Instante: {instant.isoformat()} · DE440s · SPICE J2000 · posiciones geométricas sin correcciones de luz o aberración."
    )
    st.caption(
        "Las cifras del CSV conservan precisión numérica y no representan una incertidumbre demostrada."
    )
    st.caption(
        "Para fechas posteriores al último segundo intercalar conocido, SPICE supone que no se añaden otros; las conversiones futuras de UTC pueden cambiar."
    )
    st.info(
        "Esta primera vista representa centros de cuerpos, no sus tamaños reales ni la vista desde la superficie lunar. No calcula iluminación, relieve, eclipses o visibilidad."
    )
