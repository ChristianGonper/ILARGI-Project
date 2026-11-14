# ILARGI

ILARGI explora las condiciones de iluminación y visibilidad desde emplazamientos lunares. El prototipo calcula direcciones aparentes del **Sol y la Tierra desde la Luna**, tanto desde su centro como desde un observador en una esfera lunar ideal. Permite consultar una muestra topográfica LOLA y exportar resultados. La visión completa provisional está en [NASA - Space Apps Info - Christian.md](NASA%20-%20Space%20Apps%20Info%20-%20Christian.md).

## Inicio

Se necesitan Python 3.13, [uv](https://docs.astral.sh/uv/) y conexión a internet para descargar los kernels iniciales:

```powershell
uv sync
uv run python -m ilargi.kernels
uv run streamlit run main.py
```

Abre la dirección local que muestre Streamlit. Los kernels se descargan desde NAIF a `data/kernels/` y se verifican con SHA-256. La primera descarga ocupa unos 45 MB. La muestra LOLA regional está incluida en el repositorio. Para ejecutar las comprobaciones:

```powershell
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
```

Para activar las comprobaciones de Python antes de cada commit, ejecuta una vez
`uv run pre-commit install`. El hook revisa los archivos preparados; si falla el
formato, aplica `uv run ruff format .` y vuelve a preparar los cambios. Para
comprobar todos los archivos, usa `uv run pre-commit run --all-files`. Ruff no
comprueba ni formatea HTML; actualmente no hay un formateador HTML configurado.

`uv.lock` fija las dependencias. Las pruebas necesitan los kernels descargados y `.venv` se genera automáticamente.

## Qué calcula y qué no

Los objetivos son la Tierra (399) y el Sol (10), vistos desde la Luna (301). El marco explícito es `MOON_ME_DE440_ME421`, con efemérides DE440s y corrección `LT+S` para tiempo de luz y aberración estelar. El observador superficial se calcula por separado: latitud planetocéntrica, longitud este y altura respecto a una esfera de radio 1.737,4 km. El acimut se mide desde el norte hacia el este; el plano horizontal es el de la esfera, no un horizonte topográfico. El azimut exacto en los polos se rechaza por indeterminación del norte.

El recorte LOLA cubre únicamente una región limitada del polo sur, con resolución nominal de 80 m/píxel y marco ME de DE421. La realización ME de DE440 usada en el cálculo es próxima pero no idéntica. La altura del píxel se muestra por separado y no se aplica automáticamente al observador. El recorte no permite calcular el horizonte completo. No se calculan sombras por relieve, discos aparentes, ventanas de iluminación ni comunicaciones. Los datos futuros UTC dependen de la vigencia del kernel de segundos intercalares.

La [guía interactiva](docs/recorrido.html), [geometría aparente](docs/geometria-aparente.md), [validación](docs/validacion-efemerides.md) y [procedencia del recorte LOLA](data/terrain/README.md) describen las convenciones, contrastes y límites. El [planteamiento inicial](docs/planteamiento-inicial.md) recoge los próximos pasos.

## Organización

- `main.py`: entrada de Streamlit.
- `ilargi/apparent.py`: geometría lunar aparente y observador superficial.
- `ilargi/ephemeris.py` y `ilargi/kernels.py`: infraestructura SPICE y kernels.
- `ilargi/terrain.py` y `data/terrain/`: consulta y muestra regional LOLA.
- `ilargi/ui/`: prototipo y visualizaciones.
- `tests/` y `docs/`: pruebas y evidencia.

El motor no depende de Streamlit. Streamlit y Plotly son herramientas de prototipado; se evaluarán tanto una interfaz web como una basada en Python cuando estén más claros los requisitos de visualización 3D y distribución.
