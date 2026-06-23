# EVAVO Outbound Agent (Cloudflare Worker)

This is the Worker-side runtime for the EVAVO Outbound Agent.

Patch 1 adds a free-safe control plane:
- Health, diagnostics, and schema inspection endpoints
- Free-safe cost guard settings and usage counters
- Tool capability discovery for future CLI / ChatGPT / Claude / Cursor use
- Compile-stability fixes for shared analysis/drafting types
- Non-destructive migration for budget tables and indexes

## Important production note

The remote D1 database already contains live data. Do **not** blindly re-run `schema.sql` against the remote database unless you are intentionally rebuilding a fresh database.

For the existing production D1, use migrations such as:

```bash
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0001_free_safe_core.sql
```

## Quick start

1) Install deps

```bash
npm i
```

2) Typecheck

```bash
npm run typecheck
```

3) Apply the free-safe migration to the remote D1 database

```bash
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0001_free_safe_core.sql
```

4) Deploy

```bash
npm run deploy
```

## Secrets

```bash
wrangler secret put ADMIN_TOKEN
wrangler secret put MAILCHANNELS_API_KEY   # optional, only required to send
wrangler secret put FROM_EMAIL             # optional
wrangler secret put REPLY_TO_EMAIL         # optional
wrangler secret put PUBLIC_BASE_URL        # optional, e.g. https://evavo.com.au
```

## Free-safe defaults

The Worker defaults toward conservative, low-cost behaviour:
- `cost_mode = free_safe`
- AI disabled unless explicitly enabled
- Sending disabled unless explicitly enabled
- Deep diagnostics require confirmation
- Budget counters are tracked in D1 once the migration is applied
- Existing draft backlog should be reviewed before large new scans

## Endpoints

Public:
- `GET /public/status`
- `GET /public/events?limit=18`

Admin, Bearer token required:
- `GET /admin/health`
- `GET /admin/diagnostics`
- `GET /admin/diagnostics?deep=1&confirm=1`
- `GET /admin/schema`
- `GET /admin/overview`
- `GET /admin/leads?status=new&limit=50`
- `POST /admin/leads` `{ "websiteUrl": "https://example.com" }`
- `GET /admin/drafts?status=queued&limit=50`
- `POST /admin/drafts/:id/approve`
- `POST /admin/drafts/:id/reject`
- `POST /admin/run` `{ "kind": "draft" | "send" | "scan" | "tick" | "backfill" }`
- `GET /admin/settings`
- `POST /admin/settings` `{ "settings": { "daily_external_fetch_limit": "100" } }`

Tools:
- `GET /tools/capabilities`

## Test commands

```powershell
$Base = "https://evavo-outbound-agent.evavo-studio.workers.dev"
$Token = "YOUR_ADMIN_TOKEN"

Invoke-RestMethod "$Base/admin/health" -Headers @{ Authorization = "Bearer $Token" } | ConvertTo-Json -Depth 20
Invoke-RestMethod "$Base/admin/diagnostics" -Headers @{ Authorization = "Bearer $Token" } | ConvertTo-Json -Depth 20
Invoke-RestMethod "$Base/admin/schema" -Headers @{ Authorization = "Bearer $Token" } | ConvertTo-Json -Depth 20
Invoke-RestMethod "$Base/tools/capabilities" | ConvertTo-Json -Depth 20
```

## Common gotchas

### D1 schema executed locally instead of remote

If you see output mentioning `.wrangler/state/...` and `local database`, you initialized the local dev DB.

For existing production, prefer explicit migration files:

```bash
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0001_free_safe_core.sql
```

### Updating secrets

To replace a secret value:

```bash
wrangler secret put ADMIN_TOKEN
```

To delete an optional secret:

```bash
wrangler secret delete MAILCHANNELS_API_KEY
```
