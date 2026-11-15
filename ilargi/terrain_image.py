"""Reproducible static terrain PNG export using Matplotlib."""

import argparse
from io import BytesIO
from pathlib import Path

import numpy as np
import rasterio
from matplotlib import colormaps
from matplotlib.backends.backend_agg import FigureCanvasAgg
from matplotlib.colors import LightSource, Normalize
from matplotlib.figure import Figure
from rasterio.windows import Window, from_bounds
from scipy.ndimage import binary_dilation

from ilargi.terrain import SAMPLE, TerrainSample, dem_metadata, sample_elevation


def crop_window(ds, sample: TerrainSample, window_km: float) -> Window:
    """Return the pixel envelope of a projected square around the site."""
    if not np.isfinite(window_km) or window_km <= 0:
        raise ValueError("Window size must be positive")
    half = window_km * 500
    left, right = sample.x_m - half, sample.x_m + half
    bottom, top = sample.y_m - half, sample.y_m + half
    if (
        left < ds.bounds.left
        or right > ds.bounds.right
        or bottom < ds.bounds.bottom
        or top > ds.bounds.top
    ):
        raise ValueError("Requested window exceeds the available crop")
    raw = from_bounds(left, bottom, right, top, transform=ds.transform)
    col0 = max(0, int(np.floor(raw.col_off + 1e-9)))
    row0 = max(0, int(np.floor(raw.row_off + 1e-9)))
    col1 = min(ds.width, int(np.ceil(raw.col_off + raw.width - 1e-9)))
    row1 = min(ds.height, int(np.ceil(raw.row_off + raw.height - 1e-9)))
    return Window(col0, row0, col1 - col0, row1 - row0)


def render_terrain_png(
    path: Path,
    sample: TerrainSample | None = None,
    *,
    relief: bool = False,
    window_km: float | None = None,
) -> bytes:
    """Render native elevations without interpolation. Optional slope shading is illustrative and does not represent dated solar lighting or alter the DEM."""
    with rasterio.open(path) as ds:
        _, scale, offset = dem_metadata(ds)
        if sample is not None and (
            not np.isfinite(sample.x_m)
            or not np.isfinite(sample.y_m)
            or not ds.bounds.left <= sample.x_m < ds.bounds.right
            or not ds.bounds.bottom < sample.y_m <= ds.bounds.top
        ):
            raise ValueError("Site is outside the DEM")
        window = None
        if window_km is not None:
            if sample is None:
                raise ValueError("Window requires a site")
            window = crop_window(ds, sample, window_km)
        width = int(window.width) if window is not None else ds.width
        height = int(window.height) if window is not None else ds.height
        if width * height > 4_000_000:
            raise ValueError("DEM is too large for this export; use a crop")
        values = (
            ds.read(1, window=window, masked=True).astype(float).filled(np.nan) * scale
            + offset
        )
        bounds = ds.window_bounds(window) if window is not None else ds.bounds
        pixel_m = ds.transform.a
    valid = np.isfinite(values)
    if not np.any(valid):
        raise ValueError("DEM contains no valid heights")
    if relief and min(values.shape) < 2:
        raise ValueError("Shading requires at least two pixels per side")
    norm = Normalize(vmin=float(np.nanmin(values)), vmax=float(np.nanmax(values)))
    extent = [
        bounds[0] / 1000,
        bounds[2] / 1000,
        bounds[1] / 1000,
        bounds[3] / 1000,
    ]
    fig = Figure(figsize=(11, 10), dpi=200, layout="constrained")
    FigureCanvasAgg(fig)
    ax = fig.subplots()
    cmap = colormaps["cividis"].with_extremes(bad="#d54087")
    image = ax.imshow(
        values,
        origin="upper",
        extent=extent,
        interpolation="nearest",
        cmap=cmap,
        norm=norm,
    )
    if relief:
        filled = np.where(valid, values, np.nanmean(values))
        shade = LightSource(azdeg=315, altdeg=45).hillshade(
            filled, vert_exag=2, dx=pixel_m, dy=pixel_m
        )
        # Temporary gap-fill must not cast fake shadows around missing pixels.
        shade = np.ma.array(shade, mask=binary_dilation(~valid, iterations=1))
        ax.imshow(
            shade,
            origin="upper",
            extent=extent,
            interpolation="nearest",
            cmap="gray",
            vmin=0,
            vmax=1,
            alpha=0.30,
        )
    if sample is not None:
        ax.scatter(
            sample.x_m / 1000,
            sample.y_m / 1000,
            marker="x",
            s=100,
            linewidths=2,
            color="red",
            label="Site",
        )
        ax.legend(loc="upper right")
    color_label = "Height above the lunar sphere (m)"
    if relief:
        color_label += " · base colors"
    fig.colorbar(image, ax=ax, shrink=0.8, pad=0.03, label=color_label)
    ax.set(xlabel="Stereographic X (km)", ylabel="Stereographic Y (km)")
    detail = (
        "illustrative shading, 2× vertical exaggeration"
        if relief
        else "unshaded heights"
    )
    ax.set_title(
        f"LOLA · South pole elevation · {pixel_m:g} m/pixel\n"
        f"NASA LRO/LOLA PGDA · ME DE421 · {detail}\nColor scale adjusted to this view",
        fontsize=11,
        pad=12,
    )
    output = BytesIO()
    fig.savefig(output, format="png", dpi=200)
    return output.getvalue()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate a PNG of the lunar LOLA crop"
    )
    parser.add_argument(
        "--dem",
        choices=("20", "80"),
        default="20",
        help="nominal resolution in meters per pixel",
    )
    parser.add_argument("--output", type=Path, required=True, help="output PNG path")
    parser.add_argument(
        "--relief",
        action="store_true",
        help="add illustrative shading, not physical lighting",
    )
    parser.add_argument("--latitude", type=float, default=-89.5)
    parser.add_argument("--longitude", type=float, default=0.0)
    parser.add_argument(
        "--window-km",
        type=float,
        help="width of the site-centered detail in km",
    )
    args = parser.parse_args()
    path = (
        SAMPLE.with_name("lola_20m_south_pole_sample.tif")
        if args.dem == "20"
        else SAMPLE
    )
    try:
        point = sample_elevation(args.latitude, args.longitude, path)
        png = render_terrain_png(
            path, point, relief=args.relief, window_km=args.window_km
        )
    except (ValueError, OSError) as exc:
        parser.error(str(exc))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(png)
    print(f"Image saved: {args.output.resolve()}")


if __name__ == "__main__":
    main()
