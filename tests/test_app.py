from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd
from streamlit.testing.v1 import AppTest

from ilargi.horizon import Horizon
from ilargi.terrain import SAMPLE
from ilargi.ui.app import MAX_POINTS, SAMPLE_20, analyse
from ilargi.ui.presentation import moon_globe_figure, sky_figure, terrain_figure


def test_terrain_plots_keep_native_grid_without_smoothing():
    for path, size in ((SAMPLE, 512), (SAMPLE_20, 1024)):
        raster = terrain_figure(path=path).data[0]
        assert raster.z.shape == (size, size)
        assert raster.zsmooth is False


def test_sky_figure_does_not_mark_physically_closed_rays_as_truncated():
    horizon = Horizon(
        azimuth_deg=np.array([0.0, 90.0, 180.0, 270.0]),
        elevation_deg=np.array([15.0, 1.0, 1.0, 15.0]),
        coverage_m=np.array([5_000.0, 5_000.0, 20_000.0, 5_000.0]),
        requested_m=20_000.0,
        pixel_m=80.0,
        ground_m=0.0,
        observer_m=2.0,
        physical_max_m=400_000.0,
        required_m=np.array([4_000.0, 15_000.0, 15_000.0, 4_000.0]),
    )
    series = pd.DataFrame(
        [
            {
                "utc": datetime(2026, 4, 2, 15, 0, tzinfo=UTC),
                "objetivo": "SUN",
                "azimut_deg": 90.0,
                "elevacion_deg": 5.0,
                "distancia_km": 150_000_000.0,
            },
            {
                "utc": datetime(2026, 4, 2, 15, 0, tzinfo=UTC),
                "objetivo": "EARTH",
                "azimut_deg": 180.0,
                "elevacion_deg": 10.0,
                "distancia_km": 384_400.0,
            },
        ]
    )
    fig = sky_figure(series, horizon, center_deg=0.0)
    truncated_trace = fig.data[1]
    assert list(truncated_trace.x) == [90.0]


def test_sky_figure_horizon_has_no_wraparound_jump():
    _, horizon, series = analyse(
        datetime(2026, 4, 2, 15, 0, tzinfo=UTC),
        24,
        60,
        -89.5,
        0.0,
        2.0,
        20.0,
        2.0,
        str(SAMPLE_20),
    )
    fig = sky_figure(series, horizon, center_deg=120.0)
    horizon_x = np.asarray(fig.data[0].x, dtype=float)
    assert np.all(np.diff(horizon_x) > 0)
    assert np.max(np.diff(horizon_x)) <= 2.0


def test_moon_globe_figure_renders_surface_and_markers():
    from ilargi.sites import HISTORICAL_SITES

    fig = moon_globe_figure(
        HISTORICAL_SITES,
        [{"lat": -89.5, "lon": 0.0, "name": "Test", "start_str": "2026-04-02"}],
        highlight_single=True,
    )
    assert fig.data[0].type == "surface"
    assert any(trace.name == "Puntos históricos" for trace in fig.data)
    assert any(trace.name == "Puntos activos" for trace in fig.data)


def test_app_single_and_multipoint_comparison_workflow():
    app = AppTest.from_file(
        Path(__file__).resolve().parent.parent / "main.py", default_timeout=45
    ).run()
    assert not app.exception
    assert not app.error
    # Modo 1 punto: globo 3D + Acimut/Elevación + Evolución temporal
    assert len(app.get("plotly_chart")) == 3
    assert len(app.session_state["launched_results"]) == 1

    # Añadir segundo punto y lanzar comparativa
    app.button(key="add_point_btn").click().run(timeout=45)
    assert len(app.session_state["points"]) == 2
    app.button(key="launch_btn").click().run(timeout=45)
    assert not app.exception
    assert not app.error
    assert len(app.session_state["launched_results"]) == 2
    # En modo comparativa sin plots abiertos solo está el globo 3D
    assert len(app.get("plotly_chart")) == 1

    # Pulsar botón de gráfico para P1 -> aparecen Acimut-Elevación y Evolución diaria
    app.button(key="toggle_plot_P1").click().run(timeout=45)
    assert app.session_state["compared_plot_ids"] == ["P1"]
    assert len(app.get("plotly_chart")) == 3

    # Pulsar botón de gráfico para P2 -> se apila debajo para comparar
    app.button(key="toggle_plot_P2").click().run(timeout=45)
    assert app.session_state["compared_plot_ids"] == ["P1", "P2"]
    assert len(app.get("plotly_chart")) == 5

    # Límite máximo de 10 puntos
    for _ in range(MAX_POINTS - 2):
        app.button(key="add_point_btn").click().run(timeout=45)
    assert len(app.session_state["points"]) == MAX_POINTS
    assert app.button(key="add_point_btn").disabled is True
