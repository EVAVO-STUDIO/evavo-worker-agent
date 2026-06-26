# EVAVO Outbound Agent (Cloudflare Worker)

This is the Worker-side runtime for the EVAVO Outbound Agent: a governed opportunity intelligence system for safe source discovery, opportunity review, controlled outbound preparation, and the emerging Growth Autonomy layer.

The current operating model is **free-safe first**:

- AI drafting is off by default.
- Sending is off by default.
- Source expansion is bounded, auditable, and candidate-memory-first.
- Zero-source startup is supported as a first-class safe path when no manual source list exists.
- Live sources are promoted only through explicit review and confirmation gates.
- Growth Autonomy read routes are GET-only, and confirmed strategy/channel writes do not send, post, submit forms, execute actions, or call AI.
- The browser must never receive the Worker admin token.

## Current operating docs

Start here for the modern opportunity/source-expansion workflow:

- [`docs/zero-source-startup.md`](docs/zero-source-startup.md) — contract for starting safely when no manual source list exists.
- [`docs/zero-source-route-catalogue.md`](docs/zero-source-route-catalogue.md) — backend route sequence for zero-source startup, fallback guidance, query hints, candidate review, source health, and opportunity discovery.
- [`docs/growth-autonomy-agent.md`](docs/growth-autonomy-agent.md) — contract for the Growth Autonomy Agent above the opportunity/source layer.
- [`docs/growth-channel-policy.md`](docs/growth-channel-policy.md) — channel classes, link policy, disclosure policy, execution policy, and cooldown rules.
- [`docs/growth-engagement-action-model.md`](docs/growth-engagement-action-model.md) — typed action lifecycle for signals, drafts, approvals, execution, and outcomes.
- [`docs/growth-cost-governor.md`](docs/growth-cost-governor.md) — budget ledger, rest triggers, cost caps, and fail-closed rules.
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
- Growth Autonomy strategy/channel writes require explicit confirmation and are metadata-only
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

## Growth Autonomy summary

The Growth Autonomy layer adds strategy/channel/budget structure above the opportunity engine.

Current Worker support:

1. Read Growth overview.
2. Read active Growth goals.
3. Read channel rules/memory.
4. Read or create the current budget ledger for visibility.
5. Confirm-save Growth goals and channels as metadata only.
6. Return safety metadata proving no AI, email, posting, form submission, or action execution occurs.

Execution routes for posting, sending, form submission, and draft generation should only be added after strategy, channel policy, scoring gates, budget ledger, engagement queue, and review controls are in place.

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
- `GET /admin/growth`
- `GET /admin/growth/overview`
- `GET /admin/growth/strategy?limit=25`
- `POST /admin/growth/strategy?confirm=1`
- `GET /admin/growth/channels?limit=50`
- `POST /admin/growth/channels?confirm=1`
- `GET /admin/growth/budget?profile=free_safe`
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
