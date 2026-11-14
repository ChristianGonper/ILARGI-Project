# Trayectorias y horizonte experimental

> Historical notes: parts of this document describe earlier versions and are
> no longer current. For the present calculation and its limits, see
> [Scientific results and limitations](scientific-results.md).

El prototipo evalúa una serie de posiciones aparentes desde un solo emplazamiento. Selecciona fecha UTC, duración, paso temporal, coordenadas y altura del instrumento. En cada instante emplea `spkcpo` con `LT+S`, observador en superficie y marco `MOON_ME_DE440_ME421`. Las trayectorias muestran los centros; también se calculan y representan discos aparentes y eclipses geométricos en cada muestra. No se calculan eventos entre muestras.

El paso temporal es un múltiplo de 10 minutos, con un mínimo de 10 minutos. El final se incluye si dista al menos 10 minutos de la muestra anterior; de lo contrario, la serie termina en la muestra regular anterior.

## Terreno y horizonte

Los recortes LOLA incluidos proceden de los productos regionales de 20 y 80 m/píxel y usan el marco ME de DE421. Su cota representa metros sobre la esfera de 1.737.400 m; el observador se coloca a esa cota más la altura del instrumento. Se aproximan las coordenadas DE421 ME y DE440 ME421 como próximas, no idénticas; consultar las limitaciones temporales en [geometría aparente](geometria-aparente.md).

Para cada azimut, se muestrean puntos de terreno a intervalos iguales al píxel nominal sobre arcos de una esfera lunar. Se proyectan a la malla del GeoTIFF y se toma el píxel que contiene cada punto. Se calcula la elevación angular de cada obstáculo desde el observador, incorporando la curvatura, y se conserva la máxima. El paso angular predeterminado es de 0,5° y se puede ajustar; incluso con ese paso pueden quedar obstáculos entre los rayos. El píxel que contiene al observador se excluye como obstáculo. La visualización interpola entre direcciones y muestra ambos recorridos del cielo.

**El resultado es experimental y parcial**: las muestras pueden saltar obstáculos finos o carecer de datos; el barrido termina al encontrar `nodata` o el borde. El alcance varía con el azimut y se muestra en pantalla. Aunque se alcance el radio configurado, puede haber obstáculos más lejanos. No se deben inferir visibilidad certificada, eventos o periodos operativos. El resultado no incorpora incertidumbre topográfica, tamaño del disco ni deflexión gravitatoria. El DEM no se intercambia automáticamente por otro de mayor cobertura.

## Resolución y próximos datos

[PGDA](https://pgda.gsfc.nasa.gov/products/90) ofrece un modelo polar de 20 m/píxel y capas asociadas de error y resolución efectiva. [Los productos locales de 5 m](https://pgda.gsfc.nasa.gov/products/78) cubren sitios concretos y contienen una fracción elevada de píxeles interpolados; el espaciado de cuadrícula no es la precisión de la superficie. Para mejorar sitios límite conviene combinar detalle cercano con un DEM más amplio a distancia, conciliando referencias y evitando huecos y discontinuidades. El motor admite un GeoTIFF compatible por ruta, pero todavía no fusiona resoluciones ni valida horizontes con fuentes externas.

La muestra de 20 m tiene menos cobertura geográfica que la de 80 m. Una imagen más definida no sustituye la necesidad de datos de obstáculos lejanos. La interfaz dibuja los recortes incluidos a su resolución de cuadrícula, sin suavizado. Las comparaciones de horizontes requieren pruebas de convergencia angular, radial y espacial y modelos de referencia adicionales.

## Ejemplos del compañero

El ejemplo de LOLA ilustra lectura de `.img` y proyección polar. La etiqueta oficial distingue [`ldam_4_float`](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/float_img/ldam_4_float.lbl), que es un mapa de albedo (brillo), de [`ldem_4_float`](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/float_img/ldem_4_float.lbl), que contiene alturas en kilómetros. El documento del compañero menciona ambos nombres; no son intercambiables. Los valores de sus etiquetas deben leerse de cada `.lbl`: `4` en `ldem_4_float` designa muestras por grado, no bytes; debe verificarse el tipo y orden de bytes de cada producto. Para los GeoTIFF elegidos usamos Rasterio/PROJ y su CRS, sin reconstruir manualmente la proyección. El ejemplo SPICE usa vectores geométricos y los resta; nuestro observador topocéntrico usa `spkcpo` con `LT+S` para incorporar también la velocidad y la corrección de luz del lugar. La fracción de disco propuesta es una posible ampliación, no está implementada en esta fase.

## Comprobación exploratoria de resolución

En el emplazamiento 89,5° S, 0° E, con instrumento a 2 m sobre el píxel de cada DEM, radio de búsqueda de 8 km y azimuts cada 2°, los recortes de 20 y 80 m cubren los 8 km en todas las direcciones muestreadas. Sus perfiles difieren aproximadamente 0,048° de mediana y hasta 1,48° en el azimut de mayor diferencia. Cada DEM aporta su propia cota del píxel del lugar, además de distintos valores de relieve y muestreo. Es una comparación exploratoria de este único escenario, no una medida de error ni prueba de que uno de los perfiles sea correcto; muestra por qué conviene analizar sensibilidad a resolución y cobertura.

El CSV incluye, para cada posición, el alcance común de los dos rayos vecinos, la resolución nominal y el paso angular. Un alcance parcial no prueba ausencia de obstáculos más lejos. Los DEM compatibles deben tener CRS lunar esférico en metros y orientación norte arriba; se aplican escala, desplazamiento y unidades verticales conocidas. Si el archivo no declara unidad vertical se asumen metros, como exige el contrato de entrada de los productos incluidos.

Al comparar el perfil de 80 m con rayos cada 2° frente a otro con rayos cada 0,5°, en el mismo lugar y con búsqueda de 20 km, la diferencia absoluta alcanzó aproximadamente 0,74° al interpolar el perfil grueso sobre el fino. No es una cota de error: muestra que el paso angular de 2° puede pasar por alto relieve. Incluso 0,5° deja huecos entre rayos y se debe estudiar la convergencia según el emplazamiento.

## Discos y eclipses

El radio angular es asin(radio físico / distancia al centro), con radios esféricos de 695 700 km para el Sol y 6 371 km para la Tierra. Una cuadrícula de 61 × 61 en el plano tangente muestrea cada disco. Para cada dirección se interpola el horizonte; los rayos solares también se comparan con el disco terrestre, combinando ambas ocultaciones sin contar dos veces su intersección. Las fracciones son aproximaciones geométricas con brillo solar uniforme; no son potencia eléctrica y no incluyen refracción ni dispersión atmosférica terrestre. Las direcciones sin perfil producen fracción desconocida. Un horizonte incompleto puede sobrestimar visibilidad, incluso donde existe perfil. Las gráficas de discos muestran un instante de la serie; sus ejes están en grados y cada disco se amplía por separado. Las fracciones se exportan en el CSV.
