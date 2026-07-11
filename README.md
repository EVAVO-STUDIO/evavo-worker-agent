# EVAVO Outbound Agent (Cloudflare Worker)

This is the Worker-side runtime for the EVAVO Outbound Agent: a governed opportunity intelligence system for safe source discovery, opportunity review, controlled outbound preparation, the EVAVO Growth Operator, and the broader EVAVO Business Autopilot.

The current operating model is **free-safe first**:

- AI drafting is off by default.
- Sending is off by default.
- Source expansion is bounded, auditable, and candidate-memory-first.
- Zero-source startup is supported as a first-class safe path when no manual source list exists.
- Autonomous discovery is research-memory-first and supervised-action only.
- Business Autopilot is metadata, scoring, website/funnel audit, audit-observation, audit-pack, draft-only and approval-governance first.
- Business Autopilot is intended to act as a business analyst / sales strategist / BDM / growth manager / operator brain while keeping external execution disabled until explicitly governed.
- Live sources are promoted only through explicit review and confirmation gates.
- Growth Operator and Business Autopilot read routes and confirmed metadata-write routes do not send, post, comment, submit forms, execute browser actions, browse, spend, mutate external systems, or call AI.
- The browser must never receive the Worker admin token.

## Current operating docs

Start here for the modern opportunity/source-expansion workflow:

- [`docs/zero-source-startup.md`](docs/zero-source-startup.md) — contract for starting safely when no manual source list exists.
- [`docs/zero-source-route-catalogue.md`](docs/zero-source-route-catalogue.md) — backend route sequence for zero-source startup, fallback guidance, query hints, candidate review, source health, and opportunity discovery.
- [`docs/growth-autonomous-discovery-architecture.md`](docs/growth-autonomous-discovery-architecture.md) — autonomous research, supervised action, source registry, crawl-policy and approval-pack architecture.
- [`docs/growth-source-discovery-safety-policy.md`](docs/growth-source-discovery-safety-policy.md) — source-discovery safety policy, robots/crawl posture, blocked actions, and Worker/Next read boundary.
- [`docs/growth-zero-source-research-runbook.md`](docs/growth-zero-source-research-runbook.md) — zero-source autonomous research runbook and phase-one done criteria.
- [`docs/business-autopilot-architecture.md`](docs/business-autopilot-architecture.md) — broader agency intelligence, memory, scoring, audit-pack, draft-only action and governed-execution architecture.
- [`docs/business-autopilot-governance-policy.md`](docs/business-autopilot-governance-policy.md) — approval, suppression, channel, kill-switch and external-action governance policy.
- [`docs/business-autopilot-compliance-policy.md`](docs/business-autopilot-compliance-policy.md) — compliance gates for email, social, contact-form, suppression, audit and future execution.
- [`docs/business-autopilot-data-model.md`](docs/business-autopilot-data-model.md) — Business Autopilot tables, relationships and metadata model.
- [`docs/business-autopilot-draft-review-route-plan.md`](docs/business-autopilot-draft-review-route-plan.md) — safe future route glue for draft-only action builds and matching approval requests.
- [`docs/business-autopilot-validation.md`](docs/business-autopilot-validation.md) — Business Autopilot local checks, route-contract smoke, read-only verification and dashboard follow-up.
- [`docs/business-autopilot-people-routes.md`](docs/business-autopilot-people-routes.md) — people/contact-context route layer and allowed-use posture.
- [`docs/business-autopilot-website-page-routes.md`](docs/business-autopilot-website-page-routes.md) — website, page, website/funnel audit, audit observation and audit observation candidate routes.
- [`docs/growth-autonomy-agent.md`](docs/growth-autonomy-agent.md) — contract for the Growth Autonomy Agent above the opportunity/source layer.
- [`docs/growth-channel-policy.md`](docs/growth-channel-policy.md) — channel classes, link policy, disclosure policy, execution policy, and cooldown rules.
- [`docs/growth-engagement-action-model.md`](docs/growth-engagement-action-model.md) — typed action lifecycle for signals, drafts, approvals, execution, and outcomes.
- [`docs/growth-cost-governor.md`](docs/growth-cost-governor.md) — budget ledger, rest triggers, cost caps, and fail-closed rules.
- [`docs/growth-route-contract-verification.md`](docs/growth-route-contract-verification.md) — verifies the full Growth route catalogue, expected IDs, safety flags, and confirmed metadata-write routes.
- [`docs/growth-backend-validation.md`](docs/growth-backend-validation.md) — preferred guarded Worker backend aggregate validation flow and cross-repo pairing with Next Growth Ops validation.
- [`docs/growth-capability-registry.md`](docs/growth-capability-registry.md) — capability registry for the EVAVO Growth Operator, including autonomy levels and blocked future execution placeholders.
- [`docs/growth-campaign-intelligence.md`](docs/growth-campaign-intelligence.md) — current v3 campaign, strategy, blackboard, cycle, autonomy, and decision-brain contract.
- [`docs/growth-strategy-memory.md`](docs/growth-strategy-memory.md) — objectives, key results, target segments, offers, positioning, and runtime constraints.
- [`docs/growth-blackboard.md`](docs/growth-blackboard.md) — internal knowledge substrate for facts, entities, relationships, market signals, and proof assets.
- [`migrations/README.md`](migrations/README.md) — migration ordering and remote D1 safety notes.

## Important production note

The remote D1 database already contains live data. Do **not** blindly re-run `schema.sql` against the remote database unless you are intentionally rebuilding a fresh database.

For current installs, use the migration helper and apply individual migrations intentionally:

```powershell
cd C:\GitRepos\evavo-worker-agent
npm run db:migration:one -- 0014 --execute
npm run db:migration:one -- 0015 --execute
npm run db:migration:one -- 0016 --execute
npm run db:migration:one -- 0017 --execute
npm run db:migration:one -- 0018 --execute
npm run db:migration:one -- 0019 --execute
npm run db:migration:one -- 0020 --execute
npm run db:migration:one -- 0021 --execute
npm run db:migration:one -- 0022 --execute
```

For current source-expansion, approval-queue, autonomous-discovery and Business Autopilot installs, follow the migration ordering in [`migrations/README.md`](migrations/README.md).

## Business operator runbook

When local npm aliases seem stale or you need one safe recovery path for the Worker, print the Business operator runbook first:

```powershell
cd C:\GitRepos\evavo-worker-agent
git pull
npm run business:operator:runbook:print
```

If the alias is not available locally yet, pull again or run the printer directly:

```powershell
node scripts/print-business-operator-worker-runbook.mjs
```

The runbook prints the migration, route wiring, validation, direct node-script fallback and deploy sequence for the Business analyst / sales strategist / BDM / growth manager / operator brain model. Internal automation can reason, score, prioritise, draft and learn; external execution remains confirm-gated and disabled by default.

## Final Worker gate and deploy

Run the final gate before production deploy:

```powershell
cd C:\GitRepos\evavo-worker-agent
git pull
npm run worker:final-gate:print
.\Run-WorkerFinalGate.ps1
```

The final gate runs local helper, migration-presence, Business Autopilot, raw-error safety, people docs, website/page docs, aggregate backend, generated-route cleanliness and TypeScript checks, then prints D1 verification commands. It stops before deployment.

This is a Cloudflare Worker repo. The real Worker deploy command is `wrangler deploy`. The npm deploy alias is intentionally a guarded wrapper:

```powershell
npm run deploy
```

In `package.json`, `deploy` is `wrangler deploy`, and `predeploy` runs the safety checks first. So `npm run deploy` runs the guard and then runs Wrangler. Direct `wrangler deploy` also deploys the Worker, but it bypasses npm `predeploy`; use direct Wrangler only when you intentionally want to bypass the local guard.

## Quick start

1) Install deps

```bash
npm i
```

2) Run local checks

```powershell
npm run growth:backend:check:local
```

3) Deploy through the guarded Worker deploy wrapper

```bash
npm run deploy
```

## Secrets

```bash
wrangler secret put ADMIN_TOKEN
wrangler secret put MAILCHANNELS_API_KEY   # optional, only required to send in future approved execution layers
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
- Growth goals, strategy, channels, signals, actions, campaigns, metrics, evidence, learning, strategy memory, blackboard writes, approval records, autonomous discovery metadata writes, and Business Autopilot metadata writes require explicit confirmation and are metadata-only
- Budget counters, run history, approval requests, autonomous discovery research memory, and Business Autopilot agency memory are tracked in D1 once migrations are applied

## Zero-source startup summary

When no manual source list exists, the safe path is:

1. Read autonomy settings and policy.
2. Create a zero-source research plan.
3. Save source candidates instead of directly crawling/sending.
4. Review and promote candidates through confirmation gates.
5. Run opportunity review and draft-only preparation from approved internal metadata.

The Growth Operator and Business Autopilot should remain metadata-first and approval-gated unless a later governance layer explicitly enables execution.