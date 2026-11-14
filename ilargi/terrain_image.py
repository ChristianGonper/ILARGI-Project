"""Exportación reproducible del LDEM a PNG con Matplotlib."""

import argparse
from io import BytesIO
from pathlib import Path

import numpy as np
import rasterio
from matplotlib.backends.backend_agg import FigureCanvasAgg
from matplotlib.colors import LightSource, Normalize
from matplotlib.figure import Figure
from rasterio.windows import Window

from ilargi.terrain import SAMPLE, TerrainSample, dem_metadata, sample_elevation


def render_terrain_png(
    path: Path,
    sample: TerrainSample | None = None,
    *,
    relief: bool = False,
    window_km: float | None = None,
) -> bytes:
    """Representa el GeoTIFF o una ventana sin interpolar el raster de alturas.

    El relieve opcional es una ayuda gráfica calculada a partir de pendientes;
    no representa la iluminación del Sol en un instante ni altera el DEM.
    """
    with rasterio.open(path) as ds:
        _, scale, offset = dem_metadata(ds)
        window = None
        if window_km is not None:
            if sample is None or not np.isfinite(window_km) or window_km <= 0:
                raise ValueError(
                    "La ventana necesita un emplazamiento y un tamaño positivo"
                )
            half = window_km * 500
            left, right = sample.x_m - half, sample.x_m + half
            bottom, top = sample.y_m - half, sample.y_m + half
            if (
                left < ds.bounds.left
                or right > ds.bounds.right
                or bottom < ds.bounds.bottom
                or top > ds.bounds.top
            ):
                raise ValueError("La ventana solicitada rebasa el recorte disponible")
            row0, col0 = ds.index(left, top)
            row1, col1 = ds.index(right, bottom)
            row0, col0 = max(0, row0), max(0, col0)
            row1, col1 = min(ds.height - 1, row1), min(ds.width - 1, col1)
            window = Window(col0, row0, col1 - col0 + 1, row1 - row0 + 1)
        width = int(window.width) if window is not None else ds.width
        height = int(window.height) if window is not None else ds.height
        if width * height > 4_000_000:
            raise ValueError(
                "El DEM es demasiado grande para esta exportación; usa un recorte"
            )
        values = (
            ds.read(1, window=window, masked=True).astype(float).filled(np.nan) * scale
            + offset
        )
        bounds = ds.window_bounds(window) if window is not None else ds.bounds
        pixel_m = ds.transform.a
    valid = np.isfinite(values)
    if not np.any(valid):
        raise ValueError("El DEM no contiene alturas válidas")
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
    image = ax.imshow(
        values,
        origin="upper",
        extent=extent,
        interpolation="nearest",
        cmap="terrain",
        norm=norm,
    )
    if relief:
        filled = np.where(valid, values, np.nanmean(values))
        shade = LightSource(azdeg=315, altdeg=45).hillshade(
            filled, vert_exag=2, dx=pixel_m, dy=pixel_m
        )
        shade = np.ma.array(shade, mask=~valid)
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
            label="Emplazamiento",
        )
        ax.legend(loc="upper right")
    color_label = "Altura sobre la esfera lunar (m)"
    if relief:
        color_label += " · colores base"
    fig.colorbar(image, ax=ax, shrink=0.8, pad=0.03, label=color_label)
    ax.set(xlabel="X estereográfico (km)", ylabel="Y estereográfico (km)")
    detail = (
        "sombreado ilustrativo, relieve exagerado 2×"
        if relief
        else "alturas sin sombreado"
    )
    ax.set_title(
        f"LOLA · Elevación del polo sur · {pixel_m:g} m/píxel\n"
        f"NASA LRO/LOLA PGDA · ME DE421 · {detail}",
        fontsize=11,
        pad=12,
    )
    output = BytesIO()
    fig.savefig(output, format="png", dpi=200)
    return output.getvalue()


def main() -> None:
    parser = argparse.ArgumentParser(description="Genera un PNG del recorte lunar LOLA")
    parser.add_argument(
        "--dem",
        choices=("20", "80"),
        default="20",
        help="resolución nominal en metros por píxel",
    )
    parser.add_argument("--output", type=Path, required=True, help="ruta de salida PNG")
    parser.add_argument(
        "--relief",
        action="store_true",
        help="añade sombreado ilustrativo, no iluminación real",
    )
    parser.add_argument("--latitude", type=float, default=-89.5)
    parser.add_argument("--longitude", type=float, default=0.0)
    parser.add_argument(
        "--window-km",
        type=float,
        help="anchura del detalle centrado en el punto, en km",
    )
    args = parser.parse_args()
    path = (
        SAMPLE.with_name("lola_20m_south_pole_sample.tif")
        if args.dem == "20"
        else SAMPLE
    )
    point = sample_elevation(args.latitude, args.longitude, path)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(
        render_terrain_png(path, point, relief=args.relief, window_km=args.window_km)
    )
    print(f"Imagen guardada: {args.output.resolve()}")


if __name__ == "__main__":
    main()
