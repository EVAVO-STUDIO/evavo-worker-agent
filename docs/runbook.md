# Runbook

## 1) From the worker repo
```powershell
cd C:\Gitrepos\evavo-worker-agent
```

## 2) Run cleanup
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-cleanup.ps1
```

## 3) Seed better AU source pages
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\seed-sources.ps1
```

## 4) Test the pipeline
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test-outbound.ps1
```

## What good looks like
- marketplace junk stops appearing as new leads
- source pages remain as source pages only
- real target leads are AU/NZ business domains
- scan output shows a non-zero candidate flow after reseeding
- draft stays selective rather than mass templating
