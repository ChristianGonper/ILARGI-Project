"""Presentación de posiciones: gráficos y tablas independientes de Streamlit."""

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import rasterio

from ilargi.horizon import Horizon, horizon_at
from ilargi.terrain import SAMPLE, TerrainSample, dem_metadata

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


def terrain_figure(sample: TerrainSample | None = None, path=SAMPLE) -> go.Figure:
    """Muestra la zona disponible de LOLA; no representa un horizonte local."""
    with rasterio.open(path) as dataset:
        _, vertical_scale, vertical_offset = dem_metadata(dataset)
        scale = min(1.0, 1024 / max(dataset.width, dataset.height))
        shape = (
            max(1, int(dataset.height * scale)),
            max(1, int(dataset.width * scale)),
        )
        data = (
            dataset.read(1, out_shape=shape, masked=True).astype(float).filled(np.nan)
        )
        data = data * vertical_scale + vertical_offset
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
            zsmooth=False,
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


def sky_figure(series: pd.DataFrame, horizon: Horizon) -> go.Figure:
    """Trayectorias sobre el perfil topográfico parcial, vistas desde el sitio."""
    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x=np.append(horizon.azimuth_deg, 360),
            y=np.append(horizon.elevation_deg, horizon.elevation_deg[0]),
            name="Horizonte muestreado (parcial)",
            mode="lines+markers",
            marker={"size": 3},
            line={"color": "#b78247"},
            customdata=np.append(horizon.coverage_m, horizon.coverage_m[0]) / 1000,
            hovertemplate="Azimut: %{x:.1f}°<br>Elevación: %{y:.2f}°<br>Alcance muestreado: %{customdata:.2f} km<extra></extra>",
        )
    )
    truncated = (
        horizon.coverage_m < horizon.requested_m - horizon.pixel_m
    ) & np.isfinite(horizon.elevation_deg)
    fig.add_trace(
        go.Scatter(
            x=horizon.azimuth_deg[truncated],
            y=horizon.elevation_deg[truncated],
            mode="markers",
            marker={"size": 4, "color": "#cf5538"},
            name="Terreno interrumpido antes de la distancia solicitada",
        )
    )
    fig.add_hline(y=0, line_dash="dot", annotation_text="Plano horizontal ideal")
    for body in ("SUN", "EARTH"):
        track = series[series.objetivo == body].copy()
        # Evitar una línea artificial que atraviese el gráfico al pasar por el norte.
        azimuth, elevation, times = [], [], []
        previous = None
        for az, el, utc in zip(
            track.azimut_deg, track.elevacion_deg, track.utc, strict=True
        ):
            if previous is not None and abs(az - previous) > 180:
                azimuth.append(None)
                elevation.append(None)
                times.append(None)
            azimuth.append(az)
            elevation.append(el)
            times.append(utc.isoformat())
            previous = az
        fig.add_trace(
            go.Scatter(
                x=azimuth,
                y=elevation,
                customdata=times,
                name=LABELS[body],
                mode="lines+markers",
                marker={"size": 4},
                line={"color": COLORS[body]},
                hovertemplate="%{customdata}<br>Azimut: %{x:.2f}°<br>Elevación: %{y:.2f}°<extra>%{fullData.name}</extra>",
            )
        )
    fig.update_layout(
        height=480,
        xaxis_title="Azimut desde el norte hacia el este (°)",
        yaxis_title="Elevación local (°)",
        xaxis_range=[0, 360],
        hovermode="closest",
    )
    return fig


def elevation_figure(series: pd.DataFrame, horizon: Horizon) -> go.Figure:
    fig = go.Figure()
    for body in ("SUN", "EARTH"):
        track = series[series.objetivo == body]
        fig.add_trace(
            go.Scatter(
                x=track.utc,
                y=track.elevacion_deg,
                name=LABELS[body],
                line={"color": COLORS[body]},
            )
        )
        fig.add_trace(
            go.Scatter(
                x=track.utc,
                y=horizon_at(horizon, track.azimut_deg),
                name=f"Terreno hacia {LABELS[body]} (parcial)",
                mode="lines+markers",
                marker={"size": 3},
                line={"color": COLORS[body], "dash": "dot"},
            )
        )
    fig.add_hline(y=0, line_dash="dash", annotation_text="Plano horizontal ideal")
    fig.update_layout(
        height=420, xaxis_title="Fecha y hora UTC", yaxis_title="Elevación local (°)"
    )
    return fig
