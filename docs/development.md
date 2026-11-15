# Development guide

## Structure

`main.py` starts FastAPI. `ilargi/api.py` validates requests and serializes results; `analysis.py` coordinates scientific calculations. `models.py` contains result dataclasses and `events.py` handles crossing interpolation and interval arithmetic. `apparent.py` contains observer geometry, `ephemeris.py` serializes access to SPICE, and `kernels.py` manages pinned kernel downloads. Terrain reading, horizon sampling, disc geometry and time-series generation have separate modules. `materials.py` reads abundance data. Data-building and terrain image commands are standalone utilities rather than request-path dependencies.

The web is React with TypeScript. Components live under `web/src/components/`, with the educational game grouped in `landing-game/`; `web/src/three/` holds reusable globe geometry and navigation. `types.ts` defines API contracts and `api.ts` contains requests and presentation helpers. The `styles.css` entry imports foundation, home, education and landing-game styles in a fixed order. Foundation CSS variables define the shared palette. Keyboard focus and reduced-motion overrides live in the entry file.

## Changes and verification

Use uv for Python and committed lockfiles for installs. Run the checks in the root README. Python lint/format uses Ruff; web and documentation formatting uses Prettier. Add regression tests for numerical changes and preserve public source metadata with derived assets. A successful build does not validate scientific accuracy or browser interactions.

Prefer descriptive English identifiers, comments explaining non-obvious scientific assumptions, and English documentation. Keep generated assets separate from source code. Verify consumers before removing functions: a comparison utility used only by scientific regression tests can still be valuable. Historical implementations may be removed when no supported workflow uses them.

The Python Plotly presentation layer was removed after verifying that only its own tests referenced it. The active interface uses Plotly.js; static scientific terrain export still uses Matplotlib. Astroquery was an unused exploratory dependency and was removed. Pydantic is explicit because the API imports it. HTTPX2 supports the current Starlette TestClient.

## Web loading and styling

Heavy views load through React lazy boundaries so the home screen does not initially require Three.js or Plotly. Plotly uses the official gl2d distribution at the existing version, supporting both scatter and scattergl traces. The stylesheet was split by surface while preserving cascade order. Tailwind is deferred: rewriting established selectors would add migration work without demonstrating a design benefit. Existing CSS tokens remain the design foundation.
