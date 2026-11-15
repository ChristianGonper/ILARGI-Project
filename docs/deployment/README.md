# Despliegue para el jurado

La web se publica en **Cloudflare Pages**, y la API científica en **Google Cloud Run**. La web incluye un catálogo de resultados reales precalculados: funciona sin Python, y utiliza ese catálogo cuando la API falla, tarda demasiado o está ocupada. El juego se ejecuta en el navegador.

## Estado y alcance

La web está publicada en **https://ilargi.pages.dev/** y la API en Google Cloud Run. El proyecto Pages usa Direct Upload con la sesión OAuth local. Los recursos y comandos concretos están en [live.md](live.md). La publicación automática requiere un token específico de Pages; no se necesitan claves dentro del frontend.

- Mission Analysis: los 11 puntos del catálogo, selección de varios puntos, gráficas, comparación, exportación CSV, globo y capas de materiales.
- Educación: 23 ubicaciones con sus ciclos, animación, vista Sol–Tierra–Luna, capa WEH y juego de aterrizaje. La interfaz agrupa algunos ejemplos polares del catálogo como ya hacía en local.
- Respaldo científico: inicio **2026-04-02 15:00 UTC**, análisis de **720 h**, pasos de **60 min**, instrumento a **2 m**, azimut **0,25°**, DEM `auto`; educación **709 h**, pasos de **180 min**.
- Las fechas, parámetros y coordenadas deben coincidir con el catálogo guardado. No se desplazan fechas ni se usa el punto más cercano. Una petición fuera del catálogo explica que necesita la API. «Load demo settings» compara el polo sur, Apollo 11 y Chang'e 4 en la cara oculta.
- El aviso de demo aparece centrado junto a la introducción cuando se han utilizado datos guardados; no hay aviso durante la conexión ni cuando funciona la API. «Try again» recarga la página y limpia resultados anteriores. Las fuentes se consultan desde el pie de página. El respaldo no garantiza acceso sin conexión a Internet: los archivos siguen alojados en Pages.

## 1. Publicar la web primero

El proyecto creado con Wrangler usa Direct Upload y no se puede convertir después a integración Git. Publicar con la sesión OAuth local (sin copiar tokens al repositorio):

```powershell
npm ci
npm --prefix web ci
./scripts/deploy-pages.ps1
# Cuando exista la API:
./scripts/deploy-pages.ps1 -ApiUrl https://TU_API.run.app
```

URL estable: https://ilargi.pages.dev/. La rama de producción del proyecto Pages es `deployment/jury-hybrid`; el script la utiliza también después de fusionar a main. No hace falta renombrarla, pues es una etiqueta de despliegue de Pages.

Para publicar automáticamente tras los checks de main, el workflow `deploy-pages.yml` necesita el secreto GitHub `CLOUDFLARE_API_TOKEN` (token específico con Account / Cloudflare Pages / Edit, limitado a esta cuenta), y la variable `CLOUDFLARE_ACCOUNT_ID`. La variable opcional `ILARGI_API_URL` activa la API; sin ella publica modo estático. Durante la migración, el job `publish-migration` publica el artefacto ya probado de esta rama tras los checks, cuando `ILARGI_DEPLOY_ENABLED=true`. No publica desde eventos de pull request. La sesión OAuth local no se copia a GitHub.

Alternativa con integración Git, **creando otro proyecto Pages**: conectar este repositorio desde **Cloudflare → Workers & Pages → Pages → Import an existing Git repository**. Crear el proyecto `ilargi` (o un nombre disponible):

| Configuración               | Valor                    |
| --------------------------- | ------------------------ |
| Rama de producción inicial  | `deployment/jury-hybrid` |
| Directorio raíz             | `web`                    |
| Comando                     | `npm run build`          |
| Salida                      | `dist`                   |
| Node                        | `22`                     |
| `VITE_DATA_MODE` inicial    | `static`                 |
| `VITE_API_BASE_URL` inicial | vacío                    |

Esto publica el MVP autónomo sin ejecutar Python en Cloudflare. El catálogo está versionado: el build solo necesita Node. Tras fusionar la PR, cambiar la rama de producción a `main`.

Para probar exactamente el mismo artefacto localmente:

```powershell
npm --prefix web ci
$env:VITE_DATA_MODE = 'static'
npm --prefix web run build
Remove-Item Env:VITE_DATA_MODE
npm --prefix web run preview
```

## 2. Publicar la API en Google Cloud

Instalar Google Cloud CLI, iniciar sesión con `gcloud auth login` y elegir un proyecto con facturación y créditos válidos. El script no pide ni guarda una clave JSON. La cuenta que despliega debe poder habilitar servicios, construir imágenes, crear la identidad de ejecución y desplegar Cloud Run; las políticas de la organización pueden impedir acceso público.

```powershell
./scripts/deploy-cloud-run.ps1 -ProjectId TU_PROYECTO -FrontendOrigin https://TU_WEB.pages.dev
```

El script habilita Cloud Run, Cloud Build y Artifact Registry; crea `ilargi-runtime` sin roles de proyecto y hace un build remoto del Dockerfile. No requiere Docker Desktop local. El contenedor ejecuta Python 3.13 como usuario sin privilegios, con dependencias bloqueadas en `uv.lock`. Descarga y verifica por SHA-256 los kernels en el build; no descarga datos al arrancar ni contiene credenciales. Comprueba los kernels al iniciar, escucha en `0.0.0.0:$PORT` y habilita CORS únicamente para el origen indicado.

Configuración inicial: **1 vCPU, 2 GiB, un worker, una petición concurrente por instancia, mínimo 0, máximo 2 instancias, timeout 120 s**. El motor también rechaza con 503 cálculos simultáneos dentro del mismo proceso, y limita el tamaño de los lotes. El frontend espera como máximo 8 s para catálogos y 25 s para cálculos antes de intentar el respaldo; el cálculo remoto puede seguir ejecutándose después de ese timeout.

El límite de instancias reduce la exposición al gasto, pero **no es un límite monetario**. Antes de publicar, configurar alertas de presupuesto en Google, comprobar vigencia y servicios cubiertos por los créditos, y revisar también costes de Cloud Build, Artifact Registry y tráfico. Los cold starts son aceptables porque existe el respaldo; mantener mínimo 0 fuera de una evaluación programada.

## 3. Conectar web y API

El script devuelve la URL `https://…run.app`. Publicar con `./scripts/deploy-pages.ps1 -ApiUrl https://…run.app`; para el workflow automático configurar la variable GitHub `ILARGI_API_URL`. Si se usa la integración Git alternativa de Cloudflare, configurar:

```text
VITE_DATA_MODE=auto
VITE_API_BASE_URL=https://…run.app
```

Volver a construir/desplegar Pages: las variables Vite se incorporan al build y son públicas. Si cambia el dominio del frontend, actualizar `ILARGI_CORS_ORIGINS` en Cloud Run. Las previews con otro dominio continuarán usando datos guardados hasta que se permita explícitamente ese origen. No usar un comodín CORS. CORS controla navegadores; la API es pública y no requiere un secreto compartido en JavaScript.

Para apagar el cálculo sin retirar la web, volver a `VITE_DATA_MODE=static`, reconstruir Pages y deshabilitar o eliminar el servicio Cloud Run desde el proyecto. No se eliminan recursos automáticamente con este trabajo.

## Datos, terreno y rigor científico

El contenedor incluye los recortes LOLA de 20 y 80 m del repositorio. El despliegue público accede además a los DEM completos mediante un bucket privado montado en solo lectura; véase [terreno completo](full-terrain.md). Donde falta cobertura el motor informa horizonte ideal o las limitaciones del recorte, tanto en resultados como en gráficas. El relieve visual del globo no sustituye al DEM científico. WEH indica hidrógeno equivalente, no hielo confirmado. Se mantiene un enlace visible a las atribuciones de [sources.md](../sources.md), que también se copia a la web.

El bucket `ilargi-space-apps-2026-terrain`, en `europe-west1`, conserva los productos originales y una copia global GeoTIFF optimizada y verificada sin pérdida. Cloud Run usa `/mnt/terrain`, `ILARGI_TERRAIN_DIR=/mnt/terrain` y permiso `roles/storage.objectViewer` **solo en ese bucket**. El script acepta `-TerrainBucket` para conservar esta configuración en futuros despliegues. No se descargan los DEM completos en cada arranque. Las instrucciones de subida, validación y reversión están en [terreno completo](full-terrain.md).

## Regeneración y validación

```powershell
uv sync --frozen
uv run python -m ilargi.kernels
uv run python -m ilargi.export_demo
uv run ruff check .
uv run ruff format --check .
uv run pytest -q
npm ci
npm --prefix web ci
npm --prefix web test
npm --prefix web run build
npx --prefix web playwright install chromium
npm --prefix web run test:e2e
```

El exportador usa el mismo motor y serializador que la API y fuerza los recortes versionados, independientemente de los DEM grandes instalados en el ordenador. El manifiesto incluye commit del motor, fecha de generación, parámetros, cobertura de terreno y hashes de kernels y respuestas. El JSON compacto se excluye de Prettier para conservar su integridad; pytest verifica hashes y cobertura. Regenerar cuando cambien el motor, sus datos o el contrato de respuestas. No editar JSON a mano.

GitHub Actions valida Python, TypeScript, pruebas del navegador con la API caída, integridad del catálogo y build/arranque del contenedor Linux con un cálculo SPICE real. El workflow de checks genera un artefacto descargable de `web/dist` sin secretos. El workflow separado de publicación espera los checks de main y utiliza el token de Pages. Mantener protegida main y exigir los checks de esta PR antes de fusionar.

## Comprobación de la URL pública antes de enviarla al jurado

1. Abrir ambas experiencias desde la URL Pages; ejecutar un análisis de tres puntos y abrir una gráfica y el CSV.
2. Reproducir un ciclo, cambiar ubicación y comenzar el juego; comprobar capas y atribuciones.
3. Con API conectada, pedir coordenadas y fechas fuera del catálogo y comprobar que se calculan.
4. Bloquear `/api/*` desde el navegador o deshabilitar temporalmente el servicio: comprobar el aviso, el catálogo y que una petición no guardada no reutiliza resultados anteriores.
5. Revisar logs, memoria máxima, tiempo de cálculo y facturación. La configuración de recursos es un punto de partida, no un benchmark de producción.

## Fuentes de despliegue consultadas

- [Cloudflare Pages: configuración de builds](https://developers.cloudflare.com/pages/configuration/build-configuration/).
- [Cloud Run: contrato del contenedor](https://docs.cloud.google.com/run/docs/container-contract).
- [Cloud Run: concurrencia](https://docs.cloud.google.com/run/docs/about-concurrency).
- [Cloud Run: límites de instancias](https://docs.cloud.google.com/run/docs/configuring/max-instances).
- [Cloud Run: montajes Cloud Storage y memoria](https://docs.cloud.google.com/run/docs/configuring/services/cloud-storage-volume-mounts).

La propuesta inicial de Hydrogen sirve de orientación. Se ha sustituido su configuración de dos workers y concurrencia 8 por una inicial más conservadora, y se aplaza el almacenamiento de DEM completos hasta medirlo. No se promete coste cero para los servicios de Google ni disponibilidad absoluta.
