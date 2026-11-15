param(
    [Parameter(Mandatory)][ValidatePattern('^[a-z][a-z0-9-]{4,61}[a-z0-9]$')][string]$ProjectId,
    [Parameter(Mandatory)][string]$FrontendOrigin,
    [string]$Region = 'europe-west1',
    [string]$Service = 'ilargi-api'
)
$ErrorActionPreference = 'Stop'
$origin = [uri]$FrontendOrigin
if ($origin.Scheme -ne 'https' -or $origin.AbsolutePath -ne '/' -or $origin.Query -or $origin.Fragment) {
    throw 'FrontendOrigin must be an HTTPS origin, e.g. https://ilargi.pages.dev'
}
$FrontendOrigin = $origin.GetLeftPart([System.UriPartial]::Authority)
$repoRoot = Split-Path $PSScriptRoot -Parent
$gcloudCommand = (Get-Command gcloud -ErrorAction SilentlyContinue).Source
if (-not $gcloudCommand) {
    $gcloudCommand = Join-Path $repoRoot 'outputs/tools/google-cloud-sdk/bin/gcloud.cmd'
    if (-not (Test-Path -LiteralPath $gcloudCommand)) { throw 'Install Google Cloud CLI and run gcloud auth login first.' }
}
function Invoke-Gcloud {
    & $gcloudCommand @args
    if ($LASTEXITCODE -ne 0) { throw "gcloud failed: $($args[0])" }
}
Push-Location $repoRoot
try {
    Invoke-Gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project $ProjectId
    $serviceAccount = "ilargi-runtime@$ProjectId.iam.gserviceaccount.com"
    $existing = Invoke-Gcloud iam service-accounts list --project $ProjectId --filter "email=$serviceAccount" --format 'value(email)'
    if (-not $existing) {
        Invoke-Gcloud iam service-accounts create ilargi-runtime --display-name 'ILARGI runtime (no project roles)' --project $ProjectId
    }
    # Source deploy builds the Dockerfile remotely; Docker Desktop is not required.
    Invoke-Gcloud run deploy $Service --source . --project $ProjectId --region $Region `
        --allow-unauthenticated --service-account $serviceAccount --port 8080 `
        --cpu 1 --memory 2Gi --concurrency 1 --min 0 --max 2 --timeout 120 `
        --set-env-vars "ILARGI_CORS_ORIGINS=$FrontendOrigin" --quiet
    $apiUrl = Invoke-Gcloud run services describe $Service --project $ProjectId --region $Region --format 'value(status.url)'
    Invoke-RestMethod "$apiUrl/api/health"
    Write-Output "Set VITE_API_BASE_URL=$apiUrl in Cloudflare Pages and rebuild the frontend."
} finally {
    Pop-Location
}
