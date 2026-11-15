# Apparent geometry from the Moon

## Observers and coordinates

`apparent_from_lunar_surface` observes from a point on a sphere with planetocentric latitude, east-positive longitude and radial height in kilometers. Zero height is 1,737.4 km from the center; it is not the lunar mass center. A center observer would have no local azimuth or elevation. The educational animation computes lunar-center directions internally for globe lighting, without a separate public center-observer API.

The constants PCK supplies equal lunar radii. A nonspherical radius definition is rejected. Longitudes normalize to [0, 360); exact ±90° latitudes are rejected because local north is indeterminate. Local north, east and zenith are constructed analytically. Azimuth starts at north and increases eastward; elevation is measured above the ideal spherical tangent plane. Azimuth becomes ill-conditioned near the zenith.

## Frames

The explicit frame is `MOON_ME_DE440_ME421`, defined by `moon_de440_250416.tf` as a fixed rotation from `MOON_PA_DE440`. Its measured rotation is 0.028863328214°, about 875 m along a great circle. `IAU_MOON` is a different frame: the recorded difference at 2026-04-02 15:00 UTC is about 0.00256° (78 m).

The NAIF FK describes `MOON_ME_DE440_ME421` as an approximation to DE421 ME. It reports maximum differences of 3.071e-7 rad (about 53 cm) over 2000–2040 and 5.820e-7 rad (just over 1 m) over 1900–2051. These are statements in the kernel comments, not a DE421/DE440 comparison performed here. LOLA uses DE421 ME; ILARGI does not explicitly transform between these realizations. Each result records its frame relationship in provenance.

## Time and apparent direction

Timezone-aware UTC is converted to ET/TDB through the pinned LSK. The application accepts 1972–2100 UTC, within the intersection of the loaded SPK and lunar orientation coverage. Future UTC conversions depend on the leap-second kernel's continued validity.

The correction is `LT+S`: reception light time with one Newtonian iteration and stellar aberration. It excludes gravitational deflection and refraction. Surface calculations use `spkcpo` with a body-fixed observer and `OBSERVER` locus, evaluating the output frame at observation time. The observer velocity includes lunar rotation. Subtracting a site vector from an apparent center vector does not reproduce this correction; that subtraction is valid for geometric `NONE` vectors.

Geometric mass-center vectors use `J2000` with `NONE`; for these JPL kernels, J2000 is aligned with ICRF. They differ from the apparent surface vectors used in site analysis. The former `positions` and center-observer wrappers were removed because they had no application consumers. Current regression tests exercise the surface calculation directly against saved Horizons cases.

## Public functions

The entry points used by the application are `apparent_from_lunar_surface`, `horizontal_angles`, and `reference_radius_km` in `ilargi/apparent.py`. Targets are unique selections of `EARTH` and `SUN`. Results include range, light time, vectors, provenance, site coordinates and north/east/up components. Kernel coverage remains enforced internally during the surface calculation.

See [ephemeris validation](ephemeris-validation.md) for comparison parameters and [scientific results](scientific-results.md) for how terrain is applied downstream. Original kernel URLs and hashes are in [kernels.py](../ilargi/kernels.py); the [NAIF FK](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf) is the source for the frame statements above.
