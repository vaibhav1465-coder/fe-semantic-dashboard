param(
  [string]$ProjectPath = "D:\Projects\fe-semantic-dashboard",
  [string]$PackageZip = "$env:USERPROFILE\Downloads\fe-semantic-operational-v5.zip",
  [string]$VercelProject = "fe-semantic-interlinking"
)

$ErrorActionPreference = "Stop"

function Step([string]$Text) {
  Write-Host "`n$Text" -ForegroundColor Cyan
}

Step "1/9 Checking the release package"
if (-not (Test-Path $PackageZip)) {
  $candidate = Get-ChildItem "$env:USERPROFILE\Downloads\fe-semantic-operational-v5*.zip" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if ($candidate) { $PackageZip = $candidate.FullName }
}
if (-not (Test-Path $PackageZip)) { throw "Release ZIP not found in Downloads." }

Step "2/9 Checking the existing FE Semantic project"
if (-not (Test-Path $ProjectPath)) {
  New-Item -ItemType Directory -Path $ProjectPath -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = "D:\FE-Semantic-Backups"
$backupPath = Join-Path $backupRoot "fe-semantic-before-v5-$timestamp"
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null

Step "3/9 Creating a safe backup"
robocopy $ProjectPath $backupPath /E /R:2 /W:1 /XD node_modules .next dist build /XF *.log | Out-Null
if ($LASTEXITCODE -gt 7) { throw "Backup failed with Robocopy exit code $LASTEXITCODE." }

Step "4/9 Extracting and installing version 5"
$temp = Join-Path $env:TEMP "fe-semantic-v5-$timestamp"
if (Test-Path $temp) { Remove-Item $temp -Recurse -Force }
Expand-Archive -Path $PackageZip -DestinationPath $temp -Force

# Preserve Git/Vercel links and all environment files already present in the project.
robocopy $temp $ProjectPath /E /R:2 /W:1 /XD .git .vercel node_modules /XF .env .env.local .env.production .env.development *.log | Out-Null
if ($LASTEXITCODE -gt 7) { throw "Release installation failed with Robocopy exit code $LASTEXITCODE." }
Set-Location $ProjectPath

Step "5/9 Running all automated checks"
npm test
npm run verify

Step "6/9 Checking Git authentication and repository"
if (-not (Test-Path ".git")) {
  throw "This folder is not linked to Git. Clone the existing repository into $ProjectPath first so its remote and history are preserved."
}
$remote = git remote get-url origin
if (-not $remote) { throw "Git origin remote is missing." }
$branch = git branch --show-current
if (-not $branch) { $branch = "master" }

Step "7/9 Committing and pushing to GitHub"
git add .
$changes = git status --porcelain
if ($changes) {
  git commit -m "feat: add live Google NLP and source fallback provenance"
  git push origin $branch
} else {
  Write-Host "No Git changes detected." -ForegroundColor Yellow
}

Step "8/9 Checking Vercel CLI and project link"
if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
  npm install --global vercel
}
if (-not (Test-Path ".vercel\project.json")) {
  vercel link --yes --project $VercelProject
}

$envList = vercel env ls 2>&1 | Out-String
$googleConfigured = $envList -match "GOOGLE_SERVICE_ACCOUNT_JSON" -or $envList -match "GOOGLE_SERVICE_ACCOUNT_JSON_BASE64"
if (-not $googleConfigured) {
  throw "Google NLP environment variable is missing in Vercel. Add GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 before production deployment."
}
if ($envList -notmatch "CRON_SECRET") {
  throw "CRON_SECRET is missing in Vercel. Add it before production deployment."
}

Step "9/9 Deploying to Vercel production and running live checks"
$deployOutput = vercel --prod --yes 2>&1 | Tee-Object -Variable deploymentLog
$productionUrl = ($deploymentLog | Select-String -Pattern "https://[^\s]+" | Select-Object -Last 1).Matches.Value
if (-not $productionUrl) { $productionUrl = "https://fe-semantic-interlinking.vercel.app" }

Start-Sleep -Seconds 5
$health = Invoke-RestMethod "$productionUrl/api/health" -TimeoutSec 60
$provenance = Invoke-RestMethod "$productionUrl/api/provenance?live=1" -TimeoutSec 90
$selfTest = Invoke-RestMethod "$productionUrl/api/self-test?live=1" -TimeoutSec 120

if ($health.status -ne "healthy") { throw "Production health check failed." }
if ($selfTest.status -eq "fail") { throw "Production live self-test failed." }

Write-Host "`nProduction deployment completed." -ForegroundColor Green
Write-Host "URL: $productionUrl" -ForegroundColor Green
Write-Host "Article source: $($provenance.article_source.label)" -ForegroundColor Green
Write-Host "Entity source: $($provenance.entity_source.label)" -ForegroundColor Green
Write-Host "Sentiment source: $($provenance.sentiment_source.label)" -ForegroundColor Green
Write-Host "Backup: $backupPath" -ForegroundColor Yellow
