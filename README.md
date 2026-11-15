# ILARGI

Interactive Lunar Analyzer for Radiance, Geometry, and Intervisibility: a NASA Space Apps hackathon prototype for exploring Sun and Earth visibility from lunar locations.

The React application offers a technical site explorer and an educational experience. A Python engine computes apparent directions, sampled terrain horizons, center-based visibility events and disc fractions. The educational landing game is a simplified illustration.

## Run locally

Install Python 3.13, [uv](https://docs.astral.sh/uv/) and Node.js with npm. From the repository root:

```powershell
uv sync --locked
uv run python -m ilargi.kernels
npm ci
npm --prefix web ci
npm --prefix web run build
uv run python main.py
```

Open http://127.0.0.1:8000. During development, run the Python server and `npm --prefix web run dev` in separate terminals; Vite proxies `/api` to port 8000.

The initial NAIF kernel download is about 45 MB. Kernels are verified by SHA-256, with a shared cache under `~/.ilargi/kernels`; `ILARGI_KERNEL_DIR` selects an existing alternative. Local terrain samples are included. To download the full polar and global DEMs (about 2.3 GB) into the shared terrain cache (`~/.ilargi/terrain`, overrideable via `ILARGI_TERRAIN_DIR`), run `uv run python -m ilargi.download_terrain`.

## Documentation

- [Project concept and scope](docs/project-concept.md)
- [Scientific results and limitations](docs/scientific-results.md): interpreting visibility, incidence and discs
- [Apparent geometry](docs/apparent-geometry.md): observer, frames, units and corrections
- [Terrain and horizons](docs/terrain-and-horizons.md): sampling, coverage and convergence
- [Ephemeris validation](docs/ephemeris-validation.md): retained comparison evidence
- [Lunar materials](docs/lunar-materials.md): abundance categories and water-equivalent hydrogen
- [Terrain data provenance](data/terrain/README.md)
- [Sources and provenance](docs/sources.md)
- [Development guide](docs/development.md)

## Checks

```powershell
uv run --locked pytest -q
uv run --locked ruff check .
uv run --locked ruff format --check .
npm --prefix web test
npm --prefix web run build
```

Run `uv run pre-commit install` once to enable staged-file checks. Ruff handles Python and Prettier handles web files and documentation. Format with `uv run ruff format .` or `npx prettier --write <path>`. Both dependency ecosystems have committed lockfiles.

## Terrain visualization and export

The globe carries a display DEM derived from NASA SVS's [CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/), credited to NASA Scientific Visualization Studio / LRO LOLA. The 16-sample-per-degree source is reduced to 8 by 2 × 2 block averaging. Its roughly 3.8 km spacing cannot represent small craters or meter-scale features. Subdivision and bilinear interpolation smooth the display without adding observations. Heights retain physical scale relative to a radius of 1,737,400 m. Lighting is illustrative; the display DEM does not replace the DEM used by scientific calculations.

Source provenance is in `web/public/textures/moon_height.json`. Regenerate with `uv run python -m ilargi.build_globe_terrain <source.tif>`; the source hash is checked.

For static terrain images:

```powershell
uv run python -m ilargi.terrain_image --dem 20 --output outputs/lola-20m.png
uv run python -m ilargi.terrain_image --dem 20 --relief --window-km 5 --output outputs/lola-detail.png
```

The default location is 89.5° S, 0° E. The optional relief shading uses 2× vertical exaggeration for illustration; it is not solar lighting. Each view uses its own elevation color range. Export dimensions do not increase scientific resolution.
