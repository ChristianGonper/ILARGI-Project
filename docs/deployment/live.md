# Estado del despliegue

Actualizado: 15 de noviembre de 2026.

- Web del jurado: https://ilargi-jury.pages.dev/.
- Proyecto Cloudflare Pages: `ilargi-jury`, Direct Upload, rama de producción `deployment/jury-hybrid`.
- Proyecto Google Cloud: `ilargi-space-apps-2026`.
- API: https://ilargi-api-l4mfoqterq-ew.a.run.app.
- Servicio Cloud Run: `ilargi-api`, región `europe-west1`.
- Identidad de ejecución: `ilargi-runtime`, sin roles de proyecto.
- Recursos: 1 vCPU, 2 GiB, mínimo 0, máximo 2 instancias, concurrencia 1, un worker.
- Datos: kernels NAIF verificados por SHA-256, materiales LP-GRS/WEH y recortes LOLA versionados; no se ha creado un bucket para DEM completos.
- Alertas: presupuesto mensual de 5 EUR filtrado a este proyecto, excluyendo los créditos del cálculo del consumo; umbrales 50 %, 90 % y 100 %, destinatarios de facturación por defecto. No es un límite de gasto.

Las variables GitHub `CLOUDFLARE_ACCOUNT_ID`, `ILARGI_API_URL` e `ILARGI_DEPLOY_ENABLED` y el secreto `CLOUDFLARE_API_TOKEN` están configurados. La rama de migración publica después de pasar los checks; tras fusionar, main usa el workflow de publicación. Las credenciales OAuth del ordenador no se copian al repositorio ni a GitHub.

Publicar una actualización del frontend con la sesión local:

```powershell
./scripts/deploy-pages.ps1 -ApiUrl https://ilargi-api-l4mfoqterq-ew.a.run.app
```

Actualizar la API con Google Cloud CLI autenticado:

```powershell
./scripts/deploy-cloud-run.ps1 -ProjectId ilargi-space-apps-2026 -FrontendOrigin https://ilargi-jury.pages.dev
```

La API es pública y usa CORS explícito para la web estable. Las previews con otros orígenes muestran el respaldo. Para servir únicamente los datos guardados, publicar con `./scripts/deploy-pages.ps1` sin `ApiUrl`. Las instrucciones, parámetros del catálogo y comprobaciones están en [README.md](README.md).
