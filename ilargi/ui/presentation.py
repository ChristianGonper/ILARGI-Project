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


def sky_figure(
    series: pd.DataFrame, horizon: Horizon, center_deg: float | None = None
) -> go.Figure:
    """Trayectorias sobre el perfil topográfico parcial, vistas desde el sitio."""
    if center_deg is None:
        angles = np.deg2rad(series.azimut_deg.to_numpy() % 360)
        center_deg = float(np.rad2deg(np.angle(np.mean(np.exp(1j * angles)))) % 360)

    def centered(azimuth):
        return (np.asarray(azimuth) - center_deg + 180) % 360 - 180

    horizon_x = centered(horizon.azimuth_deg)
    order = np.argsort(horizon_x)
    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x=horizon_x[order],
            y=horizon.elevation_deg[order],
            name="Horizonte muestreado (parcial)",
            mode="lines+markers",
            marker={"size": 3},
            line={"color": "#b78247"},
            customdata=horizon.coverage_m[order] / 1000,
            hovertemplate="Azimut: %{x:.1f}°<br>Elevación: %{y:.2f}°<br>Alcance muestreado: %{customdata:.2f} km<extra></extra>",
        )
    )
    effective_target_m = (
        horizon.requested_m
        if horizon.required_m is None
        else np.minimum(horizon.requested_m, horizon.required_m)
    )
    truncated = (
        horizon.coverage_m < effective_target_m - horizon.pixel_m
    ) & np.isfinite(horizon.elevation_deg)
    fig.add_trace(
        go.Scatter(
            x=centered(horizon.azimuth_deg[truncated]),
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
            centered(track.azimut_deg), track.elevacion_deg, track.utc, strict=True
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
        xaxis_title=f"Azimut relativo al centro ({center_deg:.1f}°) (°)",
        yaxis_title="Elevación local (°)",
        xaxis_range=[-180, 180],
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
                line={
                    "color": "#e74c3c" if body == "SUN" else "#2ecc71",
                    "dash": "dot",
                },
            )
        )
    fig.add_hline(y=0, line_dash="dash", annotation_text="Plano horizontal ideal")
    fig.update_layout(
        height=420, xaxis_title="Fecha y hora UTC", yaxis_title="Elevación local (°)"
    )
    return fig


def materials_figure(regions, column, unit):
    """Dibuja los límites originales en una vista polar esquemática."""
    fig = go.Figure()
    colors = {
        "Baja": "#659bd3",
        "Media": "#e5b954",
        "Alta": "#c65d45",
        "Sin datos": "#aaaaaa",
    }
    shown = set()
    for _, row in regions.iterrows():
        angles = np.deg2rad(np.linspace(row.west, row.east, 100))
        inner = 90 + row.south
        outer = 90 + min(row.north, -80)
        radii = np.r_[np.full(len(angles), outer), np.full(len(angles), inner)]
        theta = np.r_[angles, angles[::-1]]
        category = row[column + "_category"]
        value = row[column]
        display = "Sin datos" if np.isnan(value) else f"{value:.2f} {unit} · {category}"
        fig.add_trace(
            go.Scatter(
                x=radii * np.sin(theta),
                y=radii * np.cos(theta),
                mode="lines",
                fill="toself",
                fillcolor=colors[category],
                line={"color": "white", "width": 1},
                name=category,
                legendgroup=category,
                showlegend=category not in shown,
                hovertemplate=f"Región {int(row.id)}<br>{display}<extra></extra>",
            )
        )
        shown.add(category)
    fig.update_layout(
        height=520,
        margin={"l": 0, "r": 0, "t": 10, "b": 0},
        xaxis={"visible": False},
        yaxis={"visible": False, "scaleanchor": "x", "scaleratio": 1},
        legend_title_text="Abundancia relativa",
    )
    return fig
