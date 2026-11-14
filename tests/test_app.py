from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd
from streamlit.testing.v1 import AppTest

from ilargi.horizon import Horizon
from ilargi.terrain import SAMPLE
from ilargi.ui.app import SAMPLE_20
from ilargi.ui.presentation import sky_figure, terrain_figure


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
    fig = sky_figure(series, horizon)
    truncated_trace = fig.data[1]
    assert list(truncated_trace.x) == [90.0]


def test_app_calculates_landing_site_scenario():
    app = AppTest.from_file(
        Path(__file__).resolve().parent.parent / "main.py", default_timeout=30
    ).run()
    assert not app.exception
    app.button[0].click().run(timeout=30)
    assert not app.exception
    assert not app.error
    assert len(app.get("plotly_chart")) == 2
    assert len(app.get("image")) == 1
    assert len(app.metric) == 4
    assert "Radio físico máx." in app.metric[3].label
    assert "parcial" in app.warning[0].value
    assert "direcciones cerradas" in app.warning[0].value
    assert "cota del plano tangente" in app.warning[0].value
    assert set(app.dataframe[0].value["objetivo"]) == {"SUN", "EARTH"}
    app.radio[0].set_value("Relieve sombreado")
    app.radio[1].set_value("Detalle de 5 km")
    app.run(timeout=30)
    assert not app.exception
    assert len(app.get("image")) == 1
