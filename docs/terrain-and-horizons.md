# Terrain and sampled horizons

At each azimuth the engine samples terrain along spherical arcs, transforms into the raster CRS and reads the containing pixel. Angular obstacle elevation includes lunar curvature and observer height. The observer pixel is excluded; the maximum sampled obstacle defines the horizon. Interpolation between adjacent rays is circular and requires finite neighbors.

The scientific observer is placed at DEM elevation plus instrument height. Heights are meters relative to a 1,737,400 m sphere. DEMs must have a compatible spherical lunar CRS, projected coordinates in meters, square north-up pixels, and supported vertical units/scales. Files without explicit vertical units follow the included products' meter-height contract. Invalid metadata is rejected. Missing coverage is a separate condition that permits selection of another candidate or an ideal horizon.

The engine can combine a fine nearby DEM with a coarser distant DEM. Search bounds use the global LOLA elevation extrema relative to the 1,737,400 m sphere (+10,792 m near Engel'gardt rim and −9,129 m inside Antoniadi crater; [Smith et al., 2017](https://doi.org/10.1016/j.icarus.2016.06.006)) together with the elevation already found in each direction. Reaching such a bound does not validate unsampled terrain between rays. The API defaults to 0.25° azimuth spacing; temporal steps are multiples of ten minutes, with the final requested instant always included.

## Coverage and interpretation

A ray can stop at nodata or the raster edge. `coverage_m` records sampled reach, while per-direction required distances support identifying truncation. Center-based visibility uses an ideal 0° horizon where interpolation has no data; disc fractions remain unknown there. The API and series CSV expose each sample's horizon source. See [scientific results](scientific-results.md) for exact interpretation.

## Recorded sensitivity examples

At 89.5° S, 0° E with a 2 m instrument, 8 km search and 2° azimuth spacing, the 20 m and 80 m samples cover the requested radius. Their profiles differ by about 0.048° median and up to 1.48°. Both the ground pixel and obstacle sampling differ, so this is a single-scenario sensitivity comparison, not a measurement error bound.

For the 80 m sample, comparing 2° and 0.5° azimuth sampling over a 20 km search produced differences up to about 0.74° after interpolation. Even 0.5° leaves unsampled gaps. Reproduce convergence checks for the site and resolution of interest rather than adopting either number as general accuracy.

The [terrain README](../data/terrain/README.md) records product origins and hashes. [NASA PGDA](https://pgda.gsfc.nasa.gov/products/90) provides regional products and quality layers; [local 5 m products](https://pgda.gsfc.nasa.gov/products/78) have limited coverage and interpolated pixels. Grid spacing is not independent spatial accuracy. PDS `ldam` products are albedo, while `ldem` products are elevation; inspect each label's units and binary layout.
