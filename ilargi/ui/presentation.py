"""Presentación de posiciones: gráficos y tablas independientes de Streamlit."""

import numpy as np
import pandas as pd
import plotly.graph_objects as go

LABELS = {"SUN": "Sol", "EARTH": "Tierra", "MOON": "Luna"}
COLORS = {"SUN": "#f4bb43", "EARTH": "#478dec", "MOON": "#bfc7d1"}


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
                hovertemplate=LABELS[body]
                + "<br>X: %{x:,.0f} km<br>Y: %{y:,.0f} km<br>Z: %{z:,.0f} km<extra></extra>",
            )
        )
    fig.update_layout(
        height=620,
        margin={"l": 0, "r": 0, "b": 0, "t": 20},
        scene={
            "xaxis_title": "X (km)",
            "yaxis_title": "Y (km)",
            "zaxis_title": "Z (km)",
            "aspectmode": "data",
        },
    )
    return fig


def position_table(data: dict[str, np.ndarray]) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "Cuerpo": LABELS[body],
                "X (km)": vector[0],
                "Y (km)": vector[1],
                "Z (km)": vector[2],
                "Distancia al origen (km)": np.linalg.norm(vector),
            }
            for body, vector in data.items()
        ]
    )
