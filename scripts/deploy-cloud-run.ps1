param(
    [Parameter(Mandatory)][ValidatePattern('^[a-z][a-z0-9-]{4,61}[a-z0-9]$')][string]$ProjectId,
    [Parameter(Mandatory)][string]$FrontendOrigin,
    [string]$Region = 'europe-west1',
    [string]$Service = 'ilargi-api',
    [string]$TerrainBucket = '',
    [string]$GcloudPath = '',
    [switch]$NoTraffic,
    [string]$RevisionTag = '',
    [string[]]$AdditionalFrontendOrigins = @()
)
$ErrorActionPreference = 'Stop'
$origin = [uri]$FrontendOrigin
if ($origin.Scheme -ne 'https' -or $origin.AbsolutePath -ne '/' -or $origin.Query -or $origin.Fragment) {
    throw 'FrontendOrigin must be an HTTPS origin, e.g. https://ilargi.pages.dev'
}
$FrontendOrigin = $origin.GetLeftPart([System.UriPartial]::Authority)
if ($NoTraffic -and -not $RevisionTag) { throw 'NoTraffic requires RevisionTag to verify the candidate URL.' }
$allowedOrigins = @($FrontendOrigin)
foreach ($additional in $AdditionalFrontendOrigins) {
    $uri = [uri]$additional
    if ($uri.Scheme -ne 'https' -or $uri.AbsolutePath -ne '/' -or $uri.Query -or $uri.Fragment) {
        throw 'AdditionalFrontendOrigins must contain HTTPS origins.'
    }
    $allowedOrigins += $uri.GetLeftPart([System.UriPartial]::Authority)
}
$repoRoot = Split-Path $PSScriptRoot -Parent
$gcloudCommand = if ($GcloudPath) { $GcloudPath } else { (Get-Command gcloud -ErrorAction SilentlyContinue).Source }
if (-not $gcloudCommand) {
    $gcloudCommand = Join-Path $repoRoot 'outputs/tools/google-cloud-sdk/bin/gcloud.cmd'
    if (-not (Test-Path -LiteralPath $gcloudCommand)) { throw 'Install Google Cloud CLI and run gcloud auth login first.' }
}
function Invoke-Gcloud {
    & $gcloudCommand @args
    if ($LASTEXITCODE -ne 0) { throw "gcloud failed: $($args[0])" }
}
Push-Location $repoRoot
$envFile = [System.IO.Path]::GetTempFileName()
try {
    Invoke-Gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project $ProjectId
    $serviceAccount = "ilargi-runtime@$ProjectId.iam.gserviceaccount.com"
    $existing = Invoke-Gcloud iam service-accounts list --project $ProjectId --filter "email=$serviceAccount" --format 'value(email)'
    if (-not $existing) {
        Invoke-Gcloud iam service-accounts create ilargi-runtime --display-name 'ILARGI runtime (no project roles)' --project $ProjectId
    }
    # Source deploy builds the Dockerfile remotely; Docker Desktop is not required.
    $terrainArgs = @()
    if ($TerrainBucket) {
        $terrainArgs = @('--execution-environment', 'gen2', '--add-volume',
            "name=terrain,type=cloud-storage,bucket=$TerrainBucket,readonly=true,mount-options=file-cache-max-size-mb=0",
            '--add-volume-mount', 'volume=terrain,mount-path=/mnt/terrain')
    }
    # A JSON/YAML file preserves the CORS commas through Windows .cmd wrappers.
    $envVars = @{ ILARGI_CORS_ORIGINS = ($allowedOrigins -join ',') }
    if ($TerrainBucket) { $envVars.ILARGI_TERRAIN_DIR = '/mnt/terrain' }
    $envVars | ConvertTo-Json | Set-Content -LiteralPath $envFile -Encoding utf8
    $revisionArgs = @()
    if ($NoTraffic) { $revisionArgs += '--no-traffic' }
    if ($RevisionTag) { $revisionArgs += @('--tag', $RevisionTag) }
    Invoke-Gcloud run deploy $Service --source . --project $ProjectId --region $Region `
        --allow-unauthenticated --service-account $serviceAccount --port 8080 `
        --cpu 1 --memory 2Gi --concurrency 4 --min 0 --max 2 --timeout 180 `
        --env-vars-file $envFile @terrainArgs @revisionArgs --quiet
    $state = (Invoke-Gcloud run services describe $Service --project $ProjectId --region $Region --format json) | ConvertFrom-Json
    $apiUrl = $state.status.url
    $checkUrl = if ($NoTraffic) { ($state.status.traffic | Where-Object tag -eq $RevisionTag | Select-Object -First 1).url } else { $apiUrl }
    if (-not $checkUrl) { throw 'Candidate revision URL is missing.' }
    $health = Invoke-RestMethod "$checkUrl/api/health"
    if ($TerrainBucket -and (-not $health.dem.polar_80m -or -not $health.dem.global_240m)) {
        throw 'The revision cannot see the mounted full DEMs.'
    }
    $health
    Write-Output "Set VITE_API_BASE_URL=$apiUrl in Cloudflare Pages and rebuild the frontend."
} finally {
    Remove-Item -LiteralPath $envFile -ErrorAction SilentlyContinue
    Pop-Location
}
