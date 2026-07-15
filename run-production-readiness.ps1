$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "Running strict live production readiness checks..." -ForegroundColor Cyan
npm run sources:test:strict
npm test
npm run verify
Write-Host "PASS: WordPress/RSS, Google NLP, cache, tests and production files are ready." -ForegroundColor Green
