param(
    [string]$ProjectPath = "",
    [string]$ServiceAccountJsonPath = ""
)

$ErrorActionPreference = "Stop"

if (-not $ProjectPath) {
    $ProjectPath = @(
        "D:\Projects\fe-semantic-dashboard",
        "D:\Backups - Codes & Files\fe-semantic-operational-v5"
    ) | Where-Object { Test-Path (Join-Path $_ "package.json") } | Select-Object -First 1
}

if (-not $ProjectPath -or -not (Test-Path (Join-Path $ProjectPath "package.json"))) {
    throw "FE Semantic project not found. Run again with -ProjectPath pointing to the folder containing package.json."
}

if (-not $ServiceAccountJsonPath) {
    $ServiceAccountJsonPath = Read-Host "Enter the full path of the NEW FE Semantic Google service-account JSON key"
}

$ServiceAccountJsonPath = $ServiceAccountJsonPath.Trim('"')
if (-not (Test-Path $ServiceAccountJsonPath)) {
    throw "Google service-account JSON file not found: $ServiceAccountJsonPath"
}

$raw = Get-Content -Raw -Path $ServiceAccountJsonPath
$credential = $raw | ConvertFrom-Json
if ($credential.type -ne "service_account" -or -not $credential.project_id -or -not $credential.client_email -or -not $credential.private_key) {
    throw "The selected file is not a complete Google service-account JSON key."
}

$compressed = $credential | ConvertTo-Json -Depth 20 -Compress
$envPath = Join-Path $ProjectPath ".env.local"
$lines = @()
if (Test-Path $envPath) {
    $lines = Get-Content $envPath | Where-Object { $_ -notmatch '^GOOGLE_SERVICE_ACCOUNT_JSON=' -and $_ -notmatch '^GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=' }
}
$lines += "GOOGLE_SERVICE_ACCOUNT_JSON=$compressed"
$lines += "GOOGLE_NLP_API_VERSION=v2"
$lines += "GOOGLE_NLP_ENTITY_MAX_CHARS=30000"
$lines | Set-Content -Path $envPath -Encoding UTF8

Write-Host ""
Write-Host "Local Google NLP configuration saved securely to:" -ForegroundColor Green
Write-Host $envPath
Write-Host ""
Write-Host "The key was not copied to Git and was not printed to the screen." -ForegroundColor Yellow
Write-Host "Restart the local server:" -ForegroundColor Cyan
Write-Host "cd `"$ProjectPath`""
Write-Host "npm run dev"
