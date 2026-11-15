# Estado del despliegue

Actualizado: 15 de noviembre de 2026.

- Web del jurado: https://ilargi.pages.dev/.
- Proyecto Cloudflare Pages: `ilargi`, Direct Upload, rama de producción `deployment/jury-hybrid`.
- Proyecto Google Cloud: `ilargi-space-apps-2026`.
- API: https://ilargi-api-l4mfoqterq-ew.a.run.app.
- Servicio Cloud Run: `ilargi-api`, región `europe-west1`.
- Identidad de ejecución: `ilargi-runtime`, sin roles de proyecto.
- Recursos: 1 vCPU, 2 GiB, mínimo 0, máximo 2 instancias, concurrencia HTTP 4, un worker; el bloqueo de la API limita a un cálculo científico por proceso. Plazos: 150 s en el navegador para cálculos, 30 s para metadatos y 180 s en Cloud Run.
- Datos: kernels NAIF verificados por SHA-256, materiales LP-GRS/WEH y recortes LOLA versionados. Los DEM completos y su VRT están en el bucket privado `ilargi-space-apps-2026-terrain` (`europe-west1`), montado en solo lectura en `/mnt/terrain`; véase [terreno completo](full-terrain.md).
- Alertas: presupuesto mensual de 5 EUR filtrado a este proyecto, excluyendo los créditos del cálculo del consumo; umbrales 50 %, 90 % y 100 %, destinatarios de facturación por defecto. No es un límite de gasto.

Las variables GitHub `CLOUDFLARE_ACCOUNT_ID`, `ILARGI_API_URL` e `ILARGI_DEPLOY_ENABLED` y el secreto `CLOUDFLARE_API_TOKEN` están configurados. La rama de migración publica después de pasar los checks; tras fusionar, main usa el workflow de publicación. Las credenciales OAuth del ordenador no se copian al repositorio ni a GitHub.

Publicar una actualización del frontend con la sesión local:

```powershell
./scripts/deploy-pages.ps1 -ApiUrl https://ilargi-api-l4mfoqterq-ew.a.run.app
```

Actualizar la API con Google Cloud CLI autenticado:

```powershell
./scripts/deploy-cloud-run.ps1 -ProjectId ilargi-space-apps-2026 -FrontendOrigin https://ilargi.pages.dev -AdditionalFrontendOrigins https://ilargi-jury.pages.dev -TerrainBucket ilargi-space-apps-2026-terrain
```

La API es pública y usa CORS explícito para la web estable. Las previews con otros orígenes muestran el respaldo. Para servir únicamente los datos guardados, publicar con `./scripts/deploy-pages.ps1` sin `ApiUrl`. Las instrucciones, parámetros del catálogo y comprobaciones están en [README.md](README.md).

La dirección anterior `https://ilargi-jury.pages.dev/` se conserva disponible y también está permitida en CORS; las nuevas publicaciones van al proyecto `ilargi`.
