# Muestra topográfica LOLA

`lola_80m_south_pole_sample.tif` es un recorte sin remuestreo del archivo [LDEM_80S_80MPP_ADJ.TIF](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF), publicado por NASA GSFC/PGDA en [A New View of the Lunar South Pole from LOLA](https://pgda.gsfc.nasa.gov/products/90). Se leyó mediante peticiones parciales al COG original el 14 de noviembre de 2026. El GeoTIFF original cubre 80–90° S; este recorte cubre solamente una región de 512 × 512 píxeles, unos 41 × 41 km en coordenadas proyectadas, centrada aproximadamente en 89,5° S, 0° E.

Los valores son alturas en metros y la resolución nominal es 80 m/píxel. El CRS es estereográfico polar sur planetocéntrico con radio de proyección 1 737 400 m y referencia cartográfica ME de DE421. El recorte conserva el CRS, la transformación y los píxeles de la fuente, con compresión sin pérdida. SHA-256 del archivo recortado: `ca8e56e9e2629d3a242e5c2e3fda82482a9df4fcf030084e23f68033759c58b8`.

Es una muestra regional, no cobertura global. Una consulta fuera del recorte o en un píxel sin datos debe rechazarse; no debe suponerse un horizonte completo ni evaluarse la iluminación solo con este recorte. La realización DE440 ME421 de SPICE es próxima al marco DE421 del producto, pero no idéntica; documentar esa aproximación o transformar explícitamente antes de usar una precisión submétrica.
