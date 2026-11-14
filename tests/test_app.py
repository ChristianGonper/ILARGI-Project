from pathlib import Path

from streamlit.testing.v1 import AppTest

from ilargi.terrain import SAMPLE
from ilargi.ui.app import SAMPLE_20
from ilargi.ui.presentation import terrain_figure


def test_terrain_plots_keep_native_grid_without_smoothing():
    for path, size in ((SAMPLE, 512), (SAMPLE_20, 1024)):
        raster = terrain_figure(path=path).data[0]
        assert raster.z.shape == (size, size)
        assert raster.zsmooth is False


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
    assert "parcial" in app.warning[0].value
    assert set(app.dataframe[0].value["objetivo"]) == {"SUN", "EARTH"}
    app.radio[0].set_value("Relieve sombreado")
    app.radio[1].set_value("Detalle de 5 km")
    app.run(timeout=30)
    assert not app.exception
    assert len(app.get("image")) == 1
