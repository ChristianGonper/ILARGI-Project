param(
    [string]$ProjectName = 'ilargi',
    [string]$Branch = 'deployment/jury-hybrid',
    [string]$ApiUrl = ''
)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$oldMode = $env:VITE_DATA_MODE
$oldApi = $env:VITE_API_BASE_URL
Push-Location $repoRoot
try {
    $env:VITE_DATA_MODE = if ($ApiUrl) { 'auto' } else { 'static' }
    $env:VITE_API_BASE_URL = $ApiUrl.TrimEnd('/')
    & npm --prefix web run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
    & npx --no-install wrangler pages deploy web/dist --project-name $ProjectName --branch $Branch
    if ($LASTEXITCODE -ne 0) { throw 'Cloudflare deployment failed.' }
} finally {
    $env:VITE_DATA_MODE = $oldMode
    $env:VITE_API_BASE_URL = $oldApi
    Pop-Location
}
