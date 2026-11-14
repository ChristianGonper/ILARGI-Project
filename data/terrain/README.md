# Muestra topográfica LOLA

## Productos completos descargables

`uv run python -m ilargi.download_terrain` descarga el GeoTIFF polar de 80 m citado abajo y [LDEM_128 de PDS](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_128.lbl). No se versionan los archivos grandes. La descarga comprueba tamaño y SHA-256 y usa un archivo temporal antes de instalar cada producto. Los hashes corresponden a los archivos descargados el 14 de noviembre de 2026: polar `82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a`; global `0e4fea9b863e3255f58de15ccbd2bb8b1e248cb09217fd55d23ed37489f764b4`.

`ldem_128.vrt` describe los datos binarios originales sin remuestrearlos: enteros de 16 bits little endian, escala vertical 0,5 m, esfera de radio 1 737 400 m y proyección cilíndrica simple. El producto abarca 0–360° este y 90° S–90° N, a 128 píxeles/grado; la lectura envuelve la longitud. La resolución de 236,9 m es el espaciado en latitud y en el ecuador, no una precisión ni un tamaño constante en longitud. La fuente advierte posibles artefactos en bandas de latitud y datos interpolados. Los DEM se seleccionan individualmente; no se fusionan automáticamente.

`lola_80m_south_pole_sample.tif` es un recorte sin remuestreo del archivo [LDEM_80S_80MPP_ADJ.TIF](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF), publicado por NASA GSFC/PGDA en [A New View of the Lunar South Pole from LOLA](https://pgda.gsfc.nasa.gov/products/90). Se leyó mediante peticiones parciales al COG original el 14 de noviembre de 2026. El GeoTIFF original cubre 80–90° S; este recorte cubre solamente una región de 512 × 512 píxeles, unos 41 × 41 km en coordenadas proyectadas, centrada aproximadamente en 89,5° S, 0° E.

Los valores son alturas en metros y la resolución nominal es 80 m/píxel. El CRS es estereográfico polar sur planetocéntrico con radio de proyección 1 737 400 m y referencia cartográfica ME de DE421. El recorte conserva el CRS, la transformación y los píxeles de la fuente, con compresión sin pérdida. SHA-256 del archivo recortado: `ca8e56e9e2629d3a242e5c2e3fda82482a9df4fcf030084e23f68033759c58b8`.

Es una muestra regional, no cobertura global. Una consulta fuera del recorte o en un píxel sin datos debe rechazarse; no debe suponerse un horizonte completo ni evaluarse la iluminación solo con este recorte. La realización DE440 ME421 de SPICE es próxima al marco DE421 del producto, pero no idéntica; documentar esa aproximación o transformar explícitamente antes de usar una precisión submétrica.

## Recorte a 20 m/píxel

`lola_20m_south_pole_sample.tif` contiene 1024 × 1024 píxeles del [LDEM_80S_20MPP_ADJ.TIF de NASA PGDA](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF), leído como COG mediante peticiones parciales el 14 de noviembre de 2026. Cubre aproximadamente 20,48 × 20,48 km alrededor de 89,5° S y 0° E, sin remuestreo, en la misma proyección y marco de DE421. SHA-256: `828cb2a838c5c076a70fcf98e354bef35fba50cf7ba39fef7a0cee6ef7228af4`.

Un píxel más pequeño no garantiza una medición independiente ni una exactitud de 20 m; deben consultarse las capas de resolución efectiva, recuentos y errores de la fuente. Este recorte cubre menos superficie que el de 80 m y deja más terreno distante sin evaluar.
