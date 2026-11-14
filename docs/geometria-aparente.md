# Geometría aparente desde la Luna

Este cálculo da la dirección aparente de la Tierra y del Sol el 2 de abril de 2026 y en otros instantes de prueba. Hay dos observadores y no son intercambiables.

| Observador   | Punto                                                                 | Función                       | Salida                                              |
| ------------ | --------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------- |
| Centro lunar | Centro de masa `MOON` (301), el de `de440s.bsp`                       | `apparent_from_lunar_center`  | Vector en `MOON_ME_DE440_ME421`                     |
| Superficie   | Punto de una esfera ideal, con latitud, longitud este y altura radial | `apparent_from_lunar_surface` | Ese mismo vector y el acimut y la elevación locales |

La altura cero está sobre la esfera, a 1737,4 km del centro. No es el observador del centro. El centro no tiene horizonte, así que no devuelve acimut ni elevación.

`positions` sigue siendo otra cosa: centros de masa, corrección `NONE`, marco `J2000`. No usa este módulo.

## Marco

El marco de salida es `MOON_ME_DE440_ME421`, definido en `moon_de440_250416.tf` como un giro fijo desde `MOON_PA_DE440`. En ese kernel, `MOON_ME` es un alias de este marco. Los resultados guardan el nombre explícito, no el alias.

El giro medido con los kernels cargados, de `MOON_PA_DE440` a `MOON_ME_DE440_ME421`, es constante e igual a 0,028863328214°. El comentario del FK lo resume como unos 0,02886°, unos 875 m sobre un círculo máximo. No depende del instante.

`IAU_MOON`, el marco que SPICE asocia por defecto a la Luna, no es este marco. En 2026-04-02 15:00 UTC el ángulo entre ambos es de unos 0,00256° (cerca de 78 m sobre la superficie). El FK describe, para 2000–2040, una media de unos 0,00239° y una amplitud de unos 0,0051°. El valor de un instante no sustituye ese recorrido.

No hay un kernel de orientación DE421 cargado. `MOON_ME_DE440_ME421` es la aproximación publicada por NAIF al ME de DE421, no la realización DE421. El comentario del FK, no una comparación hecha en este repositorio, da el giro máximo entre `MOON_ME_DE421` y `MOON_ME_DE440_ME421`: 3,071×10⁻⁷ rad (unos 53 cm de arco) entre 2000 y 2040, y 5,820×10⁻⁷ rad (poco más de 1 m) entre 1900 y 2051. Cada resultado repite esta relación en `provenance.de421_relation`.

El producto LOLA del polo sur usa el ME de DE421. La muestra `data/terrain/lola_80m_south_pole_sample.tif` está documentada aparte, con CRS estereográfico, radio de proyección 1 737 400 m y esa referencia cartográfica. Este módulo no la lee. Una altura LOLA no se convierte aquí en altura del observador: el datum vertical y la realización del marco no se han reconciliado, y no se calcula horizonte topográfico.

## Esfera, coordenadas y horizonte

`pck00011.tpc` define `BODY301_RADII = (1737.4, 1737.4, 1737.4)` km. Los tres radios coinciden, así que la referencia es una esfera y la latitud planetodética coincide con la planetocéntrica. Si dejaran de coincidir, el cálculo se detiene en lugar de tratar un elipsoide como esfera.

La longitud es positiva hacia el este en `MOON_ME_DE440_ME421` y se reduce a [0, 360). La latitud está en el intervalo abierto (−90, 90). En el polo el norte local no es único: ±90° se rechaza y no se inventa un acimut. La altura es radial, en kilómetros, sobre la esfera. Debe dejar el punto fuera del centro.

El cenit es la normal exterior de la esfera. El norte es la componente del eje +Z del marco lunar perpendicular a ese cenit. El acimut vale 0 hacia el norte y crece hacia el este: norte 0°, este 90°, sur 180°, oeste 270°. La elevación es el ángulo sobre el plano perpendicular al cenit, positiva hacia el cenit. Se construyen analíticamente los vectores locales norte, este y cenit, evitando la pérdida de precisión de `twovec` cerca de los polos. Cerca del cenit el acimut es muy sensible a pequeños cambios y en el cenit exacto no tiene significado físico.

## Tiempo de luz y aberración

UTC se convierte a ET/TDB con `naif0012.tls`. La corrección es `LT+S`: tiempo de luz newtoniano de recepción, con una iteración, y aberración estelar newtoniana por la velocidad del observador respecto al baricentro del Sistema Solar. No incluye deflexión gravitatoria de la luz ni refracción.

En la superficie, `spkcpo` recibe la posición fija del punto en `MOON_ME_DE440_ME421` y el locus `OBSERVER`. El marco de salida se evalúa en el instante de la observación. La velocidad que entra en la aberración incluye la rotación lunar del punto, porque la posición es constante en el marco que gira. El tiempo de luz se resuelve desde ese punto, no desde el centro.

En el centro, `spkpos` observa desde `MOON`. Para este marco, centrado en la Luna, un desplazamiento nulo en `spkcpo` con locus `OBSERVER` reproduce el mismo vector. La interfaz pública no ofrece ese desplazamiento: el centro y la superficie tienen funciones distintas.

Con corrección `NONE`, el vector de superficie es el vector del centro menos la posición del punto. Con `LT+S` esa traslación no vale. En 2026-04-02 15:00 UTC, desde el ecuador y longitud 0, la diferencia supera 1 km para el Sol y 10 m para la Tierra.

## Cobertura

La intersección de `de440s.bsp` para el Sol, la Tierra y la Luna con `moon_pa_de440_200625.bpc` (marco 31008, del que sale el giro fijo a ME421) es el intervalo ET de DE440s: 1849 DEC 26 00:00:00.000 a 2150 JAN 22 00:00:00.000. La interfaz admite solo 1972–2100 UTC, dentro de ese intervalo y del uso civil de UTC con segundos intercalares. Una fecha exterior se rechaza aunque el kernel llegue más lejos.

## API

```python
apparent_from_lunar_center(instant, targets=("EARTH", "SUN")) -> LunarCenterApparent
apparent_from_lunar_surface(
    instant, latitude_deg, longitude_east_deg, height_km=0.0, targets=("EARTH", "SUN")
) -> LunarSurfaceApparent
horizontal_angles(direction_km, latitude_deg, longitude_east_deg) -> HorizontalAngles
reference_radius_km() -> float
ephemeris_coverage_et() -> tuple[float, float]
```

`instant` necesita zona horaria. `targets` es una secuencia de `"EARTH"` y `"SUN"`, sin repeticiones. `LunarCenterApparent.target("EARTH")` devuelve `position_km` en el marco lunar, `light_time_s` y `range_km`. `LunarSurfaceApparent` añade `site.position_km` y, en cada objetivo, `azimuth_deg`, `elevation_deg` y `topocentric_km` (norte, este, arriba, en km). `provenance` lleva el marco, `LT+S`, el locus, el radio, el ángulo respecto a `MOON_PA_DE440`, el ángulo respecto a `IAU_MOON`, y los textos sobre DE421 y sobre la ausencia de terreno.

## Contraste con Horizons

Consulta del 14 de noviembre de 2026 a la [API de Horizons](https://ssd.jpl.nasa.gov/api/horizons.api). Horizons identificó **DE441**. Los núcleos locales son **DE440s** y la orientación lunar DE440. Las filas y las cabeceras están en [comparacion-2026-11-14.json](horizons/comparacion-2026-11-14.json). Una respuesta completa de acimut y elevación está en [muestra-observador-tierra.txt](horizons/muestra-observador-tierra.txt).

Vectores: `EPHEM_TYPE=VECTORS`, `REF_PLANE=FRAME`, `REF_SYSTEM=ICRF`, `VEC_CORR=LT+S`, `OUT_UNITS=KM-S`, `TIME_TYPE=UT`. El centro es `500@301`. La superficie es `coord@301`, `COORD_TYPE=GEODETIC` y `SITE_COORD` con longitud este, latitud y altura en km. El vector de SPICE, calculado en `MOON_ME_DE440_ME421`, se gira a `J2000` en el instante de observación antes de restarlo. Para estos kernels, `J2000` nombra el ICRF.

| Caso                                         | Residuo del vector |
| -------------------------------------------- | -----------------: |
| Tierra, centro, 2026-04-02 15:00 y 16:00 UTC |    2,45 m y 2,47 m |
| Sol, centro, los mismos instantes            |    9,28 m y 9,08 m |
| Tierra en (0° E, 0° N, 0 km), 15:00 UTC      |             2,45 m |
| Sol en (348,8° E, 43,3° S, 0 km), 15:00 UTC  |             9,26 m |
| Sol en (90° E, 45° N, 2 km), 15:00 UTC       |             9,35 m |
| Tierra en (0° E, 89,5° S, 0 km), 16:00 UTC   |             2,47 m |

`REF_PLANE=BODY` de Horizons es el ecuador y el nodo de la fecha, no el marco fijo al cuerpo. No se usan esas componentes cartesianas como referencia de `MOON_ME_DE440_ME421`.

Acimut y elevación: `EPHEM_TYPE=OBSERVER`, `QUANTITIES=4,20`, `ANG_FORMAT=DEG`, `APPARENT=AIRLESS`, `RANGE_UNITS=KM`, `EXTRA_PREC=YES`. La cabecera de la muestra dice `Center pole/equ : MEAN_ME (high precision)`, radios `1737.4, 1737.4, 1737.4` y `Atmos refraction: NO (AIRLESS)`. Horizons describe ese acimut como horario desde el norte y corregido por tiempo de luz, deflexión gravitatoria y aberración estelar. SPICE `LT+S` no aplica la deflexión gravitatoria. El residuo de abajo incluye esa diferencia de modelo y la de DE440s frente a DE441; no las separa.

| Caso                                             | Δacimut · cos(elevación) | Δelevación | Δalcance |
| ------------------------------------------------ | -----------------------: | ---------: | -------: |
| Tierra, ecuador, 2026-04-02 15:00 UTC            |                −0,00092″ |  +0,00091″ |  −0,14 m |
| Sol, ecuador, el mismo instante                  |                +0,00006″ |  +0,00005″ |   +3,7 m |
| Tierra, 348,8° E, 43,3° S                        |                −0,00122″ |  +0,00042″ |  −0,14 m |
| Sol, 0° E, 89,5° S                               |                +0,00006″ |  −0,00004″ |   +1,8 m |
| Tierra, 90° E, 45° N, 2 km                       |                +0,00083″ |  −0,00099″ |  −0,13 m |
| Sol, el mismo punto, 2024-06-21 12:00 UTC        |                +0,00005″ |   0,00000″ |   −4,7 m |
| Tierra, 222,5° E, 88,2° S, 0,01 km, ese instante |                −0,00108″ |  +0,00007″ |  +0,06 m |

El acimut sin el coseno de la elevación llega a 0,009″ en el primer caso porque la Tierra está a 84° de elevación: el paralelo de acimut es corto. La componente que mide dirección en el cielo es la multiplicada por el coseno.

El alcance de la Tierra difiere unos 14 cm. El del Sol, unos pocos metros. En la fila solar de Horizons el último dígito impreso vale cerca de 0,01 km; en la terrestre llega al centímetro, de modo que esos 14 cm no se explican solo por el redondeo de la tabla.

La prueba automática conserva estas filas. Tolera 0,02 km en el vector ICRF, 0,005″ en cada componente de cielo y 0,05 km en el alcance. Son umbrales de regresión de estos casos, no una exactitud general ni una incertidumbre de DE440.

## Lo que no afirma este resultado

No es un horizonte real, ni una fracción de disco, ni una ventana de iluminación, ni una evaluación de potencia o de comunicaciones. No usa el recorte LOLA y no debe presentarse como terreno calculado. No demuestra que `MOON_ME_DE440_ME421` y el ME de DE421 sean el mismo marco. Horizons no es una medida independiente de las efemérides JPL: contrasta la implementación, el marco y las correcciones pedidas.
