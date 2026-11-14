# Datos y contraste inicial de efemérides

## Cálculo

SPICE transforma el instante UTC a ET/TDB con `naif0012.tls`; `spkpos` consulta centros de cuerpos `SUN` (10), `EARTH` (399) y `MOON` (301) en `J2000`, con corrección `NONE`. Las posiciones se dan relativas al centro seleccionado. Para efemérides JPL, SPICE utiliza J2000 como denominación del marco alineado con ICRF. La interfaz limita deliberadamente las fechas a 1972–2100 UTC, dentro de la cobertura de DE440s; no presenta fechas anteriores como UTC histórico.

Los kernels, URL y hashes exactos están en [ilargi/kernels.py](../ilargi/kernels.py). Se verifican al cargar y se descargan desde [NAIF](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/). El conjunto incluye DE440s, LSK, PCK de orientación lunar, FK lunar y PCK de constantes. Los tres últimos no determinan los vectores geométricos en J2000 de `positions`. El cálculo aparente sí usa el FK y el PCK de orientación, y nombra `MOON_ME_DE440_ME421`; eso no valida la realización ME de DE421 que usa LOLA. El marco lunar predeterminado de SPICE sigue siendo `IAU_MOON`, y las funciones aparentes no lo usan. El LSK debe actualizarse cuando NAIF publique segundos intercalares nuevos y deben actualizarse entonces su hash y pruebas.

## Comparación con JPL Horizons

Consulta realizada el 14 de noviembre de 2026 mediante la [API de Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html): Luna (301) relativa al centro de la Tierra (399), 2026-04-02 15:00 UTC, vectores geométricos, ICRF, kilómetros y segundos. Parámetros relevantes: `EPHEM_TYPE=VECTORS`, `CENTER=500@399`, `TIME_TYPE=UT`, `REF_PLANE=FRAME`, `REF_SYSTEM=ICRF`, `VEC_CORR=NONE`, `OUT_UNITS=KM-S`, `VEC_TABLE=2`. Horizons identificó **DE441** como fuente.

| Componente | Horizons DE441 (km) | SPICE DE440s (km), redondeado |
| --- | ---: | ---: |
| X | -373910.6664632003 | -373910.66710442 |
| Y | -106746.2116582052 | -106746.20977303 |
| Z | -71540.67909399251 | -71540.67810391 |

La norma de la diferencia es aproximadamente **0,00222 km**. La prueba automatizada conserva la referencia y emplea una tolerancia de 0,01 km para este caso concreto. Es un contraste de implementación, no una garantía general de exactitud: las efemérides DE440 y DE441 están relacionadas y Horizons puede cambiar su modelo. Se ha añadido una segunda referencia lunar una hora después. Estas filas siguen siendo geométricas, en ICRF y sin aberración. El tiempo de luz, la aberración estelar, el marco `MOON_ME_DE440_ME421` y los observadores de centro y de superficie están contrastados aparte, con las mismas opciones en ambos lados, en [geometria-aparente.md](geometria-aparente.md).

## Comprobaciones incluidas

Las pruebas contrastan la referencia guardada de Horizons, la coherencia al cambiar de origen, distancias plausibles, rechazo de entradas ambiguas y ejecución del prototipo Streamlit. Las pruebas geométricas históricas usan `positions`; el prototipo ahora representa direcciones aparentes desde el centro lunar y desde la esfera ideal, descritas en [geometria-aparente.md](geometria-aparente.md). No hay un horizonte topográfico calculado.

En el mismo instante y con las mismas opciones se contrastaron también el Sol relativo al centro lunar (residuo 0,00154 km) y la Tierra relativa al centro solar (0,00069 km). Ambos vectores de referencia se conservan en las pruebas; siguen siendo ejemplos puntuales con DE441, no una validación de todo el intervalo.
