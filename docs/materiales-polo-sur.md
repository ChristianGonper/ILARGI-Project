# Abundancias regionales de materiales lunares

La consulta y la capa de materiales utilizan la cobertura global de la tabla LP-GRS. La cobertura topográfica LOLA se determina por separado.

Las abundancias provienen del [archivo PDS Lunar Prospector GRS](https://pds-geosciences.wustl.edu/missions/lunarp/grs_elem_abundance.html), producto `lpgrs_high1_elem_abundance_5deg.tab`, Prettyman et al. (2006). Se incluyen la tabla original y su etiqueta. Las observaciones corresponden a 1998 y el producto usa celdas de área equivalente; sus límites están en cada fila. La resolución espacial del instrumento es aproximadamente 5° de arco, y los valores son estimaciones regionales, no medidas puntuales ni identificación de minerales.

Se utilizan las celdas completas. Los límites se tratan como intervalos cerrados al sur y al oeste y abiertos al norte y al este, con el polo norte incluido en la última banda. Las longitudes se normalizan a [-180°, 180°).

Al y Ca se derivan de las fracciones en masa de Al₂O₃ y CaO por sus proporciones estequiométricas: Al = Al₂O₃ × 2M(Al)/M(Al₂O₃), Ca = CaO × M(Ca)/M(CaO). Las fracciones se multiplican por 100 para expresarlas en porcentaje en masa, igual que FeO. Th permanece en ppm. No se muestran como minerales ni recursos extraíbles.

Para cada variable se calculan los percentiles 33,3 y 66,7 sobre los valores válidos de todas las celdas globales, con igual peso por celda. Baja comprende valores hasta el primer corte, media hasta el segundo y alta los superiores. Son categorías relativas, no umbrales de viabilidad; empates pueden producir categorías desiguales. Las incertidumbres y correlaciones de la matriz original no se propagan a estas categorías.

## Hidrógeno equivalente en agua (WEH)

El mapa global procede de la figura 6 de [Lawrence et al. (2022)](https://doi.org/10.1029/2022JE007197), [datos originales](https://doi.org/10.48732/GRC2-4B57), licencia CC BY 4.0. El instrumento Lunar Prospector Neutron Spectrometer estima hidrógeno en el regolito a partir de neutrones, corrigiendo la composición y calibrando con muestras Apollo. La incertidumbre sistemática indicada es de aproximadamente 10 ppm de hidrógeno. La malla tiene celdas de 0,5°; la huella espacial es aproximadamente 50 km y no permite interpretar detalles locales del tamaño de un cráter.

La aplicación convierte ppm en masa de hidrógeno a ppm de agua equivalente multiplicando por 18,01528 / (2 × 1,00794). Esta equivalencia supone que todo ese hidrógeno formara H₂O: **no demuestra la presencia de agua o hielo ni su concentración real**. La consulta utiliza la celda que contiene el punto, sin interpolar. La textura global usa una escala lineal de transparencia de 0 a 120 ppm de H (aproximadamente 0 a 1072 ppm de WEH): más intensidad indica mayor abundancia. Los dos modos usan la misma malla y escala.

Para regenerar la malla comprimida y la textura desde el ZIP original: `uv run python scripts/prepare_wehr_map.py ruta/al/archivo.zip`.
