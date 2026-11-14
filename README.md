# ILARGI

ILARGI explora las condiciones de iluminación y visibilidad desde emplazamientos lunares. Esta primera entrega permite explorar **las posiciones geométricas de los centros del Sol, la Tierra y la Luna** para un instante UTC, con dos vistas 3D, distancias y exportación CSV. El documento [NASA - Space Apps Info - Christian.md](NASA%20-%20Space%20Apps%20Info%20-%20Christian.md) recoge la visión completa provisional.

## Inicio

Se necesitan Python 3.13, [uv](https://docs.astral.sh/uv/) y conexión a internet para descargar los datos iniciales:

```powershell
uv sync
uv run python -m ilargi.kernels
uv run streamlit run main.py
```

Abre la dirección local que muestre Streamlit. Los kernels se descargan desde NAIF a `data/kernels/` y se comprueban con SHA-256; no se suben a Git. El comando puede repetirse para comprobarlos o restaurarlos. La primera descarga ocupa unos 45 MB. Para validar la instalación:

```powershell
uv run pytest -q
uv run ruff check .
```

`uv.lock` fija las dependencias. Las pruebas necesitan los kernels descargados. El entorno local `.venv` se genera automáticamente.

## Alcance y límites

Las posiciones son simultáneas y geométricas, en kilómetros, con ejes inerciales SPICE J2000 y efeméride DE440s. Los marcadores están ampliados; la separación entre cuerpos se representa a escala en cada vista. La tabla indica el origen y el CSV incorpora instante, origen, marco, corrección y efeméride. Para fechas futuras se usa la última tabla de segundos intercalares disponible; un nuevo segundo intercalar puede cambiar la conversión de UTC.

No se ha implementado todavía un observador sobre la Luna, ni posiciones aparentes, relieve LOLA, sombras, iluminación o visibilidad. El PCK y FK lunares descargados quedan preparados para trabajo posterior; no intervienen en las posiciones geométricas actuales. Los resultados no son una evaluación de seguridad ni de comunicaciones.

Consulta [la validación y los datos](docs/validacion-efemerides.md) y [el planteamiento inicial](docs/planteamiento-inicial.md) para convenciones, fuentes y próximos pasos.

## Organización del proyecto

- `main.py`: entrada mínima de Streamlit.
- `ilargi/ephemeris.py`: cálculo científico y convenciones de los vectores.
- `ilargi/kernels.py`: catálogo, descarga y verificación de kernels.
- `ilargi/ui/`: flujo de la interfaz y construcción separada de gráficos y tablas.
- `tests/`: comprobaciones científicas y de la interfaz.
- `docs/`: decisiones, plan y evidencia de validación.
- `data/kernels/`: datos locales reproducibles, excluidos de Git.

El motor no depende de Streamlit y puede reutilizarse en una API o en otras interfaces. Se ampliará por dominios según se incorporen el terreno, los observadores y los eventos.
