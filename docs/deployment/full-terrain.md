# Full LOLA terrain in Cloud Run

The browser sends analysis parameters to the Python API; SPICE, terrain horizons,
visibility, and materials calculations run in Cloud Run. Scientific DEMs stay on
the backend. The browser's reduced, approximately 3.8 km visualization DEM remains
a separate static asset with physical-scale relief and adaptive subdivision.

## Retained comparison

At 89.5 degrees south, 0 degrees east, starting 2026-04-02 15:00 UTC for
720 hours with 60-minute samples, a 2 m instrument and 0.25-degree azimuth steps:

- Full local DEMs: no truncated azimuths, 0% sampled center Sun visibility.
- Deployed crops: 1,440/1,440 truncated azimuths, 12.3840845% Sun visibility.
- Local API restricted to the deployed crops reproduces the online result.

The missing full DEMs explain this difference; matching terrain coverage does not
by itself establish sampling convergence or a general scientific accuracy bound.

## Deployment requirements

Store verified official LOLA products and their companion VRT in a private,
regional Cloud Storage bucket. Mount the bucket read-only at `/mnt/terrain`, with
`ILARGI_TERRAIN_DIR=/mnt/terrain`. Grant the service identity
`roles/storage.objectViewer` only on that bucket. Keep the bundled crops,
LP-GRS/WEH and verified NAIF kernels in the container.

Validate a revision without production traffic before promotion: compare API
results against the same local requests, measure cold/warm latency and memory,
and verify browser requests and visual terrain. Bound caching because FUSE caches
consume container memory. Retain the previous revision for rollback.

Reference: [Cloud Run Cloud Storage volume mounts](https://docs.cloud.google.com/run/docs/configuring/services/cloud-storage-volume-mounts).

## Commands

Run from the repository root with authenticated Google Cloud CLI. `-GcloudPath`
may select a CLI installation outside PATH.

```powershell
./scripts/upload-cloud-terrain.ps1
./scripts/deploy-cloud-run.ps1 -ProjectId ilargi-space-apps-2026 -FrontendOrigin https://ilargi.pages.dev -AdditionalFrontendOrigins https://ilargi-jury.pages.dev -TerrainBucket ilargi-space-apps-2026-terrain -NoTraffic -RevisionTag terrain-check
uv run python -m scripts.validate_cloud_terrain --api-url https://YOUR-REVISION.run.app --output outputs/terrain-validation.json
./scripts/deploy-pages.ps1 -ApiUrl https://ilargi-api-l4mfoqterq-ew.a.run.app
```

The upload script verifies official size and SHA-256 via the existing downloader,
uploads the original polar/global products, companion VRT and both local crops,
records SHA-256 metadata, and uses checksum-validated transfers. Missing full DEMs
are fetched from the pinned NASA/PGDA/PDS sources. Kernels, LP-GRS and WEH already
ship with the API; browser terrain, imagery and WEH overlays ship with Pages.

The global product also has a lossless Cloud Optimized GeoTIFF derivative,
`ldem_128_cog.tif`, preferred when present. The builder verifies every source
pixel plus CRS, transform, units, scale, offset, dtype and nodata before installing
the derivative. No resampling or overviews are used. Tiled DEFLATE compression
reduces remote reads of the raw IMG's single-row strips. Both original products
remain in the bucket for provenance and compatibility.

File-content caching is disabled for the mount to avoid keeping a 2.1 GB object
in the service's 2 GiB memory allowance. Metadata caching and GDAL's bounded
128 MB cache remain available. Reads use file offsets; no complete DEM download
is performed at startup or in the browser. The frontend allows 150 seconds for
calculations; the service deadline is 180 seconds. Lightweight requests retain
their own 30-second timeout and saved-data fallback. Cloud Run accepts four
concurrent HTTP requests so startup metadata requests can share an instance;
the existing API calculation lock still permits only one scientific calculation
per process. This avoids unnecessary cold starts and 8-second metadata timeouts
when health, catalog and material requests arrive together.

## Verified deployment, 15 November 2026

- Original files: 2,317,040,579 bytes across the polar/global DEMs, VRT and two crops.
- Optimized global file: 1,035,298,341 bytes, SHA-256
  `0266debc570b695f6b36d14aa560dc813ac6d4becb779e298b288c7931a43619`.
- Center of the polar crop, Malapert and Apollo 11: all 1,440 horizon elevations
  and coverage distances match the local original DEMs to 1e-8; visibility
  metrics match to 1e-6. All three have zero truncated azimuths.
- Initial requests with the optimized revision: 10.448 s, 4.631 s and 3.408 s.
  The first request includes instance startup. The original raw global file took
  37.474 s for Apollo 11 in an earlier run; these are illustrative measurements,
  not controlled latency guarantees.
- A maximum-size batch of ten points (polar center, Malapert and Apollo 11,
  repeated) returned ten terrain results without truncation in 47.470 s.
- Education at the polar center returned 238 frames in 0.820 s.
- Cloud Monitoring's available periodic memory samples for the raw-file revision
  were below 19% of 2 GiB; the first optimized-revision samples were below 13%.
  Periodic samples do not establish the instantaneous peak. No warning/error logs
  were reported during the initial revision checks.
- The published browser's visualization DEM is 7,619,266 bytes and matches the
  packaged SHA-256 `3d958b40ec8c9e37387d14c5fc9f249b5c80805a88f2c0200e2d178b29e1853b`.
  Terrain loads rather than using the textured-sphere fallback; existing tests
  verify physical displacement, mesh refinement on zoom and gzip decoding.

The production baseline before this work was `ilargi-api-00002-hsk` (crops only).
`ilargi-api-00003-paw` adds full raw DEMs and is also retained as a fallback.
Rollback changes traffic only; do not delete the bucket or overwrite terrain
objects during an active analysis. List revisions and explicitly route traffic
to the chosen revision using `gcloud run services update-traffic`.
