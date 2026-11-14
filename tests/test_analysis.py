from datetime import UTC, datetime, timedelta

import numpy as np
import pandas as pd
import pytest
import rasterio
from rasterio.transform import from_origin

from ilargi.analysis import (
    _extract_body_events_and_spans,
    analyze_site,
    compute_incidence_stats,
    format_events_summary,
    summarize_materials,
)
from ilargi.sites import HISTORICAL_SITES
from ilargi.terrain import SAMPLE


def test_historical_sites_have_valid_coordinates_and_unique_ids():
    ids = [s.id for s in HISTORICAL_SITES]
    assert len(ids) == len(set(ids))
    assert any(s.in_lola_sample for s in HISTORICAL_SITES)
    for site in HISTORICAL_SITES:
        assert -90.0 < site.latitude_deg < 90.0
        assert -180.0 <= site.longitude_east_deg <= 180.0


def test_multiple_terrain_occluded_sunsets_and_longest_night_first():
    t0 = datetime(2026, 4, 2, 0, 0, tzinfo=UTC)
    # 7 muestras separadas 1 h: Sol visible, baja (noche corta 2h), sube, baja (noche larga 3h)
    margins = [2.0, -1.0, -1.0, 2.0, -2.0, -2.0, -2.0]
    track = pd.DataFrame(
        [
            {
                "utc": t0 + timedelta(hours=i),
                "azimut_deg": (10.0 * i) % 360.0,
                "elevacion_deg": m + 3.0,
                "horizonte_efectivo_deg": 3.0,
                "margen_efectivo_deg": m,
                "visible": m > 0.0,
            }
            for i, m in enumerate(margins)
        ]
    )
    sets, rises, spans, _ = _extract_body_events_and_spans(track, "SUN")
    assert len(sets) == 2
    assert len(rises) == 1
    assert len(spans) == 2
    sorted_nights = sorted(spans, key=lambda s: s.duration_hours, reverse=True)
    assert sorted_nights[0].duration_hours > sorted_nights[1].duration_hours
    assert not sorted_nights[0].bounded_end
    assert sorted_nights[1].bounded_start
    assert sorted_nights[1].bounded_end


def test_incidence_stats_and_permanent_shadow():
    t0 = datetime(2026, 4, 2, 0, 0, tzinfo=UTC)
    sunlit_df = pd.DataFrame(
        [
            {"utc": t0, "elevacion_deg": 10.0, "visible": True},
            {"utc": t0 + timedelta(hours=1), "elevacion_deg": 30.0, "visible": True},
            {"utc": t0 + timedelta(hours=2), "elevacion_deg": -5.0, "visible": False},
        ]
    )
    stats = compute_incidence_stats(sunlit_df)
    assert stats.min_incidence_deg == pytest.approx(60.0)
    assert stats.max_incidence_deg == pytest.approx(80.0)
    assert stats.mean_incidence_deg == pytest.approx(70.0)
    assert stats.sunlit_samples == 2

    dark_df = pd.DataFrame(
        [
            {"utc": t0, "elevacion_deg": -5.0, "visible": False},
            {"utc": t0 + timedelta(hours=1), "elevacion_deg": -2.0, "visible": False},
        ]
    )
    dark_stats = compute_incidence_stats(dark_df)
    assert dark_stats.min_incidence_deg is None
    assert dark_stats.max_sun_elevation_deg == pytest.approx(-2.0)


def test_analyze_site_lola_and_ideal_fallback():
    start = datetime(2026, 4, 2, 15, 0, tzinfo=UTC)
    south = analyze_site(
        label="P1",
        site_name="Polo Sur LOLA",
        latitude_deg=-89.5,
        longitude_east_deg=0.0,
        start_utc=start,
        duration_hours=72.0,
        step_minutes=60,
        dem_path=SAMPLE,
    )
    assert south.horizon_mode == "lola"
    assert south.terrain is not None
    assert south.search_radius_km > 100.0
    assert south.horizon.requested_m > 100_000.0
    assert south.materials.in_coverage is True
    assert "Al" in south.materials.elements
    assert "ppm H₂O equivalente" in south.materials.water_status

    apollo = analyze_site(
        label="P2",
        site_name="Apollo 11",
        latitude_deg=0.674,
        longitude_east_deg=23.473,
        start_utc=start,
        duration_hours=72.0,
        step_minutes=60,
        dem_path=SAMPLE,
    )
    assert apollo.horizon_mode == "ideal"
    assert apollo.terrain is None
    assert np.allclose(apollo.horizon.elevation_deg, 0.0)
    assert apollo.materials.in_coverage is True
    assert format_events_summary(()) == "Sin evento en el periodo evaluado"


def test_invalid_dem_does_not_silently_become_an_ideal_horizon(tmp_path):
    path = tmp_path / "invalid.tif"
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        height=2,
        width=2,
        count=1,
        dtype="float32",
        transform=from_origin(0, 16000, 80, 80),
    ) as dataset:
        dataset.write(np.zeros((2, 2), dtype="float32"), 1)

    with pytest.raises(ValueError, match="sistema de coordenadas"):
        analyze_site(
            label="P1",
            site_name="Invalid DEM",
            latitude_deg=-89.5,
            longitude_east_deg=0.0,
            start_utc=datetime(2026, 4, 2, tzinfo=UTC),
            duration_hours=1,
            dem_path=path,
        )


def test_materials_summary_outside_south_pole():
    out = summarize_materials(10.0, 20.0)
    assert out.in_coverage is True
    assert "Al" in out.elements


def test_analyze_site_computes_disc_visibility_and_eclipse():
    eclipse_start = datetime(2025, 3, 14, 6, 58, tzinfo=UTC)
    analysis = analyze_site(
        label="E1",
        site_name="Centro Lunar",
        latitude_deg=0.0,
        longitude_east_deg=0.0,
        start_utc=eclipse_start,
        duration_hours=1.0,
        step_minutes=60,
        dem_mode="ideal",
    )
    sun = analysis.series[analysis.series["objetivo"] == "SUN"].iloc[0]
    assert sun.radio_angular_deg > 0.2
    assert sun.fraccion_eclipsada == pytest.approx(1.0)
    assert sun.fraccion_visible_directa == pytest.approx(0.0)
