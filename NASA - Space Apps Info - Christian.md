# ILARGI — Hoja de ruta técnica y conceptual

## Interactive Lunar Analyzer for Radiance, Geometry, and Intervisibility \| Documento de trabajo para el hackathon NASA \| 11 de noviembre de 2026

Este contenido es un resumen de un amplio desarrollo en [ChatGPT](https://chatgpt.com/share/6af3ad89-9374-83eb-8620-89042f3ed522) sobre qué se podría usar durante el desarrollo del proyecto. Se ha de tomar como un punto provisional del que tomar información para la definición posterior

# 1\. Visión y alcance

ILARGI es una herramienta interactiva para explorar emplazamientos de aterrizaje lunar y comparar las condiciones del Sol y de la Tierra a partir de una fecha y duración de misión. Se centra inicialmente en el polo sur lunar, donde la topografía y los ángulos bajos de iluminación hacen que pequeños cambios de emplazamiento o calendario tengan consecuencias importantes.

Preguntas que debe responder: ¿qué lugares cumplen los requisitos el día previsto de aterrizaje?, ¿cuándo se pierde la iluminación útil o la visibilidad geométrica de la Tierra?, ¿cómo cambia el resultado si se retrasa la fecha?, y ¿qué emplazamientos alternativos ofrecen condiciones similares?

Fuera del alcance inicial: trayectoria desde la Tierra, propagación de la órbita de una nave, aterrizaje dinámico, certificación de seguridad del terreno, cálculo detallado de potencia eléctrica y análisis de enlace con estaciones terrestres específicas. Estos asuntos pueden registrarse como evoluciones futuras, sin condicionar el primer hito.

La herramienta debe ofrecer una experiencia divulgativa y otra técnica sobre el MISMO motor científico. La primera explica el fenómeno; la segunda permite examinar series temporales, datos, hipótesis, márgenes, perfiles y comparaciones.

## Definición de escenario

Entradas propuestas: fecha y hora de ATERRIZAJE (no de lanzamiento); duración de análisis; región o coordenadas del candidato; lista de emplazamientos; altura del observador/instrumento sobre el suelo; límites mínimos de iluminación y visibilidad terrestre; duración máxima tolerable de oscuridad; opcionalmente pendiente máxima y otros filtros.

Salidas: posición aparente del Sol y Tierra (acimut/elevación), horizonte local, ventanas de iluminación/visibilidad, intersección de ventanas, primera pérdida operativa, sunset/earthset según definición documentada, periodos máximos sin luz, métricas por candidato, clasificación y alternativas al retrasar la fecha.

# 2\. Flujo de trabajo científico de extremo a extremo

A. El usuario define un escenario (fecha, región, duración y criterios).

B. Se generan o recuperan candidatos: lista curada de emplazamientos y/o malla de puntos de una región.

C. Se leen efemérides JPL y orientación lunar; se convierten coordenadas geográficas de cada candidato a posiciones lunares tridimensionales.

D. Desde cada candidato se calcula la dirección aparente temporal del Sol y la Tierra, expresada en acimut y elevación locales.

E. Se obtiene el perfil de horizonte topográfico del lugar a partir de DEM lunar, incluyendo altura del observador y curvatura lunar.

F. Se evalúan las reglas de visibilidad con el tamaño aparente de cada cuerpo y los márgenes elegidos; se detectan y refinan los cambios de estado.

G. Se resumen métricas, se descartan candidatos que incumplen restricciones y se ordenan los restantes.

H. Se sirven resultados estructurados a la web: globo, vista local, calendario, gráficos y comparación de escenarios.

# 3\. Efemérides y geometría — JPL Horizons y SPICE

## Qué son y de dónde salen

Las efemérides describen posición y, con frecuencia, velocidad de cuerpos celestes en función del tiempo, en un origen y un sistema de referencia definidos. Los modelos JPL se construyen integrando ecuaciones dinámicas y ajustando sus parámetros a observaciones astronómicas y de seguimiento. No hay que resolver desde cero la mecánica orbital de la Luna para esta aplicación.

## Alternativas

JPL Horizons: servicio remoto y API para consultar tablas de posiciones, acimut, elevación y observaciones desde ubicaciones planetarias. Excelente para exploración inicial, casos de contraste y pocos emplazamientos. Requiere red; no es la vía preferente para miles de consultas automatizadas.

SPICE / SpiceyPy: bibliotecas y kernels descargables para cálculos geométricos locales y repetibles. Recomendación para el motor de ILARGI, especialmente si se analizan muchas ubicaciones y fechas. Horizons y SPICE no son modelos físicos contrapuestos: pueden emplear efemérides subyacentes de la misma familia.

Astroquery/JPLHorizons: interfaz Python para consultar Horizons sin construir manualmente todas las peticiones HTTP; útil en notebooks y pruebas exploratorias.

## Kernels SPICE relevantes

SPK: posiciones de cuerpos (por ejemplo DE440); PCK: orientación/rotación lunar y parámetros físicos; FK: marcos de referencia; LSK: conversiones de escalas de tiempo. DSK: modelos de superficie compatibles con SPICE, opcionales si el tratamiento del DEM se hace con herramientas ráster.

Elección inicial razonable: de440s.bsp para efemérides planetarias (\~1850–2150), más kernels lunares de orientación basados en DE440, FK correspondiente y LSK. DE440 completo cubre aproximadamente 1550–2650. Comprobar la cobertura exacta de cada kernel descargado y no mezclar marcos incompatibles.

## Propagación, interpolación y búsqueda de eventos

Interpolar efemérides precalculadas no es lo mismo que propagar una órbita. SPICE recupera posiciones para instantes dentro de la cobertura disponible. Propagar por cuenta propia exigiría integrar ecuaciones del movimiento y no está justificado en ILARGI. La tarea matemática propia es buscar eventos temporales: cuándo una condición de visibilidad cruza un umbral, por ejemplo con muestreo y refinamiento numérico (SciPy).

## Sistemas de referencia

Secuencia: latitud/longitud/altura lunares → XYZ en un marco solidario con la Luna → vectores aparentes del Sol/Tierra → acimut/elevación en el sistema horizontal local. MOON\_ME (cartográfico) y MOON\_PA (ejes principales) son referencias lunares relevantes. Elegir la referencia según el producto topográfico y usar los kernels de orientación de alta precisión.

Especial atención cerca del polo: definir consistentemente azimut, eje local, orientación de mapas y significado del horizonte horizontal. La altura real del instrumento y la inclinación local del terreno son conceptos diferentes.

# 4\. Topografía lunar — LOLA, DEM y horizontes

## Fuentes y formatos

LOLA (Lunar Orbiter Laser Altimeter, LRO) aporta modelos topográficos regionales y locales. Productos regionales del polo sur pueden ofrecer aproximadamente 20 m/píxel; existen productos locales de 5 m/píxel para ciertos sitios de interés. LROC NAC estéreo puede mejorar el detalle donde haya cobertura. Los DEM suelen encontrarse en GeoTIFF con proyección estereográfica polar; hay que respetar proyección, datum, referencia lunar y metadatos.

Fuentes recomendadas: NASA PGDA (productos regionales y de alta resolución), Planetary Data System, NASA Moon Trek para exploración y contraste.

## Perfil de horizonte: solución recomendada preliminar

Para cada emplazamiento y altura de observador, barrer el terreno por acimutes; calcular la elevación angular aparente de los obstáculos y guardar el máximo por dirección. El resultado H(acimut) es reutilizable en distintas fechas. El cálculo debe contemplar la curvatura lunar y obstáculos lejanos, no solo el DEM inmediato.

Enfoque multirresolución: DEM de mayor detalle en el entorno cercano y uno regional más grueso a mayor distancia. Esta separación reduce costes sin ignorar montañas lejanas que pueden bloquear un Sol muy bajo.

Bibliotecas: Rasterio/GDAL (lectura y reproyección), PROJ/pyproj (transformaciones), NumPy (matrices y geometría), SciPy (interpolación), Numba si los barridos de horizonte requieren acelerar cálculos. Guardar horizontes precalculados, por ejemplo en NPZ o Zarr si el volumen lo justifica.

## Datos precalculados: oportunidad para el hackathon

NASA publica productos de iluminación media, visibilidad terrestre, regiones permanentemente sombreadas y, según producto, medidas de incertidumbre. Sirven para seleccionar regiones prometedoras y contrastar patrones generales; NO sustituyen el cálculo temporal específico para una fecha como el 2 de abril a las 15:00.

## Límites de interpretación

Resolución de cuadrícula no equivale a precisión del terreno: parte de los píxeles de DEM de alta resolución pueden estar interpolados. Separar claramente resultados con horizonte geométrico ideal de resultados corregidos por relieve real.

# 5\. Criterios físicos y ventanas operativas

## Discos aparentes y márgenes

El Sol y la Tierra no son puntos. En lugar de elegir exclusivamente «centro visible» o «primer borde visible», se recomienda representar fracción del disco visible y definir un umbral operativo documentado, más un margen angular configurable. La geometría aparente varía con la distancia y el horizonte depende del acimut. El criterio solar y el terrestre no tienen por qué ser iguales.

Sol: fracción mínima del disco visible y margen adicional para una estimación geométrica de disponibilidad solar. No confundir visibilidad solar con potencia generada: ésta depende de orientación y eficiencia de paneles, temperatura y otros factores.

Tierra: visibilidad geométrica del disco y margen respecto al horizonte. No implica por sí sola comunicación radio fiable ni visibilidad de una estación terrestre específica; esto se mantiene como hito posterior.

## Eventos y métricas

Diferenciar sunset/earthset geométricos de pérdida operativa de iluminación o de visibilidad. Un mismo emplazamiento puede mantener Tierra visible durante todo el intervalo o no registrar un evento de puesta; la interfaz debe mostrar «sin evento en el periodo evaluado», no inventar una fecha.

Series básicas: sun\_ok(t), earth\_ok(t), ambos\_ok(t), además de las magnitudes continuas (elevación, acimut, margen y fracción visible). Métricas: porcentaje de tiempo con luz, con visibilidad terrestre, con ambas condiciones, interrupción máxima, primera pérdida operativa y ventanas contiguas.

Cálculo recomendado: muestreo temporal inicial y refinamiento de cruces, cuidando eventos muy próximos o discontinuidades del perfil de horizonte.

# 6\. Comparación de emplazamientos y retrasos de calendario

Caso central de ILARGI: emplazamiento A el 20 de marzo con condiciones favorables; al retrasarse al 2 de abril, volver a evaluar A y buscar B, C… que mantengan condiciones equivalentes o superen requisitos mínimos.

## Estrategia de búsqueda inicial

1\) Definir perfil del escenario original. 2\) Evaluar candidatos en la nueva fecha. 3\) Aplicar restricciones duras (duración máxima de oscuridad, mínimos de visibilidad, etc.). 4\) Ordenar los viables según similitud o preferencia. 5\) Presentar resultados comparables con explicaciones de los compromisos.

No comparar solamente porcentajes agregados: dos ubicaciones con 90 % de iluminación pueden tener secuencias de oscuridad muy diferentes. Considerar la continuidad temporal y las interrupciones máximas. Una puntuación alta nunca debe ocultar el incumplimiento de un requisito obligatorio.

Comenzar con lista curada y/o rejilla geográfica limitada; usar búsqueda exhaustiva, filtrado y ranking. Pymoo (optimización multiobjetivo) o algoritmos avanzados serían evoluciones opcionales si el número de candidatos y restricciones lo justifica.

# 7\. Dos experiencias de visualización con un único núcleo

## Modo divulgativo

Globo lunar, selección de fecha y lugar, terreno local 3D, representación comprensible del Sol y la Tierra, estado de iluminación/visibilidad y cuenta atrás a pérdidas operativas. Textos explicativos y comparación visual de antes/después de un retraso. Mostrar siempre cuándo un resultado es idealizado o corregido por topografía.

## Modo científico o técnico

Gráficos temporales de elevación/acimut y margen angular; perfil del horizonte H(azimut) frente a trayectorias aparentes; diagrama de ventanas operativas; mapa de calor emplazamiento × fecha; dispersión/Pareto de iluminación frente a visibilidad y otros criterios; series superpuestas de varios escenarios; tablas de eventos y exportación de datos/metadatos.

Interacciones clave: zoom y selección de intervalos, activar/ocultar series, cursor temporal sincronizado, comparación lado a lado, filtros, consulta de valores exactos y exportación CSV/JSON/imagen. La línea temporal debe mantener sincronizados mapa, vista local y gráficos.

## Bibliotecas de gráficos

Plotly (Python y Plotly.js): recomendación inicial para gráficos científicos interactivos y trabajo exploratorio. ECharts: alternativa sólida si la personalización visual y los dashboards se vuelven prioritarios. Matplotlib: publicaciones, figuras estáticas y exportación reproducible. Bokeh: opción de análisis interactivo próximo a Python.

## Globo y terreno 3D

CesiumJS: primera opción para globo geoespacial con cámaras, capas, puntos y terreno. Cesium Moon ofrece datos lunares 3D listos para visualizar mediante Cesium ion: revisar condiciones de acceso, dependencia de servicio y coherencia respecto al DEM científico. Three.js: alternativa o complemento para escenas locales, visualizaciones divulgativas libres y animaciones personalizadas, pero no reconstruir un globo geoespacial completo sin necesidad. PyVista: explorar mallas y DEM en Python/Jupyter y producir visualización científica 3D.

La representación 3D puede utilizar terreno de distinta resolución del DEM de cálculo; debe identificarse esta diferencia. No interpretar automáticamente sombras del renderizador como los resultados físicos del modelo de visibilidad.

# 8\. Recursos y documentación

JPL Horizons (interfaz) — https\://ssd.jpl.nasa.gov/horizons/app.html

JPL Horizons API — https\://ssd-api.jpl.nasa.gov/doc/horizons.html

NAIF / SPICE — https\://naif.jpl.nasa.gov/naif/

SpiceyPy — https\://spiceypy.readthedocs.io/

Kernels SPK planetarios NAIF — https\://naif.jpl.nasa.gov/pub/naif/generic\_kernels/spk/planets/

Kernels PCK NAIF — https\://naif.jpl.nasa.gov/pub/naif/generic\_kernels/pck/

Marcos FK lunares/satélites NAIF — https\://naif.jpl.nasa.gov/pub/naif/generic\_kernels/fk/satellites/

PGDA — topografía regional polo sur — https\://pgda.gsfc.nasa.gov/products/90

PGDA — topografía de alta resolución polo sur — https\://pgda.gsfc.nasa.gov/products/78

PGDA — iluminación polar — https\://pgda.gsfc.nasa.gov/products/69

NASA Moon Trek — https\://trek.nasa.gov/moon/

Rasterio — https\://rasterio.readthedocs.io/

Plotly Python — https\://plotly.com/python/

Plotly.js — https\://plotly.com/javascript/

Apache ECharts — https\://echarts.apache.org/

PyVista — https\://pyvista.org/

CesiumJS — https\://cesium.com/learn/cesiumjs-learn/

Cesium Moon — https\://cesium.com/platform/cesium-ion/content/cesium-moon/

Three.js — https\://threejs.org/

FastAPI — https\://fastapi.tiangolo.com/

pymoo — https\://pymoo.org/

Referencia externa a revisar sin asumir exactitud — CLPS Lunar Mission Browser — https\://github.com/EmanuelAbasto/CLPS-Lunar-Mission-Browser
