import pytest

from ilargi.materials import load_regions, region_at


def test_polar_values_and_boundaries():
    data = load_regions()
    assert len(data) == 24
    pole = region_at(data, -90, 180)
    assert pole.id == 0
    assert pole.Al == pytest.approx(15.1738, abs=0.0001)
    assert pole.Ca == pytest.approx(11.17284, abs=0.0001)
    assert pole.FeO == pytest.approx(4.9428)
    assert pole.Th == pytest.approx(0.79171)
    assert region_at(data, -87.5, 0).id == 5
    assert region_at(data, -80, 180).id == 9
    assert region_at(data, -79.9, 0) is None
    assert set(data.Al_category) == {"Baja", "Media", "Alta"}
