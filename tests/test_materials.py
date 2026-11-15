import pytest

from ilargi.materials import load_regions, region_at, weh_at


def test_polar_values_and_boundaries():
    data = load_regions(south_pole_only=True)
    assert len(data) == 24
    pole = region_at(data, -90, 180)
    assert pole.id == 0
    assert pole.Al == pytest.approx(15.1738, abs=0.0001)
    assert pole.Ca == pytest.approx(11.17284, abs=0.0001)
    assert pole.FeO == pytest.approx(4.9428)
    assert pole.Th == pytest.approx(0.79171)
    assert region_at(data, -87.5, 0).id == 5
    assert region_at(data, -80, 180).id == 9
    assert region_at(data, -79.9, 0) is not None  # Celda que cruza 80° S.
    assert set(data.Al_category) == {"Low", "Medium", "High"}


def test_global_lookup_and_longitude_wrapping():
    data = load_regions()
    assert region_at(data, 0.674, 23.473) is not None
    assert region_at(data, 90, 180) is not None
    assert region_at(data, 10, 340).id == region_at(data, 10, -20).id
    assert region_at(data, 91, 0) is None


def test_weh_matches_published_grid_and_wraps_longitude():
    factor = 18.01528 / (2 * 1.00794)
    assert weh_at(-89.75, -179.75) == pytest.approx(88.90607 * factor, rel=1e-6)
    assert weh_at(-89.75, 180.25) == pytest.approx(weh_at(-89.75, -179.75))
    assert weh_at(90, 0) is not None
    assert weh_at(91, 0) is None
