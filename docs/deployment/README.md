# Despliegue para el jurado

La web se publica en **Cloudflare Pages**, y la API cientÃ­fica en **Google Cloud Run**. La web incluye un catÃ¡logo de resultados reales precalculados: funciona sin Python, y utiliza ese catÃ¡logo cuando la API falla, tarda demasiado o estÃ¡ ocupada. El juego se ejecuta en el navegador.

## Estado y alcance

La implementaciÃ³n y las pruebas estÃ¡n en la PR de migraciÃ³n. **TodavÃ­a no hay un despliegue pÃºblico ni recursos de Google creados.** Para publicar faltan el proyecto de Google con facturaciÃ³n/crÃ©ditos y la conexiÃ³n de Cloudflare con GitHub. No se necesitan claves dentro del frontend.

- Mission Analysis: los 11 puntos del catÃ¡logo, selecciÃ³n de varios puntos, grÃ¡ficas, comparaciÃ³n, exportaciÃ³n CSV, globo y capas de materiales.
- EducaciÃ³n: 23 ubicaciones con sus ciclos, animaciÃ³n, vista Solâ€“Tierraâ€“Luna, capa WEH y juego de aterrizaje. La interfaz agrupa algunos ejemplos polares del catÃ¡logo como ya hacÃ­a en local.
- Respaldo cientÃ­fico: inicio **2026-04-02 15:00 UTC**, anÃ¡lisis de **720 h**, pasos de **60 min**, instrumento a **2 m**, azimut **0,25Â°**, DEM `auto`; educaciÃ³n **709 h**, pasos de **180 min**.
- Las fechas, parÃ¡metros y coordenadas deben coincidir con el catÃ¡logo guardado. No se desplazan fechas ni se usa el punto mÃ¡s cercano. Una peticiÃ³n fuera del catÃ¡logo explica que necesita la API. Â«Load demo settingsÂ» prepara y analiza tres puntos del polo sur.
- El aviso permanece visible si se han utilizado datos guardados, incluso si despuÃ©s vuelve la API. Â«Reconnect APIÂ» recarga la pÃ¡gina y limpia resultados anteriores. El respaldo no garantiza acceso sin conexiÃ³n a Internet: los archivos siguen alojados en Pages.

## 1. Publicar la web primero

El proyecto creado con Wrangler usa Direct Upload y no se puede convertir después a integración Git. Publicar con la sesión OAuth local (sin copiar tokens al repositorio):

```powershell
npm ci
npm --prefix web ci
./scripts/deploy-pages.ps1
# Cuando exista la API:
./scripts/deploy-pages.ps1 -ApiUrl https://TU_API.run.app
```

URL estable: https://ilargi-jury.pages.dev/. La rama de producción del proyecto Pages es `deployment/jury-hybrid`; el script la utiliza también después de fusionar a main. No hace falta renombrarla, pues es una etiqueta de despliegue de Pages.

Para publicar automáticamente tras los checks de main, el workflow `deploy-pages.yml` necesita el secreto GitHub `CLOUDFLARE_API_TOKEN` (token específico con Account / Cloudflare Pages / Edit, limitado a esta cuenta), y la variable `CLOUDFLARE_ACCOUNT_ID`. La variable opcional `ILARGI_API_URL` activa la API; sin ella publica modo estático. El workflow también permite ejecución manual. La sesión OAuth local no se copia a GitHub.

Alternativa con integración Git, **creando otro proyecto Pages**: conectar este repositorio desde **Cloudflare â†’ Workers & Pages â†’ Pages â†’ Import an existing Git repository**. Crear el proyecto `ilargi` (o un nombre disponible):

| ConfiguraciÃ³n              | Valor                    |
| --------------------------- | ------------------------ |
| Rama de producciÃ³n inicial | `deployment/jury-hybrid` |
| Directorio raÃ­z            | `web`                    |
| Comando                     | `npm run build`          |
| Salida                      | `dist`                   |
| Node                        | `22`                     |
| `VITE_DATA_MODE` inicial    | `static`                 |
| `VITE_API_BASE_URL` inicial | vacÃ­o                   |

Esto publica el MVP autÃ³nomo sin ejecutar Python en Cloudflare. El catÃ¡logo estÃ¡ versionado: el build solo necesita Node. Tras fusionar la PR, cambiar la rama de producciÃ³n a `main`.

Para probar exactamente el mismo artefacto localmente:

```powershell
npm --prefix web ci
$env:VITE_DATA_MODE = 'static'
npm --prefix web run build
Remove-Item Env:VITE_DATA_MODE
npm --prefix web run preview
```

## 2. Publicar la API en Google Cloud

Instalar Google Cloud CLI, iniciar sesiÃ³n con `gcloud auth login` y elegir un proyecto con facturaciÃ³n y crÃ©ditos vÃ¡lidos. El script no pide ni guarda una clave JSON. La cuenta que despliega debe poder habilitar servicios, construir imÃ¡genes, crear la identidad de ejecuciÃ³n y desplegar Cloud Run; las polÃ­ticas de la organizaciÃ³n pueden impedir acceso pÃºblico.

```powershell
./scripts/deploy-cloud-run.ps1 -ProjectId TU_PROYECTO -FrontendOrigin https://TU_WEB.pages.dev
```

El script habilita Cloud Run, Cloud Build y Artifact Registry; crea `ilargi-runtime` sin roles de proyecto y hace un build remoto del Dockerfile. No requiere Docker Desktop local. El contenedor ejecuta Python 3.13 como usuario sin privilegios, con dependencias bloqueadas en `uv.lock`. Descarga y verifica por SHA-256 los kernels en el build; no descarga datos al arrancar ni contiene credenciales. Comprueba los kernels al iniciar, escucha en `0.0.0.0:$PORT` y habilita CORS Ãºnicamente para el origen indicado.

ConfiguraciÃ³n inicial: **1 vCPU, 2 GiB, un worker, una peticiÃ³n concurrente por instancia, mÃ­nimo 0, mÃ¡ximo 2 instancias, timeout 120 s**. El motor tambiÃ©n rechaza con 503 cÃ¡lculos simultÃ¡neos dentro del mismo proceso, y limita el tamaÃ±o de los lotes. El frontend espera como mÃ¡ximo 8 s para catÃ¡logos y 25 s para cÃ¡lculos antes de intentar el respaldo; el cÃ¡lculo remoto puede seguir ejecutÃ¡ndose despuÃ©s de ese timeout.

El lÃ­mite de instancias reduce la exposiciÃ³n al gasto, pero **no es un lÃ­mite monetario**. Antes de publicar, configurar alertas de presupuesto en Google, comprobar vigencia y servicios cubiertos por los crÃ©ditos, y revisar tambiÃ©n costes de Cloud Build, Artifact Registry y trÃ¡fico. Los cold starts son aceptables porque existe el respaldo; mantener mÃ­nimo 0 fuera de una evaluaciÃ³n programada.

## 3. Conectar web y API

El script devuelve la URL `https://â€¦run.app`. En Cloudflare configurar:

```text
VITE_DATA_MODE=auto
VITE_API_BASE_URL=https://â€¦run.app
```

Volver a construir/desplegar Pages: las variables Vite se incorporan al build y son pÃºblicas. Si cambia el dominio del frontend, actualizar `ILARGI_CORS_ORIGINS` en Cloud Run. Las previews con otro dominio continuarÃ¡n usando datos guardados hasta que se permita explÃ­citamente ese origen. No usar un comodÃ­n CORS. CORS controla navegadores; la API es pÃºblica y no requiere un secreto compartido en JavaScript.

Para apagar el cÃ¡lculo sin retirar la web, volver a `VITE_DATA_MODE=static`, reconstruir Pages y deshabilitar o eliminar el servicio Cloud Run desde el proyecto. No se eliminan recursos automÃ¡ticamente con este trabajo.

## Datos, terreno y rigor cientÃ­fico

El MVP incluye los recortes LOLA de 20 y 80 m del repositorio. **No incluye los DEM completos de 2,3 GB.** Donde falta cobertura el motor informa horizonte ideal o las limitaciones del recorte, tanto en resultados como en grÃ¡ficas. El relieve visual del globo no sustituye al DEM cientÃ­fico. WEH indica hidrÃ³geno equivalente, no hielo confirmado. Se mantiene un enlace visible a las atribuciones de [sources.md](../sources.md), que tambiÃ©n se copia a la web.

Para este trÃ¡fico y el MVP no hace falta un bucket de Google: aÃ±ade complejidad, latencia de lectura y consumo de memoria antes de demostrar la necesidad. Una siguiente ampliaciÃ³n puede almacenar los DEM completos en un bucket privado y montarlos en solo lectura en `/mnt/terrain`, con `ILARGI_TERRAIN_DIR=/mnt/terrain` y rol `roles/storage.objectViewer` de la identidad de ejecuciÃ³n **solo en ese bucket**. Copiar tambiÃ©n `ldem_128.vrt`, respetar nombres y tamaÃ±os esperados, registrar versiones y SHA-256 de los productos. Medir tiempos y memoria con rasterio antes de elegir FUSE frente a disco persistente en una VM; no descargar los 2,3 GB en cada arranque. Esta ampliaciÃ³n no estÃ¡ activada en el script.

## RegeneraciÃ³n y validaciÃ³n

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

El exportador usa el mismo motor y serializador que la API y fuerza los recortes versionados, independientemente de los DEM grandes instalados en el ordenador. El manifiesto incluye commit del motor, fecha de generaciÃ³n, parÃ¡metros, cobertura de terreno y hashes de kernels y respuestas. El JSON compacto se excluye de Prettier para conservar su integridad; pytest verifica hashes y cobertura. Regenerar cuando cambien el motor, sus datos o el contrato de respuestas. No editar JSON a mano.

GitHub Actions valida Python, TypeScript, pruebas del navegador con la API caÃ­da, integridad del catÃ¡logo y build/arranque del contenedor Linux con un cÃ¡lculo SPICE real. Genera un artefacto descargable de `web/dist`; no despliega ni usa secretos. La integraciÃ³n Git de Pages hace sus builds independientemente: mantener protegida la rama de producciÃ³n y exigir los checks de esta PR antes de fusionar.

## ComprobaciÃ³n de la URL pÃºblica antes de enviarla al jurado

1. Abrir ambas experiencias desde la URL Pages; ejecutar un anÃ¡lisis de tres puntos y abrir una grÃ¡fica y el CSV.
2. Reproducir un ciclo, cambiar ubicaciÃ³n y comenzar el juego; comprobar capas y atribuciones.
3. Con API conectada, pedir coordenadas y fechas fuera del catÃ¡logo y comprobar que se calculan.
4. Bloquear `/api/*` desde el navegador o deshabilitar temporalmente el servicio: comprobar el aviso, el catÃ¡logo y que una peticiÃ³n no guardada no reutiliza resultados anteriores.
5. Revisar logs, memoria mÃ¡xima, tiempo de cÃ¡lculo y facturaciÃ³n. La configuraciÃ³n de recursos es un punto de partida, no un benchmark de producciÃ³n.

## Fuentes de despliegue consultadas

- [Cloudflare Pages: configuraciÃ³n de builds](https://developers.cloudflare.com/pages/configuration/build-configuration/).
- [Cloud Run: contrato del contenedor](https://docs.cloud.google.com/run/docs/container-contract).
- [Cloud Run: concurrencia](https://docs.cloud.google.com/run/docs/about-concurrency).
- [Cloud Run: lÃ­mites de instancias](https://docs.cloud.google.com/run/docs/configuring/max-instances).
- [Cloud Run: montajes Cloud Storage y memoria](https://docs.cloud.google.com/run/docs/configuring/services/cloud-storage-volume-mounts).

La propuesta inicial de Hydrogen sirve de orientaciÃ³n. Se ha sustituido su configuraciÃ³n de dos workers y concurrencia 8 por una inicial mÃ¡s conservadora, y se aplaza el almacenamiento de DEM completos hasta medirlo. No se promete coste cero para los servicios de Google ni disponibilidad absoluta.
