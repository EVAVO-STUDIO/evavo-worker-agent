param(
  [string]$Base = "https://evavo-outbound-agent.evavo-studio.workers.dev",
  [string]$Token = "Pongoman",
  [string]$SeedFile = ".\seeds\au_source_seeds.json"
)

$ErrorActionPreference = "Stop"
$Headers = @{ Authorization = "Bearer $Token" }

if (!(Test-Path $SeedFile)) {
  throw "Seed file not found: $SeedFile"
}

$payload = Get-Content $SeedFile -Raw
Write-Host "Seeding AU sources..." -ForegroundColor Cyan
Invoke-RestMethod "$Base/admin/seeds" -Method POST -ContentType "application/json" -Headers $Headers -Body $payload
Write-Host "Seed request complete." -ForegroundColor Green
