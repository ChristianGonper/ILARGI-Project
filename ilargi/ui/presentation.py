"""Presentación de posiciones: gráficos y tablas independientes de Streamlit."""

import numpy as np
import pandas as pd
import plotly.graph_objects as go

LABELS = {"SUN": "Sol", "EARTH": "Tierra", "MOON": "Luna"}
COLORS = {"SUN": "#f4bb43", "EARTH": "#478dec", "MOON": "#bfc7d1"}
NAIF_IDS = {"SUN": 10, "EARTH": 399, "MOON": 301}


def format_km(value: float) -> str:
    return f"{value:,.0f}".replace(",", "\u202f")


def make_figure(data: dict[str, np.ndarray], bodies: tuple[str, ...]) -> go.Figure:
    fig = go.Figure()
    for body in bodies:
        x, y, z = data[body]
        fig.add_trace(
            go.Scatter3d(
                x=[x],
                y=[y],
                z=[z],
                mode="markers+text",
                name=LABELS[body],
                text=[LABELS[body]],
                textposition="top center",
                marker={"size": 9, "color": COLORS[body]},
                hovertemplate=(
                    f"{LABELS[body]}<br>X: {format_km(x)} km"
                    f"<br>Y: {format_km(y)} km<br>Z: {format_km(z)} km<extra></extra>"
                ),
            )
        )
    fig.update_layout(
        height=620,
        margin={"l": 0, "r": 0, "b": 0, "t": 20},
        scene={
            "xaxis": {"title": "X (km)", "tickformat": ".2e"},
            "yaxis": {"title": "Y (km)", "tickformat": ".2e"},
            "zaxis": {"title": "Z (km)", "tickformat": ".2e"},
            "aspectmode": "data",
        },
    )
    return fig


def position_table(data: dict[str, np.ndarray]) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "Cuerpo": LABELS[body],
                "NAIF ID": NAIF_IDS[body],
                "X (km)": vector[0],
                "Y (km)": vector[1],
                "Z (km)": vector[2],
                "Distancia al origen (km)": np.linalg.norm(vector),
            }
            for body, vector in data.items()
        ]
    )
