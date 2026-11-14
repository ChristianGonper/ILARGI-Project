from pathlib import Path

from streamlit.testing.v1 import AppTest


def test_app_displays_both_views():
    app = AppTest.from_file(
        Path(__file__).resolve().parent.parent / "main.py", default_timeout=30
    ).run()
    assert not app.exception
    assert not app.error
    assert len(app.get("plotly_chart")) == 2
    app.radio[0].set_value("Sol desde la Luna").run()
    assert not app.exception
    assert not app.error
    assert set(app.dataframe[0].value["Objetivo"]) == {"Tierra", "Sol"}
    assert set(app.dataframe[1].value["Objetivo"]) == {"Tierra", "Sol"}
