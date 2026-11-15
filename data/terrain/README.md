# LOLA terrain data

## Downloadable full products

`uv run python -m ilargi.download_terrain` downloads the polar 80 m GeoTIFF and [PDS LDEM_128](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_128.lbl) into the shared cache `~/.ilargi/terrain` (or `ILARGI_TERRAIN_DIR` when set) so separate Git worktrees can share a single copy without duplicating 2.3 GB. At runtime, `ilargi.terrain` checks `ILARGI_TERRAIN_DIR`, `data/terrain/`, and `~/.ilargi/terrain`. Large files are excluded from Git. Downloads verify size and SHA-256 before installing temporary files. Recorded hashes from 2026-11-14:

- Polar: `82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a`
- Global: `0e4fea9b863e3255f58de15ccbd2bb8b1e248cb09217fd55d23ed37489f764b4`

`ldem_128.vrt` describes the original binary without resampling: little-endian 16-bit integers, 0.5 m vertical scale, 1,737,400 m sphere, simple cylindrical projection. Coverage is 0–360° east and 90° S–90° N, 128 pixels/degree, with longitude wrapping. The 236.9 m spacing applies in latitude and at the equator; longitudinal spacing decreases toward the poles. The source notes latitude-band artifacts and interpolated data. The engine can combine compatible products at different distances.

## Included samples

The 80 m sample is a losslessly compressed, unresampled crop of [LDEM_80S_80MPP_ADJ.TIF](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF), published by NASA GSFC/PGDA in [A New View of the Lunar South Pole from LOLA](https://pgda.gsfc.nasa.gov/products/90). It was read with COG range requests on 2026-11-14. The full product covers 80–90° S; this crop is 512 × 512 pixels, about 41 × 41 projected kilometers, centered near 89.5° S, 0° E.

Heights are meters, nominal spacing 80 m/pixel. The CRS is south-polar stereographic, planetocentric, radius 1,737,400 m, with DE421 ME cartographic reference. The crop retains source CRS, transform and pixels. SHA-256: `ca8e56e9e2629d3a242e5c2e3fda82482a9df4fcf030084e23f68033759c58b8`.

The 20 m sample contains 1024 × 1024 pixels from [LDEM_80S_20MPP_ADJ.TIF](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF), read by COG range requests on the same date. It spans about 20.48 × 20.48 km around the same location, without resampling, in the same projection and frame. SHA-256: `828cb2a838c5c076a70fcf98e354bef35fba50cf7ba39fef7a0cee6ef7228af4`.

Neither crop provides global coverage. Outside/nodata queries are rejected by the terrain reader. Finer grid spacing does not guarantee independent measurements or matching accuracy; consult source quality, count and effective-resolution layers. DE440 ME421 approximates DE421 ME but is not identical. See [terrain and horizons](../../docs/terrain-and-horizons.md).
