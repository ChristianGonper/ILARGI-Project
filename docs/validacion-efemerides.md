# Datos y contraste inicial de efemérides

## Cálculo

SPICE transforma el instante UTC a ET/TDB con `naif0012.tls`; `spkpos` consulta centros de cuerpos `SUN` (10), `EARTH` (399) y `MOON` (301) en `J2000`, con corrección `NONE`. Las posiciones se dan relativas al centro seleccionado. Para efemérides JPL, SPICE utiliza J2000 como denominación del marco alineado con ICRF. La interfaz limita deliberadamente las fechas a 1972–2100 UTC, dentro de la cobertura de DE440s; no presenta fechas anteriores como UTC histórico.

Los kernels, URL y hashes exactos están en [ilargi/kernels.py](../ilargi/kernels.py). Se verifican al cargar y se descargan desde [NAIF](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/). El conjunto incluye DE440s, LSK, PCK de orientación lunar, FK lunar y PCK de constantes. Los tres últimos se preparan para la siguiente etapa y no determinan los vectores actuales en J2000. Su presencia no significa que la transformación al marco de LOLA esté validada. El LSK debe actualizarse cuando NAIF publique segundos intercalares nuevos y deben actualizarse entonces su hash y pruebas.

## Comparación con JPL Horizons

Consulta realizada el 14 de noviembre de 2026 mediante la [API de Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html): Luna (301) relativa al centro de la Tierra (399), 2026-04-02 15:00 UTC, vectores geométricos, ICRF, kilómetros y segundos. Parámetros relevantes: `EPHEM_TYPE=VECTORS`, `CENTER=500@399`, `TIME_TYPE=UT`, `REF_PLANE=FRAME`, `REF_SYSTEM=ICRF`, `VEC_CORR=NONE`, `OUT_UNITS=KM-S`, `VEC_TABLE=2`. Horizons identificó **DE441** como fuente.

| Componente | Horizons DE441 (km) | SPICE DE440s (km), redondeado |
| --- | ---: | ---: |
| X | -373910.6664632003 | -373910.66710442 |
| Y | -106746.2116582052 | -106746.20977303 |
| Z | -71540.67909399251 | -71540.67810391 |

La norma de la diferencia es aproximadamente **0,00222 km**. La prueba automatizada conserva la referencia y emplea una tolerancia de 0,01 km para este caso concreto. Es un contraste de implementación, no una garantía general de exactitud: las efemérides DE440 y DE441 están relacionadas y Horizons puede cambiar su modelo. Falta validar otros instantes, el Sol, la orientación lunar y los observadores topocéntricos. El producto futuro debe comparar tiempo de luz y aberración solo con configuraciones equivalentes de Horizons.

## Comprobaciones incluidas

Las pruebas contrastan la referencia guardada de Horizons, la coherencia al cambiar de origen, distancias plausibles, rechazo de entradas ambiguas y ejecución de ambas vistas de Streamlit. El dibujo usa posiciones, no tamaños físicos; no se han verificado observaciones desde la superficie ni resultados topográficos.

En el mismo instante y con las mismas opciones se contrastaron también el Sol relativo al centro lunar (residuo 0,00154 km) y la Tierra relativa al centro solar (0,00069 km). Ambos vectores de referencia se conservan en las pruebas; siguen siendo ejemplos puntuales con DE441, no una validación de todo el intervalo.
