"""Abundancias regionales derivadas de la tabla PDS de Lunar Prospector."""

from pathlib import Path

import numpy as np
import pandas as pd

DATA = (
    Path(__file__).resolve().parent.parent
    / "data/materials/lpgrs_high1_elem_abundance_5deg.tab"
)
MATERIALS = {
    "Aluminio": ("Al", "% en masa"),
    "Calcio": ("Ca", "% en masa"),
    "Óxido de hierro (FeO)": ("FeO", "% en masa"),
    "Torio": ("Th", "ppm"),
}


def load_regions(path=DATA, *, south_pole_only: bool = True):
    """Lee los campos de ancho fijo de LP-GRS y calcula categorías por terciles."""
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
            data[col + "_category"] = "Sin datos"
            continue
        low, high = valid.quantile([1 / 3, 2 / 3])
        data[col + "_category"] = np.select(
            [data[col].isna(), data[col] <= low, data[col] <= high],
            ["Sin datos", "Baja", "Media"],
            default="Alta",
        )
    return data


def region_at(data, lat, lon):
    if not (-90 <= lat <= -80 and -180 <= lon <= 180):
        return None
    lon = (lon + 180) % 360 - 180
    rows = data[
        (data.south <= lat)
        & ((lat < data.north) | ((lat == -80) & (data.north >= -80)))
        & (data.west <= lon)
        & (lon < data.east)
    ]
    return None if rows.empty else rows.iloc[0]
