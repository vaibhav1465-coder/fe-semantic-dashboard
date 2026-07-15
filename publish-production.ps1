param(
  [string]$RepoUrl = "",
  [string]$Branch = "main",
  [string]$CommitMessage = "feat: make FE semantic linking data sources live"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "1/6 Running tests..." -ForegroundColor Cyan
npm test
npm run verify

Write-Host "2/6 Checking Git repository..." -ForegroundColor Cyan
if (-not (Test-Path ".git")) {
  git init
  git branch -M $Branch
}

$existingRemote = git remote get-url origin 2>$null
if (-not $existingRemote) {
  if (-not $RepoUrl) {
    throw "No Git remote is configured. Re-run with -RepoUrl followed by your GitHub repository URL."
  }
  git remote add origin $RepoUrl
}

Write-Host "3/6 Creating Git commit..." -ForegroundColor Cyan
git add .
$hasChanges = git status --porcelain
if ($hasChanges) {
  git commit -m $CommitMessage
} else {
  Write-Host "No new Git changes to commit." -ForegroundColor Yellow
}

Write-Host "4/6 Pushing to GitHub..." -ForegroundColor Cyan
git push -u origin $Branch

Write-Host "5/6 Installing Vercel CLI if required..." -ForegroundColor Cyan
$vercel = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercel) {
  npm install --global vercel
}

Write-Host "6/6 Deploying to Vercel production..." -ForegroundColor Cyan
vercel --prod --yes

Write-Host "Git push and Vercel production deployment completed." -ForegroundColor Green
