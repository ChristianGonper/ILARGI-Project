# Project — ILARGI

**ILARGI** (_Interactive Lunar Analyzer for Radiance, Geometry, and Intervisibility_; _ilargi_ means “Moon” in Basque) is a tool conceived and under development during the NASA Space Apps 2026 hackathon to explore solar illumination, Earth visibility, topography, and composition on the Moon, with an initial emphasis on the South Pole and support for global coverage.

The project has two aims: to make lunar geometric phenomena understandable and to maintain **scientific accuracy**. Academic approximations are nevertheless adopted where necessary because of the event's constraints.

## System duality

ILARGI offers **two distinct experiences built on the same scientific engine** (FastAPI + SPICE + LOLA + LP-GRS), selectable from [HomeScreen.tsx](web/src/components/HomeScreen.tsx):

1. **PRO mode (`pro`) — Technical mission analysis:** a scientific workspace with multiple preset or custom points, apparent Sun/Earth tracks, LOLA terrain horizons, visible disc fractions and geometric eclipses, events (`sunrise`/`sunset`/`earthrise`/`earthset`), dark-interval durations, solar incidence, regional LP-GRS/WEH abundances, site comparisons, and data export.
2. **Education mode (`education`) — Guided exploration with the ILARGI mascot:** a gamified visual experience covering a lunar synodic cycle (~29.53 days / 708.7 h) on the 3D globe, historically significant locations, a **water-equivalent hydrogen (WEH)** layer, a simultaneous **three-body orbital visualization (Sun · Earth · Moon)**, and a **Lunar Landing Game**.

## Key characteristics and conventions

- **Ephemerides and two non-interchangeable observers:**
  - `ephemeris.py` manages kernel loading, UTC validation, time conversion, and serialized access to SPICE. `education.py` computes geometric `J2000` vectors without corrections (`NONE`) for the three-body view.
  - `apparent.py` computes apparent directions with `LT+S` in the explicit **`MOON_ME_DE440_ME421`** frame on the reference sphere. The surface observer includes the velocity due to lunar rotation.
- **Visual 3D terrain versus scientific DEM:** the Three.js globe uses a reduced global DEM (`web/public/textures/moon_height.bin.gz`, ~3.8 km/pixel) and illustrative lighting.
- **LOLA topography and frames ([ilargi/terrain.py](ilargi/terrain.py), [ilargi/horizon.py](ilargi/horizon.py)):**
  - LOLA DEMs use the **DE421** `ME` frame.
  - The repository includes local crops (`lola_80m_south_pole_sample.tif` and `lola_20m_south_pole_sample.tif` around `89.5° S, 0° E`) and supports downloading the full DEMs (~2.3 GB: polar 80 m and global `ldem_128.vrt` at approximately 237 m).

## Basic structure

- `ilargi/`: Python scientific engine.
- `data/`: `kernels/` (downloadable NAIF kernels), `materials/` (LP-GRS and WEH), and `terrain/` (LOLA crops and `ldem_128.vrt`).
- `docs/`: technical documentation covering conventions, limitations, and validation against JPL Horizons.
- `scripts/`: data preparation utilities.

## Getting started and useful commands

NAIF kernels (~45 MB) **are not tracked in Git** and are required to run the API and Python tests. `ilargi/kernels.py` looks in `data/kernels/`, `~/.ilargi/kernels`, or `ILARGI_KERNEL_DIR`:

```powershell
uv sync
uv run python -m ilargi.kernels
npm --prefix web ci
npm --prefix web run build
uv run python main.py
```

- Optional full DEMs (~2.3 GB): `uv run python -m ilargi.download_terrain`.

# Git management

Use descriptive English commit messages explaining what each commit includes, without prefixes such as `fix(engine)`. Make commits as you work, following good practices.

When starting work on a new branch or worktree, create a pull request immediately and work through it.

# Tools and checks

- Use Ruff for Python linting and formatting (`uv run ruff check .` and `uv run ruff format --check .`).
- Use Prettier to format its supported file types (`npx --no-install prettier --check ...` / `--write ...`).
- The repository includes `.pre-commit-config.yaml` (`uv run pre-commit install`).
