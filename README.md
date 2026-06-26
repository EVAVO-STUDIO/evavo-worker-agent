# EVAVO Outbound Agent (Cloudflare Worker)

This is the Worker-side runtime for the EVAVO Outbound Agent: a governed opportunity intelligence system for safe source discovery, opportunity review, and controlled outbound preparation.

The current operating model is **free-safe first**:

- AI drafting is off by default.
- Sending is off by default.
- Source expansion is bounded, auditable, and candidate-memory-first.
- Zero-source startup is supported as a first-class safe path when no manual source list exists.
- Live sources are promoted only through explicit review and confirmation gates.
- The browser must never receive the Worker admin token.

## Current operating docs

Start here for the modern opportunity/source-expansion workflow:

- [`docs/zero-source-startup.md`](docs/zero-source-startup.md) — contract for starting safely when no manual source list exists.
- [`docs/zero-source-route-catalogue.md`](docs/zero-source-route-catalogue.md) — backend route sequence for zero-source startup, fallback guidance, query hints, candidate review, source health, and opportunity discovery.
- [`migrations/README.md`](migrations/README.md) — migration ordering and remote D1 safety notes.

## Important production note

The remote D1 database already contains live data. Do **not** blindly re-run `schema.sql` against the remote database unless you are intentionally rebuilding a fresh database.

For the existing production D1, use migrations such as:

```bash
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0001_free_safe_core.sql
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0002_draft_review_learning.sql
```

For current source-expansion/origin-learning installs, follow the migration ordering in [`migrations/README.md`](migrations/README.md).

## Quick start

1) Install deps

```bash
npm i
```

2) Typecheck

```bash
npm run typecheck
```

3) Check migration files are present

```bash
npm run db:migrations:check
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

- AI disabled unless explicitly enabled
- Sending disabled unless explicitly enabled
- Deep diagnostics require confirmation
- Settings and policy gates decide whether scheduled work can run
- Source expansion stores candidates before live source saves
- Candidate-source promotion requires explicit confirmation
- Budget counters and run history are tracked in D1 once migrations are applied

## Zero-source startup summary

When no manual source list exists, the safe path is:

1. Read autonomy settings and policy.
2. Bootstrap durable seed memory.
3. Run tiny bounded source expansion.
4. Follow fallback guidance before increasing depth.
5. Try sitemap/robots or public-link graph discovery when seed pages are thin.
6. Use query hints only as operator-guided recovery.
7. Resolve human-reviewed public URLs into candidate memory.
8. Promote candidates only after review and confirmation.
9. Run opportunity discovery only after live source memory exists.

Zero-source startup must remain public-source-only, capped, origin-preserving, candidate-memory-first, and free-safe by default.

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
- `GET /admin/settings/autonomy`
- `POST /admin/settings/autonomy`
- `GET /admin/opportunities/summary`
- `GET /admin/opportunities/runs`
- `GET /admin/opportunities/sources`
- `GET /admin/opportunities/sources/health`
- `GET /admin/opportunities/sources/origin-metrics`
- `POST /admin/opportunities/sources/expansion/bootstrap`
- `POST /admin/opportunities/sources/expansion/scan`
- `POST /admin/opportunities/sources/expansion/sitemap-scan`
- `POST /admin/opportunities/sources/expansion/public-directory-scan`
- `GET /admin/opportunities/sources/expansion/query-hints`
- `POST /admin/opportunities/sources/expansion/query-hints/generate`
- `POST /admin/opportunities/sources/expansion/query-hints/resolve`
- `GET /admin/opportunities/sources/expansion/budget-recommendations`
- `GET /admin/opportunities/sources/expansion/candidates`
- `POST /admin/opportunities/sources/expansion/learn`
- `GET /admin/opportunities/sources/expansion/strategies`
- `GET /admin/opportunities/sources/candidates/preview`
- `POST /admin/opportunities/sources/candidates/commit`
- `POST /admin/opportunities/run-due`

Legacy / retained admin endpoints:

- `GET /admin/leads?status=new&limit=50`
- `POST /admin/leads`
- `GET /admin/drafts?status=queued&limit=50`
- `POST /admin/drafts/:id/approve`
- `POST /admin/drafts/:id/reject`
- `POST /admin/draft-review/:id`
- `GET /admin/strategy-scores?limit=50`
- `POST /admin/run`
- `GET /admin/settings`
- `POST /admin/settings`

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

## Local verification

```powershell
cd C:\GitRepos\evavo-worker-agent
git pull
npm run typecheck
npm run db:migrations:check
```

## Common gotchas

### D1 schema executed locally instead of remote

If you see output mentioning `.wrangler/state/...` and `local database`, you initialized the local dev DB.

For existing production, prefer explicit migration files and the migration helper scripts documented in [`migrations/README.md`](migrations/README.md).

### Updating secrets

To replace a secret value:

```bash
wrangler secret put ADMIN_TOKEN
```

To delete an optional secret:

```bash
wrangler secret delete MAILCHANNELS_API_KEY
```
