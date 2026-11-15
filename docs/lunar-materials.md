# Regional lunar material abundance

The material layer uses global Lunar Prospector Gamma Ray Spectrometer coverage, independently of LOLA terrain coverage. The source is the [PDS LP-GRS archive](https://pds-geosciences.wustl.edu/missions/lunarp/grs_elem_abundance.html), `lpgrs_high1_elem_abundance_5deg.tab`, [Prettyman et al. (2006)](https://doi.org/10.1029/2005JE002656). The original table, label and format are retained. Observations date to 1998; the 1,790 rows describe equal-area cells. The instrument resolution is approximately 5° of arc (~152 km in latitude; e.g., 5° × 4.5° at the equator, or a 2.5°-radius cap south of 87.5° S). Queries perform a direct point-in-cell lookup rather than searching a custom radius, and values are regional estimates rather than point measurements or mineral identifications.

Cells include their south/west edges and exclude north/east edges, except that the north pole belongs to the final band. Longitudes normalize to [-180°, 180°).

Al and Ca are derived from oxide mass fractions using stoichiometry: Al = Al₂O₃ × 2M(Al)/M(Al₂O₃), Ca = CaO × M(Ca)/M(CaO). Fractions are multiplied by 100 for mass percent, as is FeO; Th remains in ppm. These are not extractable-resource estimates.

For each variable, valid global cells receive equal weight in the 33.3 and 66.7 percentile cuts. Low includes values up to the first cut, medium up to the second, and high the remainder. Ties can produce unequal groups. These relative categories do not imply viability; original uncertainties and correlations are not propagated.

## Water-equivalent hydrogen

The global hydrogen map comes from figure 6 of [Lawrence et al. (2022)](https://doi.org/10.1029/2022JE007197), with [original data](https://doi.org/10.48732/GRC2-4B57), licensed CC BY 4.0. Lunar Prospector Neutron Spectrometer estimates regolith hydrogen using neutron measurements, composition corrections and Apollo calibration. The reported systematic uncertainty is approximately 10 ppm hydrogen. The grid uses 0.5° cells with an approximately 50 km footprint (~25 km radius), unsuitable for local crater-scale interpretation.

Hydrogen mass ppm is converted to water-equivalent ppm using 18.01528 / (2 × 1.00794). This assumes all hydrogen formed H₂O; it does not demonstrate actual water or ice. Queries read the containing cell without interpolation. The base PNG texture maps 0–120 ppm H to opacity using `0.85 * (H / 120)^3`, clipped to `[0, 1]`, with no constant background (approximately 0–1072 ppm water equivalent). When rendering the 3D globe overlay, `buildVividWehCanvas` in `web/src/three/wehOverlay.ts` applies a perceptual boost (`round((alpha / 255)^0.5 * 240)`, capped at `245`) so regional polar gradients remain legible against lunar terrain; both Mission Analysis and Education use the same underlying grid and boosted display scale.

Regenerate the compressed grid and texture with `uv run python scripts/prepare_weh_map.py <original.zip>`.

A 5-degree arc on the reference lunar sphere spans approximately 152 km. LP-GRS cells are equal-area regions (~21,200 km² average), not fixed 152 km squares. WEH grid spacing is about 15 km in latitude (narrower in longitude toward the poles), while its measurement footprint is about 50 km. Display opacity emphasizes concentrations; invisible areas do not imply absent hydrogen.
