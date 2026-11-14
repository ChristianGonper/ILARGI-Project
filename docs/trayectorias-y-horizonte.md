# Trayectorias y horizonte experimental

El prototipo evalúa una serie de posiciones aparentes desde un solo emplazamiento. Selecciona fecha UTC, duración, paso temporal, coordenadas y altura del instrumento. En cada instante emplea `spkcpo` con `LT+S`, observador en superficie y marco `MOON_ME_DE440_ME421`. Se muestran centros puntuales: no se calculan discos, eclipses ni eventos entre muestras.

## Terreno y horizonte

Los recortes LOLA incluidos proceden de los productos regionales de 20 y 80 m/píxel y usan el marco ME de DE421. Su cota representa metros sobre la esfera de 1.737.400 m; el observador se coloca a esa cota más la altura del instrumento. Se aproximan las coordenadas DE421 ME y DE440 ME421 como próximas, no idénticas; consultar las limitaciones temporales en [geometría aparente](geometria-aparente.md).

Para cada azimut, se muestrean puntos de terreno a intervalos iguales al píxel nominal sobre arcos de una esfera lunar. Se proyectan a la malla del GeoTIFF y se toma el píxel que contiene cada punto. Se calcula la elevación angular de cada obstáculo desde el observador, incorporando la curvatura, y se conserva la máxima. El paso angular predeterminado es de 2°. La visualización interpola entre direcciones y muestra ambos recorridos del cielo.

**El resultado es experimental y parcial**: las muestras pueden saltar obstáculos finos o carecer de datos; el barrido termina al encontrar `nodata` o el borde. El alcance varía con el azimut y se muestra en pantalla. Aunque se alcance el radio configurado, puede haber obstáculos más lejanos. No se deben inferir visibilidad certificada, eventos o periodos operativos. El resultado no incorpora incertidumbre topográfica, tamaño del disco ni deflexión gravitatoria. El DEM no se intercambia automáticamente por otro de mayor cobertura.

## Resolución y próximos datos

[PGDA](https://pgda.gsfc.nasa.gov/products/90) ofrece un modelo polar de 20 m/píxel y capas asociadas de error y resolución efectiva. [Los productos locales de 5 m](https://pgda.gsfc.nasa.gov/products/78) cubren sitios concretos y contienen una fracción elevada de píxeles interpolados; el espaciado de cuadrícula no es la precisión de la superficie. Para mejorar sitios límite conviene combinar detalle cercano con un DEM más amplio a distancia, conciliando referencias y evitando huecos y discontinuidades. El motor admite un GeoTIFF compatible por ruta, pero todavía no fusiona resoluciones ni valida horizontes con fuentes externas.

La muestra de 20 m tiene menos cobertura geográfica que la de 80 m. Una imagen más definida no sustituye la necesidad de datos de obstáculos lejanos. La interfaz dibuja los recortes incluidos a su resolución de cuadrícula, sin suavizado. Las comparaciones de horizontes requieren pruebas de convergencia angular, radial y espacial y modelos de referencia adicionales.

## Ejemplos del compañero

El ejemplo de LOLA ilustra lectura de `.img` y proyección polar. Los valores de sus etiquetas deben leerse de cada `.lbl`: `4` en `ldem_4_float` designa muestras por grado, no bytes; debe verificarse el tipo y orden de bytes de cada producto. Para los GeoTIFF elegidos usamos Rasterio/PROJ y su CRS, sin reconstruir manualmente la proyección. El ejemplo SPICE usa vectores geométricos y los resta; nuestro observador topocéntrico usa `spkcpo` con `LT+S` para incorporar también la velocidad y la corrección de luz del lugar. La fracción de disco propuesta es una posible ampliación, no está implementada en esta fase.
