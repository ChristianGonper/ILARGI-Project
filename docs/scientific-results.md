# Scientific results and limitations

ILARGI is an exploratory prototype, not a certified landing-site or communications analysis tool. The calculation and its limitations should be considered together.

## Observer and terrain

The apparent directions of the Sun and Earth are computed with SPICE `LT+S`, from a surface observer in `MOON_ME_DE440_ME421`. The observer height is the sampled ground elevation plus instrument height. The terrain products use a DE421 lunar reference, which is approximated by, but is not identical to, the DE440 frame used for the calculation. The kernel identities and hashes are recorded in [kernels.py](../ilargi/kernels.py); the original frame discussion and Horizons comparisons are in [apparent geometry](apparent-geometry.md). See [NAIF's SPICE documentation](https://naif.jpl.nasa.gov/naif/toolkit_docs.html) and the [JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html).

The terrain horizon is sampled along discrete azimuths and radial positions. It can miss obstacles between samples or beyond the available coverage. The nominal pixel spacing is not an accuracy guarantee. ILARGI can combine a nearby DEM with a coarser product; details and provenance of the included samples are in the [terrain README](../data/terrain/README.md) and [NASA's LOLA polar DEM description](https://pgda.gsfc.nasa.gov/products/90).

When a DEM does not cover a location, the analysis may use an ideal 0° horizon. When a terrain profile lacks data at a particular direction, center-based visibility and event calculations also use 0° at that sample. This is an assumption, not evidence that the terrain is clear. The API and series CSV identify each sample as `terrain`, `ideal`, or `ideal_fallback`. Even `terrain` can represent incomplete radial coverage. Invalid DEM metadata causes an error rather than an ideal fallback.

## Visibility, events and discs

The visibility percentages, hours, events and shadow spans use the apparent **center** of each body relative to the effective horizon. Crossing times are linearly interpolated between samples; shorter events can be missed, and the estimates do not account for eclipses. The requested final instant is included even when the last interval is shorter than the regular step. Incidence statistics use the ideal spherical local normal and center visibility, not the terrain slope or a power model.

Disc fractions are calculated separately at sampled instants using a finite 61 × 61 grid and an interpolated horizon, assuming spherical apparent radii of 695,700 km for the Sun ([IAU 2015 Resolution B3](https://www.iau.org/static/resolutions/IAU2015_English.pdf)) and 6,371.0 km for Earth ([NASA Earth Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html), volumetric mean radius rather than triaxial PCK radii). Solar eclipse fractions also include geometric overlap with the Earth disc. Unknown terrain directions make the corresponding horizon-dependent fractions unknown. These fractions assume uniform brightness and do not model atmospheric refraction, scattering or power generation. A finite horizon remains only a partial estimate where terrain coverage is incomplete.

The tests exercise implementation behavior and selected comparisons; they do not establish a general error bound. Use finer temporal, angular and terrain sampling and independent validation before drawing site-specific conclusions.
