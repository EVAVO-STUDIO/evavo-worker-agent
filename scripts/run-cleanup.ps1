$ErrorActionPreference = "Stop"

Write-Host "Running D1 cleanup..." -ForegroundColor Cyan
npx wrangler d1 execute evavo_outbound_agent --remote --file=.\sql\cleanup_marketplace_leads.sql
npx wrangler d1 execute evavo_outbound_agent --remote --file=.\sql\cleanup_source_pages.sql
Write-Host "Cleanup complete." -ForegroundColor Green
