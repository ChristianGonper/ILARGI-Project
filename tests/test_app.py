from pathlib import Path

from streamlit.testing.v1 import AppTest


def test_app_calculates_landing_site_scenario():
    app = AppTest.from_file(
        Path(__file__).resolve().parent.parent / "main.py", default_timeout=30
    ).run()
    assert not app.exception
    app.button[0].click().run(timeout=30)
    assert not app.exception
    assert not app.error
    assert len(app.get("plotly_chart")) == 3
    assert "parcial" in app.warning[0].value
    assert set(app.dataframe[0].value["objetivo"]) == {"SUN", "EARTH"}
