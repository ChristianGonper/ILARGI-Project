# Regional lunar material abundance

The material layer uses global Lunar Prospector Gamma Ray Spectrometer coverage, independently of LOLA terrain coverage. The source is the [PDS LP-GRS archive](https://pds-geosciences.wustl.edu/missions/lunarp/grs_elem_abundance.html), `lpgrs_high1_elem_abundance_5deg.tab`, Prettyman et al. (2006). The original table, label and format are retained. Observations date to 1998; rows describe equal-area cells. The instrument resolution is approximately 5° of arc. Values are regional estimates rather than point measurements or mineral identifications.

Cells include their south/west edges and exclude north/east edges, except that the north pole belongs to the final band. Longitudes normalize to [-180°, 180°).

Al and Ca are derived from oxide mass fractions using stoichiometry: Al = Al₂O₃ × 2M(Al)/M(Al₂O₃), Ca = CaO × M(Ca)/M(CaO). Fractions are multiplied by 100 for mass percent, as is FeO; Th remains in ppm. These are not extractable-resource estimates.

For each variable, valid global cells receive equal weight in the 33.3 and 66.7 percentile cuts. Low includes values up to the first cut, medium up to the second, and high the remainder. Ties can produce unequal groups. These relative categories do not imply viability; original uncertainties and correlations are not propagated.

## Water-equivalent hydrogen

The global hydrogen map comes from figure 6 of [Lawrence et al. (2022)](https://doi.org/10.1029/2022JE007197), with [original data](https://doi.org/10.48732/GRC2-4B57), licensed CC BY 4.0. Lunar Prospector Neutron Spectrometer estimates regolith hydrogen using neutron measurements, composition corrections and Apollo calibration. The reported systematic uncertainty is approximately 10 ppm hydrogen. The grid uses 0.5° cells with an approximately 50 km footprint, unsuitable for local crater-scale interpretation.

Hydrogen mass ppm is converted to water-equivalent ppm using 18.01528 / (2 × 1.00794). This assumes all hydrogen formed H₂O; it does not demonstrate actual water or ice. Queries read the containing cell without interpolation. The global texture maps 0–120 ppm H linearly to opacity, approximately 0–1072 ppm water equivalent. Both views use the same grid and scale.

Regenerate the compressed grid and texture with `uv run python scripts/prepare_weh_map.py <original.zip>`.
