# EVAVO Outbound Agent (Cloudflare Worker)

This is the Worker-side runtime for the EVAVO Outbound Agent.

Patch 1 adds a free-safe control plane:
- Health, diagnostics, and schema inspection endpoints
- Free-safe cost guard settings and usage counters
- Tool capability discovery for future CLI / ChatGPT / Claude / Cursor use
- Compile-stability fixes for shared analysis/drafting types
- Non-destructive migration for budget tables and indexes

Patch 2 adds draft-review learning:
- `draft_reviews` audit table
- `strategy_scores` learning table
- Review decisions for approved/rejected/needs-rewrite/good-fit/bad-fit style feedback
- Authenticated admin routes for draft review and strategy score inspection

## Important production note

The remote D1 database already contains live data. Do **not** blindly re-run `schema.sql` against the remote database unless you are intentionally rebuilding a fresh database.

For the existing production D1, use migrations such as:

```bash
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0001_free_safe_core.sql
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0002_draft_review_learning.sql
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

3) Apply migrations to the remote D1 database

```bash
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0001_free_safe_core.sql
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0002_draft_review_learning.sql
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
- `POST /admin/draft-review/:id` `{ "decision": "approved", "reason": "good_fit", "notes": "..." }`
- `GET /admin/strategy-scores?limit=50`
- `POST /admin/run` `{ "kind": "draft" | "send" | "scan" | "tick" | "backfill" }`
- `GET /admin/settings`
- `POST /admin/settings` `{ "settings": { "daily_external_fetch_limit": "100" } }`

Tools:
- `GET /tools/capabilities`

## Draft review decisions

Supported review decisions:
- `approved`
- `rejected`
- `needs_rewrite`
- `too_generic`
- `wrong_angle`
- `bad_fit`
- `bad_contact`
- `good_angle`
- `good_fit`
- `do_not_contact`

## Test commands

```powershell
$Base = "https://evavo-outbound-agent.evavo-studio.workers.dev"
$Token = "YOUR_ADMIN_TOKEN"

Invoke-RestMethod "$Base/admin/health" -Headers @{ Authorization = "Bearer $Token" } | ConvertTo-Json -Depth 20
Invoke-RestMethod "$Base/admin/diagnostics" -Headers @{ Authorization = "Bearer $Token" } | ConvertTo-Json -Depth 20
Invoke-RestMethod "$Base/admin/schema" -Headers @{ Authorization = "Bearer $Token" } | ConvertTo-Json -Depth 20
Invoke-RestMethod "$Base/tools/capabilities" | ConvertTo-Json -Depth 20
Invoke-RestMethod "$Base/admin/strategy-scores" -Headers @{ Authorization = "Bearer $Token" } | ConvertTo-Json -Depth 20
```

Draft review example:

```powershell
$DraftId = "DRAFT_ID_HERE"
$Body = @{ decision = "needs_rewrite"; reason = "too_generic"; notes = "Make this more specific and grounded." } | ConvertTo-Json
Invoke-RestMethod "$Base/admin/draft-review/$DraftId" -Method POST -Headers @{ Authorization = "Bearer $Token"; "Content-Type" = "application/json" } -Body $Body | ConvertTo-Json -Depth 20
```

## Common gotchas

### D1 schema executed locally instead of remote

If you see output mentioning `.wrangler/state/...` and `local database`, you initialized the local dev DB.

For existing production, prefer explicit migration files:

```bash
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0001_free_safe_core.sql
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0002_draft_review_learning.sql
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
