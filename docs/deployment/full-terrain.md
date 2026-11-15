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
