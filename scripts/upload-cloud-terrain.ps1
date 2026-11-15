param(
    [string]$ProjectId = 'ilargi-space-apps-2026',
    [string]$Region = 'europe-west1',
    [string]$Bucket = 'ilargi-space-apps-2026-terrain',
    [string]$TerrainDirectory = (Join-Path $HOME '.ilargi/terrain'),
    [string]$GcloudPath = 'gcloud'
)
$ErrorActionPreference = 'Stop'
function Invoke-Gcloud {
    & $GcloudPath @args
    if ($LASTEXITCODE -ne 0) { throw "gcloud failed: $($args[0])" }
}
$repoRoot = Split-Path $PSScriptRoot -Parent
$oldTerrain = $env:ILARGI_TERRAIN_DIR
Push-Location $repoRoot
try {
    # Reuse only size/SHA-256 verified products; download official sources if absent.
    $env:ILARGI_TERRAIN_DIR = $TerrainDirectory
    & uv run --locked python -m ilargi.download_terrain
    if ($LASTEXITCODE -ne 0) { throw 'Terrain verification/download failed.' }
    $cloudDem = Join-Path $repoRoot 'outputs/terrain/ldem_128_cog.tif'
    & uv run --locked python -m ilargi.build_cloud_terrain --source (Join-Path $TerrainDirectory 'ldem_128.vrt') --output $cloudDem
    if ($LASTEXITCODE -ne 0) { throw 'Lossless cloud DEM validation failed.' }
    $buckets = Invoke-Gcloud storage buckets list --project $ProjectId --format 'value(name)'
    if ($Bucket -notin $buckets) {
        Invoke-Gcloud storage buckets create "gs://$Bucket" --project $ProjectId --location $Region `
            --uniform-bucket-level-access --public-access-prevention
    }
    $files = @('LDEM_80S_80MPP_ADJ.TIF', 'ldem_128.img', 'ldem_128.vrt')
    # Include small local crops as well, preserving their original bytes.
    $paths = @($files | ForEach-Object { Join-Path $TerrainDirectory $_ })
    $paths += $cloudDem
    $paths += @(Get-ChildItem (Join-Path $repoRoot 'data/terrain') -Filter '*sample.tif' | ForEach-Object FullName)
    # gcloud validates transfer checksums. SHA-256 metadata records provenance.
    foreach ($path in $paths) {
        # Python's read-only opener also works while Rasterio uses the local cache on Windows.
        $hash = & uv run --locked python -c 'import sys; from pathlib import Path; from ilargi.download_terrain import digest; print(digest(Path(sys.argv[1])))' $path
        if ($LASTEXITCODE -ne 0) { throw "Hash verification failed: $path" }
        Invoke-Gcloud storage cp $path "gs://$Bucket/" --custom-metadata "sha256=$hash"
    }
    Invoke-Gcloud storage buckets add-iam-policy-binding "gs://$Bucket" `
        --member "serviceAccount:ilargi-runtime@$ProjectId.iam.gserviceaccount.com" `
        --role roles/storage.objectViewer --quiet
    Invoke-Gcloud storage ls --long "gs://$Bucket/"
} finally {
    $env:ILARGI_TERRAIN_DIR = $oldTerrain
    Pop-Location
}
