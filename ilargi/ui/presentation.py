"""Presentación de posiciones: gráficos y tablas independientes de Streamlit."""

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import rasterio

from ilargi.terrain import SAMPLE, TerrainSample

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


def terrain_figure(sample: TerrainSample | None = None) -> go.Figure:
    """Muestra la zona disponible de LOLA; no representa un horizonte local."""
    with rasterio.open(SAMPLE) as dataset:
        data = dataset.read(1, out_shape=(256, 256), masked=True).filled(np.nan)
        bounds = dataset.bounds
    dx = (bounds.right - bounds.left) / data.shape[1]
    dy = (bounds.top - bounds.bottom) / data.shape[0]
    x = (bounds.left + (np.arange(data.shape[1]) + 0.5) * dx) / 1000
    y = (bounds.top - (np.arange(data.shape[0]) + 0.5) * dy) / 1000
    fig = go.Figure(
        go.Heatmap(
            x=x,
            y=y,
            z=data,
            colorscale="Cividis",
            colorbar={"title": "Altura (m)"},
            hovertemplate="X: %{x:.2f} km<br>Y: %{y:.2f} km<br>Altura: %{z:.0f} m<extra></extra>",
        )
    )
    if sample is not None:
        fig.add_trace(
            go.Scatter(
                x=[sample.x_m / 1000],
                y=[sample.y_m / 1000],
                mode="markers",
                name="Punto",
                marker={"color": "red", "size": 10, "symbol": "cross"},
            )
        )
    fig.update_layout(
        height=500,
        xaxis_title="X estereográfico (km)",
        yaxis_title="Y estereográfico (km)",
        margin={"l": 0, "r": 0, "b": 0, "t": 20},
    )
    fig.update_yaxes(scaleanchor="x", scaleratio=1)
    return fig
