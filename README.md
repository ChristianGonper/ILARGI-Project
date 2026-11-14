# ILARGI

ILARGI explora las condiciones de iluminación y visibilidad desde emplazamientos lunares. El prototipo calcula trayectorias aparentes del **Sol y la Tierra desde un lugar de aterrizaje**, las compara con un horizonte topográfico muestreado y permite consultar y exportar resultados. La visión completa provisional está en [NASA - Space Apps Info - Christian.md](NASA%20-%20Space%20Apps%20Info%20-%20Christian.md).

## Inicio

Se necesitan Python 3.13, [uv](https://docs.astral.sh/uv/) y conexión a internet para descargar los kernels iniciales:

```powershell
uv sync
uv run python -m ilargi.kernels
npm --prefix web ci
npm --prefix web run build
uv run python main.py
```

Abre `http://127.0.0.1:8000` en tu navegador (o usa `npm --prefix web run dev` en `http://localhost:5173` durante desarrollo con recarga en caliente frente a FastAPI). Los kernels se descargan desde NAIF a `data/kernels/` y se verifican con SHA-256. La primera descarga ocupa unos 45 MB. Para incorporar el DEM polar completo y el global, ejecuta `uv run python -m ilargi.download_terrain` (aproximadamente 2,3 GB). Las muestras locales siguen incluidas en el repositorio. Para ejecutar las comprobaciones:

```powershell
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
```

Para activar las comprobaciones de Python antes de cada commit, ejecuta una vez
`uv run pre-commit install`. El hook revisa los archivos preparados; si falla el
formato, aplica `uv run ruff format .` y vuelve a preparar los cambios. Para
comprobar todos los archivos, usa `uv run pre-commit run --all-files`. Ruff no
comprueba ni formatea HTML.

Para HTML, CSS, JavaScript, JSON, Markdown y YAML se usa Prettier. Instala Node.js
y ejecuta `npm ci` una vez; el mismo hook comprueba el formato de los archivos
preparados. Para formatear un archivo, usa `npx prettier --write ruta/al/archivo`.
Prettier comprueba formato, no errores de lógica o validez de HTML.

## Relieve local 3D

En el explorador, selecciona un punto y pulsa **Explorar relieve local 3D**. La vista sigue el punto enfocado (o el primero si no hay foco), permite girar, acercar y desplazar la cámara y ofrece ventanas de 5, 10 y 20 km. El punto azul señala la ubicación seleccionada. La escala vertical inicial es real; ×2 y ×5 exageran únicamente las alturas para facilitar la lectura. Restablecer cámara recupera el encuadre inicial.

La geometría usa alturas LOLA, no la imagen lunar: selecciona el primer DEM que cubra el centro entre muestra de 20 m, muestra de 80 m, polar completo y global. No fusiona fuentes. Sin los productos completos, solo se pueden explorar los recortes incluidos; fuera de cobertura aparece un mensaje. Los píxeles ausentes dejan huecos visibles y la vista indica el porcentaje de cobertura.

`POST /api/terrain/patch` recibe `latitude_deg`, `longitude_east_deg` y `width_km` (2–20). Devuelve una cuadrícula local equidistante de hasta 129 × 129 muestras, alturas en metros (o `null`), fuente, espaciado y cobertura. Lee el píxel original que contiene cada muestra y aplica su escala y desplazamiento vertical. El espaciado de la malla puede superar el del DEM: la vista es una representación reducida, no una herramienta para medir pendientes finas. La malla usa una aproximación local de la curvatura lunar y alturas relativas al centro; las cifras de altura mostradas conservan la referencia al radio de 1 737 400 m.

La iluminación es ilustrativa, sin sombras solares calculadas para la fecha seleccionada. El marco cartográfico es ME DE421, aproximado respecto al ME DE440 del globo; esta vista no modifica las alturas, horizontes ni resultados de los análisis.

`uv.lock` fija las dependencias. Las pruebas necesitan los kernels descargados y `.venv` se genera automáticamente.

La vista de materiales permite comparar abundancias regionales en el polo sur. Las fuentes, conversiones y límites se describen en [materiales del polo sur](docs/materiales-polo-sur.md).

## Qué calcula y qué no

Los objetivos son la Tierra (399) y el Sol (10), vistos desde la Luna (301). El marco explícito es `MOON_ME_DE440_ME421`, con efemérides DE440s y corrección `LT+S` para tiempo de luz y aberración estelar. El observador superficial se calcula por separado: latitud planetocéntrica, longitud este y altura respecto a una esfera de radio 1.737,4 km. El acimut se mide desde el norte hacia el este; el plano horizontal es el de la esfera, no un horizonte topográfico. El azimut exacto en los polos se rechaza por indeterminación del norte.

El DEM polar de 80 m cubre 80–90° S; el global LDEM_128 cubre toda la Luna, con 128 píxeles por grado (unos 237 m en latitud y en el ecuador). Los recortes de 20 y 80 m cubren regiones locales. Todos usan el marco ME de DE421, próximo pero no idéntico a la realización ME de DE440 utilizada en el cálculo. La altura del píxel se utiliza como altura del suelo, sumada a la del instrumento. El horizonte se muestrea sobre el DEM elegido y puede ser parcial: no se garantiza que se hayan considerado todos los obstáculos. El tamaño físico de los píxeles globales en longitud disminuye hacia los polos y el paso radial no garantiza detectar todos los obstáculos. No se calculan discos aparentes, ventanas de iluminación ni comunicaciones. Los datos futuros UTC dependen de la vigencia del kernel de segundos intercalares.

La [guía de trayectorias y horizonte](docs/trayectorias-y-horizonte.md), la [guía interactiva anterior](docs/recorrido.html), [geometría aparente](docs/geometria-aparente.md), [validación](docs/validacion-efemerides.md) y [procedencia del recorte LOLA](data/terrain/README.md) describen las convenciones, contrastes y límites. El [planteamiento inicial](docs/planteamiento-inicial.md) recoge los próximos pasos.

## Organización

- `main.py` e `ilargi/api.py`: servidor FastAPI y punto de entrada web (`http://127.0.0.1:8000`).
- `ilargi/apparent.py`: geometría lunar aparente y observador superficial.
- `ilargi/ephemeris.py` y `ilargi/kernels.py`: infraestructura SPICE y kernels.
- `ilargi/terrain.py`, `ilargi/horizon.py` y `data/terrain/`: consulta LOLA y horizonte parcial.
- `ilargi/series.py`, `ilargi/analysis.py` e `ilargi/sites.py`: series temporales, detección de eventos/noches, incidencia y puntos históricos.
- `ilargi/terrain_image.py`: imágenes PNG de terreno con Matplotlib.
- `web/`: aplicación web React + TypeScript + Three.js (adaptador lunar 3D preparado para CesiumJS) + Plotly.js.
- `tests/` y `docs/`: pruebas y evidencia.

## Exportar un mapa LOLA en PNG

Para producir una imagen con Matplotlib, sin suavizar ni reducir previamente el LDEM:

```powershell
uv run python -m ilargi.terrain_image --dem 20 --output salidas/lola-20m.png
uv run python -m ilargi.terrain_image --dem 20 --relief --window-km 5 --output salidas/lola-20m-detalle.png
```

Ambos comandos marcan por defecto el emplazamiento indicado. La segunda imagen abarca aproximadamente 5 km, ajustados a los bordes de píxel, centrados en 89,5° S, 0° E; puede cambiarse con `--latitude` y `--longitude` si la ventana cabe en el recorte. `--relief` añade sombreado calculado de las pendientes con una exageración vertical de 2× para apreciar formas. Es un recurso gráfico: no muestra la iluminación solar real, no cambia las alturas ni mejora la resolución científica. La barra corresponde a los colores base de altura; el sombreado modifica su brillo. La escala de colores se ajusta al mínimo y máximo de cada vista; el mismo color puede indicar alturas distintas en recortes diferentes. La figura se renderiza en un lienzo de 2200 × 2000 píxeles y la pantalla puede reducirla; la exportación no aumenta la resolución científica de los datos.
