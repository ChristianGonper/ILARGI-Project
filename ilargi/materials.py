"""Regional abundance derived from Lunar Prospector PDS data."""

from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd

DATA = (
    Path(__file__).resolve().parent.parent
    / "data/materials/lpgrs_high1_elem_abundance_5deg.tab"
)
MATERIALS = {
    "Aluminum": ("Al", "mass %"),
    "Calcium": ("Ca", "mass %"),
    "Iron oxide (FeO)": ("FeO", "mass %"),
    "Thorium": ("Th", "ppm"),
}


def load_regions(path=DATA, *, south_pole_only: bool = False):
    """Read fixed-width LP-GRS fields and derive relative abundance terciles."""
    widths = [10, 7, 7, 7, 7] + [15] * 11
    names = [
        "id",
        "south",
        "north",
        "west",
        "east",
        "am",
        "neutron",
        "mgo",
        "al2o3",
        "sio2",
        "cao",
        "tio2",
        "feo",
        "k",
        "th",
        "u",
    ]
    data = pd.read_fwf(path, widths=widths, names=names, usecols=range(16))
    if south_pole_only:
        data = data[(data.south < -80) & (data.north > -90)].copy()
    else:
        data = data.copy()
    data["Al"] = data.al2o3 * 100 * (2 * 26.9815385) / (2 * 26.9815385 + 3 * 15.999)
    data["Ca"] = data.cao * 100 * 40.078 / (40.078 + 15.999)
    data["FeO"] = data.feo * 100
    data["Th"] = data.th
    for col, _ in MATERIALS.values():
        data.loc[~np.isfinite(data[col]) | (data[col] < 0), col] = np.nan
        valid = data[col].dropna()
        if valid.empty:
            data[col + "_category"] = "No data"
            continue
        low, high = valid.quantile([1 / 3, 2 / 3])
        data[col + "_category"] = np.select(
            [data[col].isna(), data[col] <= low, data[col] <= high],
            ["No data", "Low", "Medium"],
            default="High",
        )
    return data


def region_at(data, lat, lon):
    if not (-90 <= lat <= 90 and -180 <= lon <= 360):
        return None
    lon = (lon + 180) % 360 - 180
    rows = data[
        (data.south <= lat)
        & ((lat < data.north) | ((lat == 90) & (data.north == 90)))
        & (data.west <= lon)
        & (lon < data.east)
    ]
    return None if rows.empty else rows.iloc[0]


@lru_cache(maxsize=1)
def hydrogen_map():
    """Read the global hydrogen grid in mass ppm from Lawrence et al. (2022)."""
    path = DATA.parent / "lawrence2022_hydrogen.npz"
    with np.load(path) as source:
        return source["hydrogen"]


def weh_at(lat: float, lon: float) -> float | None:
    """Read the containing 0.5° cell and convert hydrogen to water-equivalent ppm."""
    if not (-90 <= lat <= 90 and -180 <= lon <= 360):
        return None
    lon = (lon + 180) % 360 - 180
    y = min(int((lat + 90) * 2), 359)
    x = int((lon + 180) * 2)
    return float(hydrogen_map()[y, x]) * (18.01528 / (2 * 1.00794))
