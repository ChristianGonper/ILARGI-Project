# Sources and provenance

The scientific model uses public data and published conventions. Links below identify the sources retained from the original project notes, including options considered but not adopted. A link in this inventory does not mean that its software or data is used by ILARGI.

## Sources used by the implementation

| Subject                                      | Source and local evidence                                                                                                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planetary ephemerides, lunar frames and time | NAIF generic kernels; exact URLs and SHA-256 in `ilargi/kernels.py`. DE440s SPK, DE440 lunar orientation, lunar FK, LSK and physical constants PCK.                                         |
| External ephemeris comparison                | JPL Horizons API, retrieved 2026-11-14; original response headers and rows in `docs/horizons/`. These comparisons are regression evidence, not independent observations of JPL ephemerides. |
| Scientific terrain                           | NASA LOLA regional products and PDS LDEM_128. Product URLs, download hashes and byte sizes in `ilargi/download_terrain.py`; sample details in `data/terrain/README.md`.                     |
| Globe height visualization                   | NASA SVS CGI Moon Kit, LRO LOLA; source hash, units and resampling in `web/public/textures/moon_height.json` and `ilargi/build_globe_terrain.py`.                                           |
| Element abundance                            | Lunar Prospector GRS, Prettyman et al. (2006), PDS table, label and format retained under `data/materials/`.                                                                                |
| Hydrogen                                     | Lawrence et al. (2022), DOI 10.1029/2022JE007197; data DOI 10.48732/GRC2-4B57, CC BY 4.0. Conversion script `scripts/prepare_weh_map.py`.                                                   |

## Design history

The original concept was dated 2026-11-11 and summarized a shared ChatGPT discussion. It proposed scientific and educational experiences using a common engine. Its suggested libraries were candidates, not dependencies or proof of implementation. The current scope is in [Project concept](project-concept.md). Git history retains the superseded notes; the repository has one current English documentation set.

## Retained public references

- [http://127.0.0.1:8000`](http://127.0.0.1:8000`)
- [http://localhost:5173`](http://localhost:5173`)
- [https://cesium.com/learn/cesiumjs-learn/](https://cesium.com/learn/cesiumjs-learn/)
- [https://cesium.com/platform/cesium-ion/content/cesium-moon/](https://cesium.com/platform/cesium-ion/content/cesium-moon/)
- [https://chatgpt.com/share/6af3ad89-9374-83eb-8620-89042f3ed522](https://chatgpt.com/share/6af3ad89-9374-83eb-8620-89042f3ed522)
- [https://docs.astral.sh/uv/](https://docs.astral.sh/uv/)
- [https://doi.org/10.1029/2022JE007197](https://doi.org/10.1029/2022JE007197)
- [https://doi.org/10.48732/GRC2-4B57](https://doi.org/10.48732/GRC2-4B57)
- [https://echarts.apache.org/](https://echarts.apache.org/)
- [https://fastapi.tiangolo.com/](https://fastapi.tiangolo.com/)
- [https://github.com/EmanuelAbasto/CLPS-Lunar-Mission-Browser](https://github.com/EmanuelAbasto/CLPS-Lunar-Mission-Browser)
- [https://naif.jpl.nasa.gov/naif/](https://naif.jpl.nasa.gov/naif/)
- [https://naif.jpl.nasa.gov/naif/toolkit_docs.html](https://naif.jpl.nasa.gov/naif/toolkit_docs.html)
- [https://naif.jpl.nasa.gov/pub/naif/generic_kernels/](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/)
- [https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/)
- [https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf)
- [https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/)
- [https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/)
- [https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.cmt](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.cmt)
- [https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/)
- [https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/float_img/ldam_4_float.lbl](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/float_img/ldam_4_float.lbl)
- [https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/float_img/ldem_4_float.lbl](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/float_img/ldem_4_float.lbl)
- [https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_128.lbl](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_128.lbl)
- [https://pds-geosciences.wustl.edu/missions/lunarp/grs_elem_abundance.html](https://pds-geosciences.wustl.edu/missions/lunarp/grs_elem_abundance.html)
- [https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF)
- [https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF)
- [https://pgda.gsfc.nasa.gov/products/69](https://pgda.gsfc.nasa.gov/products/69)
- [https://pgda.gsfc.nasa.gov/products/78](https://pgda.gsfc.nasa.gov/products/78)
- [https://pgda.gsfc.nasa.gov/products/90](https://pgda.gsfc.nasa.gov/products/90)
- [https://plotly.com/javascript/](https://plotly.com/javascript/)
- [https://plotly.com/python/](https://plotly.com/python/)
- [https://pymoo.org/](https://pymoo.org/)
- [https://pyvista.org/](https://pyvista.org/)
- [https://rasterio.readthedocs.io/](https://rasterio.readthedocs.io/)
- [https://spiceypy.readthedocs.io/](https://spiceypy.readthedocs.io/)
- [https://ssd-api.jpl.nasa.gov/doc/horizons.html](https://ssd-api.jpl.nasa.gov/doc/horizons.html)
- [https://ssd.jpl.nasa.gov/api/horizons.api](https://ssd.jpl.nasa.gov/api/horizons.api)
- [https://ssd.jpl.nasa.gov/horizons/app.html](https://ssd.jpl.nasa.gov/horizons/app.html)
- [https://svs.gsfc.nasa.gov/4720/](https://svs.gsfc.nasa.gov/4720/)
- [https://threejs.org/](https://threejs.org/)
- [https://trek.nasa.gov/moon/](https://trek.nasa.gov/moon/)

## Educational provenance recovered from T3

The educational implementation request supplied NASA PGDA Product 69 as the source for polar illumination, permanent-shadow and Earth-visibility context. This was recovered from [the educational implementation thread](t3-thread://v2/7acbc0d9-343a-4147-977b-b50679915176/1ecf7113-b3db-4310-be2a-88edb7e178a5), user message dated 2026-11-14. These are published long-period maps, not results for the selected ILARGI date. The globe's circular cold-trap markers are schematic annotations, not the official PSR raster boundaries.

Laser-ranging background: [NASA laser ranging overview](https://www.nasa.gov/missions/lro/laser-beams-reflected-between-earth-and-moon-boost-science/), [NIST time-of-flight explanation](https://www.nist.gov/history/moon-and-back-25-seconds), and [ILRS reflector inventory](https://ilrs.cddis.eosdis.nasa.gov/missions/satellite_missions/current_missions/ap11_reflector.html).

The reduced web plotting dependency uses the official [Plotly partial distribution](https://github.com/plotly/plotly.js/blob/master/dist/README.md), with scatter and scattergl support. It retains the existing Plotly version rather than combining this optimization with a major upgrade.

Educational site descriptions were revised to avoid presenting uncited local illumination percentages, water concentrations or visibility guarantees as calculated results. Catalog coordinates remain curated demonstration locations. They have not been individually revalidated against an authoritative coordinate catalog in this review.

## Globe image assets recovered from implementation history

The [technical explorer implementation thread](t3-thread://v2/7acbc0d9-343a-4147-977b-b50679915176/43e27dcd-73da-4eb9-9d68-c5e85510999f), command at timeline position 235, records the 2026-11-14 creation of both image maps:

- `moon_color.jpg`: NASA SVS/LROC WAC [lroc_color_poles_4k.tif](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_4k.tif), converted to RGB JPEG at quality 90 with optimization, 4096 × 2048 pixels. The original TIFF hash was not recorded.
- `moon_bump.jpg`: PDS LDEM_128 read to 2048 × 1024 pixels with Rasterio's default resampling, rolled by 1024 columns to center longitude at 0°, clipped to the 0.5/99.5 elevation percentiles, normalized to 8-bit grayscale, and saved at JPEG quality 88. This is illustrative bump shading, not a physical-height scientific DEM.
- `ilargi-mascot.png`: user-supplied character reference in the educational implementation request; no external public license is established by that conversation.

Current packaged asset checksums:

- `moon_color.jpg`: SHA-256 `7b967431bde23105ac79da9e458c16d4e6e21df1d27f0bd351fb67fa7f3287e9`
- `moon_bump.jpg`: SHA-256 `c05290cb685f9028c40612f88154ac4cf985cb359a5377556bd2d0c9bf7456f5`

## Educational spacecraft model

The interactive lander is an original schematic model built from Three.js primitives in `web/src/three/spacecraft.ts`. It is reused in the orbit and the small rotatable previews; no external model license is required. It does not reproduce a verified IM-1 CAD model. The descent surface uses the existing lunar color texture documented above.
