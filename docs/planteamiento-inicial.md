# ILARGI: planteamiento inicial y plan de primera implementación

## Objetivo y primer corte

Construir un motor reproducible común a las futuras experiencias divulgativa y técnica. Dado un lugar lunar, un instante UTC y un intervalo, calcular la dirección del Sol y de la Tierra y, después, sus ventanas de visibilidad. Comenzar por un único emplazamiento y horizonte ideal; incorporar relieve real solo cuando la geometría y sus convenciones estén contrastadas. El resultado idealizado debe identificarse como tal. El documento original describe el alcance completo; este archivo concreta una primera aproximación y no presupone que esté ya implementada.

## Convenciones y decisiones científicas

- Fuente topográfica inicial: [LOLA, DEM regional del polo sur](https://pgda.gsfc.nasa.gov/products/90), en estereográfica polar y marco lunar ME de DE421. Cada archivo puede tener su propia cobertura, resolución, valores nulos y metadatos: leerlos y conservarlos junto al resultado. La resolución de píxel no es precisión garantizada; utilizar las capas de error y resolución efectiva cuando corresponda.
- Efemérides y orientación propuestas: DE440s y orientación lunar DE440. El [FK lunar de NAIF](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf) define `MOON_ME_DE440_ME421`, próximo al ME de DE421, pero no idéntico. No considerar equivalentes ambos marcos sin cuantificar la diferencia para el intervalo y la precisión requeridos. Para una transformación explícita entre realizaciones puede hacer falta además el FK/PCK de DE421 compatible; comprobar su disponibilidad, cobertura y composición antes de usarlo. Conservar la realización del marco en los datos, no solo el alias `MOON_ME`.
- Definir y registrar coordenadas planetocéntricas o planetográficas, longitud positiva hacia el este, unidades y dominio; verificar la convención real del producto antes de convertir. Distinguir altura del DEM respecto a su superficie de referencia, posición radial y altura del observador sobre el terreno. No asumir que el radio usado por SPICE, el CRS y el datum vertical del DEM coinciden: extraerlos de las fuentes y documentar cualquier transformación.
- Convertir UTC a tiempo de efemérides mediante SPICE y un LSK vigente. Establecer las correcciones de tiempo de luz y aberración de manera explícita y reproducible, tanto en SPICE como en Horizons. Las comparaciones deben usar el mismo instante, observador, marco, correcciones y unidades; documentar las diferencias residuales de modelos.
- Para el sistema horizontal, definir cenit como normal de la superficie de referencia elegida, azimut desde el norte hacia el este y elevación respecto al plano horizontal local. En el polo exacto el norte y el azimut necesitan una convención especial: inicialmente rechazar ese caso o definirlo expresamente, nunca devolver un valor arbitrario sin avisar.
- Horizonte ideal y horizonte topográfico son productos distintos. La visibilidad del disco no es potencia eléctrica ni garantiza comunicaciones. Señalar incertidumbre y limitaciones de resolución, cobertura y muestreo temporal.

## Kernels propuestos

Obtenerlos de NAIF, registrar URL, nombre, versión, SHA-256, fecha y cobertura y cargarlos mediante un manifiesto reproducible. No versionar automáticamente archivos grandes ni descargar en cada ejecución. La cobertura válida es la intersección de todos los kernels y datos usados; validarla antes de calcular.

| Función                                    | Archivo inicial                                  | Fuente                                                                                                           |
| ------------------------------------------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Efemérides planetarias                     | `de440s.bsp`                                     | [SPK planetarios](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/)                               |
| Orientación lunar                          | `moon_pa_de440_200625.bpc`                       | [PCK y comentario de cobertura](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.cmt) |
| Marcos lunares                             | `moon_de440_250416.tf`                           | [FK lunar compatible](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf)     |
| Tiempo UTC/TDB                             | `naif0012.tls` o LSK vigente, fijado por versión | [LSK de NAIF](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/)                                           |
| Constantes físicas, cuando sean necesarias | `pck00011.tpc`                                   | [PCK genéricos](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/)                                         |

El PCK binario citado cubre desde finales de 1549 hasta enero de 2650 en ET; DE440s tiene una cobertura menor. Comprobar límites exactos programáticamente y conservarlos en el manifiesto. El PCK de texto no sustituye a la orientación lunar de alta precisión. No cargar kernels de orientación alternativos sin controlar su prioridad.

## Validación y herramientas auxiliares

1. Inspeccionar kernels y coberturas con SpiceyPy y herramientas NAIF; comprobar transformaciones directas/inversas, ortonormalidad y casos conocidos, incluyendo latitudes próximas al polo.
2. Usar [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/app.html) y su [API](https://ssd-api.jpl.nasa.gov/doc/horizons.html), directamente o con Astroquery, para obtener referencias de Sol y Tierra desde el centro lunar y desde emplazamientos lunares. Guardar petición, respuesta, fecha, convenciones y versiones. Primero contrastar vectores y luego azimut/elevación; fijar tolerancias justificadas tras estudiar precisión y diferencias de marco, escala temporal, topocentro y correcciones. Horizons es una referencia externa útil, no una prueba independiente de las efemérides compartidas.
3. Verificar el ráster con metadatos de Rasterio/PROJ, puntos conocidos y transformaciones de ida y vuelta. Comprobar que la muestra pertenece a la cobertura y no es `nodata`. Contrastar también con productos publicados y [Moon Trek](https://trek.nasa.gov/moon/), teniendo en cuenta sus diferentes capas y resoluciones.
4. Para horizontes, usar superficies sintéticas con solución conocida, comparar un algoritmo simple con el optimizado y estudiar convergencia al variar radio de búsqueda, resolución y paso angular. Un DEM recortado puede ocultar obstáculos más lejanos: informar de cobertura insuficiente.
5. Para eventos, probar casos con y sin cruces, cruces cercanos y límites del intervalo; repetir con pasos temporales menores y refinar cruces sin dar por detectados eventos entre muestras. Guardar parámetros y tolerancias junto a los resultados.

## Plan de implementación

1. **Inventario reproducible de datos.** Seleccionar y adquirir kernels; registrar hashes, licencias, cobertura y procedencia; implementar carga y diagnósticos. Inspeccionar un DEM LOLA concreto, su CRS y su referencia vertical antes de utilizar sus alturas. Entrega: configuración verificable y diagnóstico de datos.
2. **Geometría sin relieve.** Definir modelos de escenario y unidades; convertir coordenadas del emplazamiento y calcular vectores topocéntricos y azimut/elevación del Sol y la Tierra. Contrastar con Horizons en varios momentos y latitudes, incluida la zona polar. Entrega: series y metadatos exportables, con tolerancias documentadas.
3. **Eventos con horizonte ideal.** Implementar criterios sencillos explícitos, muestreo, refinamiento y métricas de ventanas; distinguir ausencia de evento de error o falta de cobertura. Contrastar casos analíticos y sensibilidad al paso. Entrega: informe reproducible de un escenario.
4. **Terreno LOLA.** Leer un área concreta, conciliar CRS, marco y alturas, y generar perfiles de horizonte que tengan en cuenta curvatura y altura de observador. Validar con terrenos sintéticos, cobertura y convergencia; estudiar una segunda resolución para obstáculos lejanos. Entrega: comparación ideal/relieve con límites claros.
5. **Comparación y presentación.** Incorporar fracción de disco y márgenes con hipótesis verificables, restricciones y candidatos; después ofrecer visualizaciones técnicas y divulgativas sobre el mismo motor. La interfaz definitiva sigue abierta: evaluar un ecosistema web o Python según los requisitos de interacción, visualización 3D y distribución. Una API, FastAPI, Plotly y CesiumJS son opciones a considerar, no decisiones tomadas; evaluar también acceso y coherencia de los datos de terreno.

No se fijan todavía tolerancias científicas finales ni un área o fecha de demostración: dependen de las necesidades de la misión, los datos elegidos y la validación. La primera implementación debe publicar tanto las limitaciones como la procedencia de cada resultado.
