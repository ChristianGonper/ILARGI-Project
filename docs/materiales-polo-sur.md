# Materiales de la región polar sur

La región de trabajo abarca latitudes entre 80° S y 90° S, según la cobertura de los productos polares LOLA de la NASA: <https://pgda.gsfc.nasa.gov/products/90>. No es una definición universal del polo sur.

Las abundancias provienen del [archivo PDS Lunar Prospector GRS](https://pds-geosciences.wustl.edu/missions/lunarp/grs_elem_abundance.html), producto `lpgrs_high1_elem_abundance_5deg.tab`, Prettyman et al. (2006). Se incluyen la tabla original y su etiqueta. Las observaciones corresponden a 1998 y el producto usa celdas de área equivalente; sus límites están en cada fila. La resolución espacial del instrumento es aproximadamente 5° de arco, y los valores son estimaciones regionales, no medidas puntuales ni identificación de minerales.

Se seleccionan las celdas que intersectan la región y se recortan visualmente en 80° S; la estimación original de una celda que cruza ese límite sigue correspondiendo a la celda completa. Los límites se tratan como intervalos cerrados al sur y al oeste y abiertos al norte y al este, salvo el límite exterior de la región. Las longitudes se normalizan a [-180°, 180°).

Al y Ca se derivan de las fracciones en masa de Al₂O₃ y CaO por sus proporciones estequiométricas: Al = Al₂O₃ × 2M(Al)/M(Al₂O₃), Ca = CaO × M(Ca)/M(CaO). Las fracciones se multiplican por 100 para expresarlas en porcentaje en masa, igual que FeO. Th permanece en ppm. No se muestran como minerales ni recursos extraíbles.

Para cada variable se calculan los percentiles 33,3 y 66,7 sobre los valores válidos de las celdas que intersectan la región, con igual peso por celda, incluidas las parcialmente recortadas. Baja comprende valores hasta el primer corte, media hasta el segundo y alta los superiores. Son categorías relativas, no umbrales de viabilidad; empates pueden producir categorías desiguales. Las incertidumbres y correlaciones de la matriz original no se propagan a estas categorías.

El hidrógeno equivalente en agua (WEH) queda sin datos: aún no se ha identificado y validado un producto polar concreto con su documentación, unidades y cobertura. WEH es un indicador de hidrógeno, no una detección directa de hielo.
