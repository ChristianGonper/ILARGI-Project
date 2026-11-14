"""Presentación de posiciones: gráficos y tablas independientes de Streamlit."""

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import rasterio

from ilargi.horizon import Horizon, horizon_at
from ilargi.terrain import SAMPLE, TerrainSample, dem_metadata

LABELS = {"SUN": "Sol", "EARTH": "Tierra", "MOON": "Luna"}
COLORS = {"SUN": "#F59E0B", "EARTH": "#38BDF8", "MOON": "#CBD5E1"}
NAIF_IDS = {"SUN": 10, "EARTH": 399, "MOON": 301}

DARK_BG = "#0B101B"
DARK_PANEL = "#131B2E"
DARK_GRID = "#26334D"
DARK_TEXT = "#CBD5E1"
DARK_MUTED = "#94A3B8"


def _apply_dark_layout(fig: go.Figure, *, height: int) -> go.Figure:
    fig.update_layout(
        height=height,
        paper_bgcolor=DARK_PANEL,
        plot_bgcolor=DARK_BG,
        font={"color": DARK_TEXT, "family": "Inter, system-ui, sans-serif", "size": 12},
        legend={
            "orientation": "h",
            "yanchor": "bottom",
            "y": 1.02,
            "xanchor": "left",
            "x": 0.0,
            "bgcolor": "rgba(19, 27, 46, 0.75)",
            "font": {"size": 11, "color": DARK_TEXT},
        },
        margin={"l": 48, "r": 16, "b": 44, "t": 44},
    )
    fig.update_xaxes(
        gridcolor=DARK_GRID,
        zerolinecolor=DARK_GRID,
        tickfont={"color": DARK_MUTED},
        title_font={"color": DARK_TEXT},
    )
    fig.update_yaxes(
        gridcolor=DARK_GRID,
        zerolinecolor=DARK_GRID,
        tickfont={"color": DARK_MUTED},
        title_font={"color": DARK_TEXT},
    )
    return fig


def format_km(value: float) -> str:
    return f"{value:,.0f}".replace(",", "\u202f")


def _sphere_xyz(
    lat_deg: np.ndarray | float, lon_deg: np.ndarray | float, radius: float = 1.0
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    lat = np.deg2rad(lat_deg)
    lon = np.deg2rad(lon_deg)
    cos_lat = np.cos(lat)
    return (
        radius * cos_lat * np.cos(lon),
        radius * cos_lat * np.sin(lon),
        radius * np.sin(lat),
    )


def moon_globe_figure(
    historical_sites: tuple | list,
    selected_points: list[dict],
    *,
    highlight_single: bool = False,
    height: int = 500,
) -> go.Figure:
    """Globo lunar 3D interactivo con sitios históricos predefinidos y puntos activos."""
    lats = np.linspace(-90.0, 90.0, 54)
    lons = np.linspace(-180.0, 180.0, 108)
    lon_grid, lat_grid = np.meshgrid(lons, lats)
    x_s, y_s, z_s = _sphere_xyz(lat_grid, lon_grid, radius=1.0)

    # Sombreado procedural discreto para distinguir mares visibles, tierras altas y polo sur.
    lat_r = np.deg2rad(lat_grid)
    lon_r = np.deg2rad(lon_grid)
    albedo = (
        0.55
        + 0.16 * np.sin(2.0 * lon_r + 0.4) * np.cos(lat_r) ** 2
        - 0.18
        * np.exp(-(((lat_grid - 12.0) / 28.0) ** 2 + ((lon_grid + 18.0) / 38.0) ** 2))
        - 0.14
        * np.exp(-(((lat_grid - 8.0) / 20.0) ** 2 + ((lon_grid - 28.0) / 24.0) ** 2))
        - 0.12
        * np.exp(
            -(
                ((lat_grid + 54.0) / 24.0) ** 2
                + ((np.abs(lon_grid) - 165.0) / 35.0) ** 2
            )
        )
        + 0.05 * np.cos(6.0 * lat_r) * np.sin(5.0 * lon_r)
    )

    fig = go.Figure()
    fig.add_trace(
        go.Surface(
            x=x_s,
            y=y_s,
            z=z_s,
            surfacecolor=albedo,
            colorscale=[
                [0.0, "#182235"],
                [0.45, "#334155"],
                [0.75, "#64748B"],
                [1.0, "#94A3B8"],
            ],
            showscale=False,
            hoverinfo="skip",
            lighting={"ambient": 0.72, "diffuse": 0.65, "specular": 0.12},
            lightposition={"x": 2.5, "y": 1.2, "z": -0.8},
            name="Superficie lunar",
        )
    )

    # Retícula ecuatorial, meridiano 0° y límite polar sur 80° S (LOLA / LP-GRS).
    ring_lons = np.linspace(-180.0, 180.0, 121)
    for lat_ring, color, width, label in (
        (0.0, "#334155", 1.5, "Ecuador lunar (0°)"),
        (-80.0, "#38BDF8", 2.0, "Límite 80° S (LP-GRS)"),
    ):
        rx, ry, rz = _sphere_xyz(
            np.full_like(ring_lons, lat_ring), ring_lons, radius=1.004
        )
        fig.add_trace(
            go.Scatter3d(
                x=rx,
                y=ry,
                z=rz,
                mode="lines",
                line={"color": color, "width": width},
                name=label,
                hoverinfo="skip",
                showlegend=False,
            )
        )
    mer_lats = np.linspace(-90.0, 90.0, 73)
    mx, my, mz = _sphere_xyz(mer_lats, np.zeros_like(mer_lats), radius=1.004)
    fig.add_trace(
        go.Scatter3d(
            x=mx,
            y=my,
            z=mz,
            mode="lines",
            line={"color": "#334155", "width": 1.5},
            hoverinfo="skip",
            showlegend=False,
        )
    )

    if historical_sites:
        hx, hy, hz = _sphere_xyz(
            np.array([s.latitude_deg for s in historical_sites]),
            np.array([s.longitude_east_deg for s in historical_sites]),
            radius=1.018,
        )
        fig.add_trace(
            go.Scatter3d(
                x=hx,
                y=hy,
                z=hz,
                mode="markers",
                name="Puntos históricos",
                customdata=[s.id for s in historical_sites],
                text=[
                    f"{s.name}<br>{s.mission}<br>"
                    f"λ={s.latitude_deg:.3f}°, θ={s.longitude_east_deg:.3f}°E<br>{s.region}"
                    for s in historical_sites
                ],
                hovertemplate="%{text}<extra>Histórico</extra>",
                marker={
                    "size": 5.5,
                    "color": "#CBD5E1",
                    "line": {"color": "#38BDF8", "width": 1.5},
                },
            )
        )

    if selected_points:
        px, py, pz = _sphere_xyz(
            np.array([p["lat"] for p in selected_points]),
            np.array([p["lon"] for p in selected_points]),
            radius=1.032,
        )
        marker_color = (
            "#F43F5E" if highlight_single and len(selected_points) == 1 else "#F59E0B"
        )
        fig.add_trace(
            go.Scatter3d(
                x=px,
                y=py,
                z=pz,
                mode="markers+text",
                name="Puntos activos",
                text=[f"P{i + 1}" for i in range(len(selected_points))],
                textposition="top center",
                textfont={"color": "#F1F5F9", "size": 11},
                customdata=[
                    f"P{i + 1} · {p['name']}<br>"
                    f"λ={p['lat']:.3f}°, θ={p['lon']:.3f}°E<br>"
                    f"t={p['start_str']}"
                    for i, p in enumerate(selected_points)
                ],
                hovertemplate="%{customdata}<extra>Activo</extra>",
                marker={
                    "size": 8.5
                    if highlight_single and len(selected_points) == 1
                    else 7.5,
                    "color": marker_color,
                    "symbol": "diamond",
                    "line": {"color": "#F1F5F9", "width": 1.5},
                },
            )
        )

    axis_style = {
        "visible": False,
        "showgrid": False,
        "zeroline": False,
        "showticklabels": False,
    }
    fig.update_layout(
        height=height,
        paper_bgcolor=DARK_BG,
        plot_bgcolor=DARK_BG,
        margin={"l": 0, "r": 0, "b": 0, "t": 0},
        showlegend=True,
        legend={
            "orientation": "h",
            "yanchor": "top",
            "y": 0.99,
            "xanchor": "left",
            "x": 0.01,
            "bgcolor": "rgba(19, 27, 46, 0.78)",
            "font": {"color": DARK_TEXT, "size": 11},
        },
        clickmode="event+select",
        scene={
            "bgcolor": DARK_BG,
            "xaxis": axis_style,
            "yaxis": axis_style,
            "zaxis": axis_style,
            "aspectmode": "data",
            "camera": {"eye": {"x": 1.35, "y": 0.72, "z": -1.10}},
        },
    )
    return fig


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
    series: pd.DataFrame,
    horizon: Horizon,
    center_deg: float | None = None,
    *,
    height: int = 380,
) -> go.Figure:
    """Trayectorias sobre el perfil topográfico o ideal, vistas desde el sitio."""
    if center_deg is None:
        angles = np.deg2rad(series.azimut_deg.to_numpy() % 360)
        center_deg = float(np.rad2deg(np.angle(np.mean(np.exp(1j * angles)))) % 360)

    def centered(azimuth):
        return (np.asarray(azimuth) - center_deg + 180) % 360 - 180

    horizon_x = centered(horizon.azimuth_deg)
    order = np.argsort(horizon_x)
    is_ideal = horizon.requested_m == 0
    horizon_name = (
        "Horizonte esférico ideal (0°)" if is_ideal else "Horizonte LOLA (parcial)"
    )

    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x=horizon_x[order],
            y=horizon.elevation_deg[order],
            name=horizon_name,
            mode="lines+markers",
            marker={"size": 2.5},
            line={"color": "#94A3B8" if is_ideal else "#F97316", "width": 2},
            fill="tozeroy" if not is_ideal else None,
            fillcolor="rgba(249, 115, 22, 0.12)" if not is_ideal else None,
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
            marker={"size": 4, "color": "#F43F5E"},
            name="Terreno interrumpido",
        )
    )
    fig.add_hline(
        y=0,
        line_dash="dot",
        line_color="#475569",
        annotation_text="0° ideal",
        annotation_font_color=DARK_MUTED,
    )
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
                marker={"size": 3.5},
                line={"color": COLORS[body], "width": 2},
                hovertemplate="%{customdata}<br>Azimut rel.: %{x:.2f}°<br>Elevación: %{y:.2f}°<extra>%{fullData.name}</extra>",
            )
        )
    fig.update_layout(
        xaxis_title=f"Azimut relativo al centro ({center_deg:.1f}°) (°)",
        yaxis_title="Elevación local (°)",
        xaxis_range=[-180, 180],
        hovermode="closest",
    )
    return _apply_dark_layout(fig, height=height)


def elevation_figure(
    series: pd.DataFrame, horizon: Horizon, *, height: int = 320
) -> go.Figure:
    """Evolución temporal de la elevación del Sol, la Tierra y el horizonte hacia cada cuerpo."""
    fig = go.Figure()
    is_ideal = horizon.requested_m == 0
    for body in ("SUN", "EARTH"):
        track = series[series.objetivo == body]
        fig.add_trace(
            go.Scatter(
                x=track.utc,
                y=track.elevacion_deg,
                name=LABELS[body],
                line={"color": COLORS[body], "width": 2},
            )
        )
        if not is_ideal:
            fig.add_trace(
                go.Scatter(
                    x=track.utc,
                    y=horizon_at(horizon, track.azimut_deg),
                    name=f"Horizonte → {LABELS[body]}",
                    mode="lines",
                    line={
                        "color": "#FB7185" if body == "SUN" else "#10B981",
                        "dash": "dot",
                        "width": 1.5,
                    },
                )
            )
    fig.add_hline(
        y=0,
        line_dash="dash",
        line_color="#475569",
        annotation_text="0° ideal",
        annotation_font_color=DARK_MUTED,
    )
    fig.update_layout(
        xaxis_title="Evolución temporal (UTC)",
        yaxis_title="Elevación local (°)",
        hovermode="x unified",
    )
    return _apply_dark_layout(fig, height=height)


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
