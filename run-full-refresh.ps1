$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Import-EnvFile([string]$Path) {
  if (-not (Test-Path $Path)) { return }
  Write-Host "Loading server-side settings from $Path" -ForegroundColor DarkGray
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) { return }
    $name, $value = $line.Split("=", 2)
    $name = $name.Trim()
    $value = $value.Trim().Trim('"').Trim("'")
    if ($name) { [Environment]::SetEnvironmentVariable($name, $value, "Process") }
  }
}

Import-EnvFile ".env.local"
Import-EnvFile ".env"

if (-not (Test-Path ".\input\recommendations.json") -and -not (Test-Path ".\input\recommendations.csv")) {
  Write-Host "No local FE data file found. Importing the current live dashboard automatically..." -ForegroundColor Yellow
  npm run import-live
}

Write-Host "1/5 Testing WordPress REST, RSS, cache and Google NLP configuration..." -ForegroundColor Cyan
npm run sources:test

Write-Host "2/5 Processing FE recommendations through WordPress REST -> RSS -> HTML -> cache..." -ForegroundColor Cyan
npm run refresh

Write-Host "3/5 Running automated tests..." -ForegroundColor Cyan
npm test

Write-Host "4/5 Verifying production files and secret safety..." -ForegroundColor Cyan
npm run verify

Write-Host "5/5 Complete." -ForegroundColor Cyan
Write-Host "Operational refresh completed successfully." -ForegroundColor Green
Write-Host "For a strict production gate, run: npm run self-check" -ForegroundColor Yellow
