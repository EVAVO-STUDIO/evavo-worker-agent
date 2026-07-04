# EVAVO Outbound Agent (Cloudflare Worker)

This is the Worker-side runtime for the EVAVO Outbound Agent: a governed opportunity intelligence system for safe source discovery, opportunity review, controlled outbound preparation, and the EVAVO Growth Operator.

The current operating model is **free-safe first**:

- AI drafting is off by default.
- Sending is off by default.
- Source expansion is bounded, auditable, and candidate-memory-first.
- Zero-source startup is supported as a first-class safe path when no manual source list exists.
- Autonomous discovery is research-memory-first and supervised-action only.
- Live sources are promoted only through explicit review and confirmation gates.
- Growth Operator read routes and confirmed metadata-write routes do not send, post, submit forms, execute browser actions, browse, spend, or call AI.
- The browser must never receive the Worker admin token.

## Current operating docs

Start here for the modern opportunity/source-expansion workflow:

- [`docs/zero-source-startup.md`](docs/zero-source-startup.md) — contract for starting safely when no manual source list exists.
- [`docs/zero-source-route-catalogue.md`](docs/zero-source-route-catalogue.md) — backend route sequence for zero-source startup, fallback guidance, query hints, candidate review, source health, and opportunity discovery.
- [`docs/growth-autonomous-discovery-architecture.md`](docs/growth-autonomous-discovery-architecture.md) — autonomous research, supervised action, source registry, crawl-policy and approval-pack architecture.
- [`docs/growth-source-discovery-safety-policy.md`](docs/growth-source-discovery-safety-policy.md) — source-discovery safety policy, robots/crawl posture, blocked actions, and Worker/Next read boundary.
- [`docs/growth-zero-source-research-runbook.md`](docs/growth-zero-source-research-runbook.md) — zero-source autonomous research runbook and phase-one done criteria.
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
```

For current source-expansion, approval-queue and autonomous-discovery installs, follow the migration ordering in [`migrations/README.md`](migrations/README.md).

## Quick start

1) Install deps

```bash
npm i
```

2) Run local checks

```powershell
npm run growth:backend:check:local
```

3) Deploy

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
- Growth goals, strategy, channels, signals, actions, campaigns, metrics, evidence, learning, strategy memory, blackboard writes, approval records, and autonomous discovery metadata writes require explicit confirmation and are metadata-only
- Budget counters, run history, approval requests, and autonomous discovery research memory are tracked in D1 once migrations are applied

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

## Autonomous discovery summary

Autonomous discovery is now part of the Growth backend contract, but it is still metadata-only and supervised-action only.

Worker-owned autonomous discovery storage and route IDs:

```text
growth_research_runs
growth_source_candidates
growth_extracted_signals
growth_opportunity_scores
growth_agent_decisions
growth_discovery_feedback
growth_research_run_plan
growth_source_candidate_save
growth_fetch_queue_enqueue
growth_agent_decision_record
growth_discovery_feedback_save
```

Current autonomous discovery guarantees:

```text
no live crawling from browser
no email sending
no social posting
no form submission
no AI calls from the proxy layer
no external state change
confirm-required metadata writes only
```

## Growth Operator v3 summary

The current Growth Operator brain combines:

```text
campaign intelligence
strategy memory
blackboard knowledge
capability registry
route safety catalogue
autonomous discovery research memory
```

Current read-only brain contracts:

```text
growth_operator_cycle_v3_strategy_blackboard_read_only
growth_autonomous_runtime_v3_strategy_blackboard
```

Current Worker support:

1. Read Growth overview and free-safe brief.
2. Read the Growth capability registry and route safety catalogue.
3. Read Growth operator overview, cycle, autonomy contract, and cycle history.
4. Read autonomous discovery research runs, source candidates, extracted signals, opportunity scores, agent decisions, and feedback.
5. Confirm-save autonomous discovery metadata: research plans, source candidates, fetch-queue records, agent decisions, and feedback.
6. Confirm-save campaign, experiment, metric, evidence, learning, and decision metadata.
7. Confirm-record cycle snapshots into cycle memory.
8. Read and write strategy memory as confirmed internal metadata: objectives, key results, segments, offers, positioning, and runtime constraints.
9. Read and write blackboard knowledge as confirmed internal metadata: facts, entities, relationships, market signals, and proof assets.
10. Confirm-plan deterministic campaign decisions without AI, browsing, sending, posting, form submission, or external state changes.
11. Return route-catalogue safety metadata proving no AI, email, posting, form submission, browser execution, or action execution occurs.

Execution routes for external delivery, publishing, browser submission, live crawling, and AI drafting should only be added after evidence packs, approval records, suppression checks, caps, identity controls, audit events, crawl governance, and channel-specific governance are in place.

## Growth capability registry

The Growth Operator capability model lives in:

```text
src/core/growthCapabilities.ts
src/routes/growthCapabilitiesAdmin.ts
docs/growth-capability-registry.md
```

Current capability classes include:

```text
research
analysis
drafting
browser
external_delivery
internal_ops
reporting
```

The registry defines autonomy levels from read-only through autonomous campaign mode. It is a control-plane model only and does not execute capabilities by itself.

The route is:

```text
GET /admin/growth/capabilities
```

Wire route additions locally in `src/index.ts` before the generic `/admin/growth/` branch by running:

```powershell
npm run growth:wiring:apply
```

## Growth smoke verification

Run the guarded core Worker checks:

```powershell
cd C:\GitRepos\evavo-worker-agent
git pull
npm run growth:wiring:apply
npm run growth:route-catalogue:apply
npm run growth:backend:check:local
```

`growth:backend:check:local` runs the backend aggregate command contract checker before the full local backend check.

The full backend local check includes:

```powershell
npm run scripts:check
npm run db:migrations:check
npm run growth:route-delegates:check
npm run growth:route-safety-flags:check
npm run growth:capabilities:check
npm run growth:campaigns:check
npm run growth:strategy:check
npm run growth:blackboard:check
npm run growth:review-queue:check
npm run growth:autonomous-discovery:check
npm run typecheck
```

Print the route-contract-only Growth check when you only need to validate the Worker route catalogue and do not want to run optional metadata-write smoke steps:

```powershell
npm run growth:route-contract:print
```

Print the broader smoke-test commands:

```powershell
npm run growth:smoke:print
npm run growth:campaigns:smoke:print
npm run growth:strategy:smoke:print
npm run growth:blackboard:smoke:print
```

Then run the printed commands after setting:

```powershell
$env:ADMIN_TOKEN="..."
$env:WORKER_URL="https://evavo-outbound-agent.evavo-studio.workers.dev"
```

The route-contract checks should print:

```text
All expected Growth route ids are advertised by the Worker route catalogue.
All Growth read routes advertise readOnly, no network, no AI, no email, no social posting, no form submission, cost none, and no write tables.
All Growth metadata-write routes advertise confirm_required metadata-only posture.
Read and verify delegated Growth v3 route families, including autonomous discovery
```

If a stale or unsafe catalogue is deployed, the route-contract checks exit with code `1` and print one of these visible failure labels plus the final failure line:

```text
Missing Growth route ids:
Unsafe Growth read-route metadata found:
Growth metadata-write routes missing confirm_required or safe metadata posture:
Delegated Growth route has missing or unsafe read safety:
Growth route contract smoke check failed.
```

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
- `GET /admin/planner/routes`

Core Growth:

- `GET /admin/growth`
- `GET /admin/growth/overview`
- `GET /admin/growth/brief?profile=free_safe`
- `GET /admin/growth/capabilities`
- `GET /admin/growth/operator`
- `GET /admin/growth/autonomy`
- `GET /admin/growth/cycle`
- `GET /admin/growth/cycle/events?limit=25`
- `POST /admin/growth/cycle/record?confirm=1`

Autonomous discovery:

- `GET /admin/growth/discovery/research-runs?limit=25`
- `POST /admin/growth/discovery/research-runs/plan?confirm=1`
- `GET /admin/growth/discovery/source-candidates?limit=25`
- `POST /admin/growth/discovery/source-candidates?confirm=1`
- `GET /admin/growth/discovery/signals?limit=25`
- `GET /admin/growth/discovery/opportunity-scores?limit=25`
- `GET /admin/growth/discovery/agent-decisions?limit=25`
- `POST /admin/growth/discovery/agent-decisions?confirm=1`
- `GET /admin/growth/discovery/feedback?limit=25`
- `POST /admin/growth/discovery/feedback?confirm=1`
- `POST /admin/growth/discovery/fetch-queue?confirm=1`

Campaign intelligence:

- `GET /admin/growth/campaigns?limit=25`
- `POST /admin/growth/campaigns?confirm=1`
- `GET /admin/growth/experiments?limit=25`
- `POST /admin/growth/experiments?confirm=1`
- `GET /admin/growth/decisions?limit=25`
- `POST /admin/growth/decisions/plan?confirm=1`
- `GET /admin/growth/metrics?limit=25`
- `POST /admin/growth/metrics?confirm=1`
- `GET /admin/growth/evidence?limit=25`
- `POST /admin/growth/evidence?confirm=1`
- `GET /admin/growth/learning?limit=25`
- `POST /admin/growth/learning?confirm=1`

Strategy memory:

- `GET /admin/growth/strategy-memory`
- `GET /admin/growth/objectives?limit=25`
- `POST /admin/growth/objectives?confirm=1`
- `GET /admin/growth/key-results?limit=50`
- `POST /admin/growth/key-results?confirm=1`
- `GET /admin/growth/segments?limit=25`
- `POST /admin/growth/segments?confirm=1`
- `GET /admin/growth/offers?limit=25`
- `POST /admin/growth/offers?confirm=1`
- `GET /admin/growth/positioning?limit=25`
- `POST /admin/growth/positioning?confirm=1`
- `GET /admin/growth/runtime-constraints?limit=50`
- `POST /admin/growth/runtime-constraints?confirm=1`

Blackboard:

- `GET /admin/growth/blackboard`
- `GET /admin/growth/blackboard/facts?limit=50`
- `POST /admin/growth/blackboard/facts?confirm=1`
- `GET /admin/growth/blackboard/entities?limit=50`
- `POST /admin/growth/blackboard/entities?confirm=1`
- `GET /admin/growth/blackboard/relationships?limit=50`
- `POST /admin/growth/blackboard/relationships?confirm=1`
- `GET /admin/growth/blackboard/signals?limit=50`
- `POST /admin/growth/blackboard/signals?confirm=1`
- `GET /admin/growth/blackboard/assets?limit=50`
- `POST /admin/growth/blackboard/assets?confirm=1`

Legacy Growth metadata routes:

- `GET /admin/growth/strategy?limit=25`
- `POST /admin/growth/strategy?confirm=1`
- `GET /admin/growth/channels?limit=50`
- `POST /admin/growth/channels?confirm=1`
- `GET /admin/growth/signals?limit=50`
- `POST /admin/growth/signals?confirm=1`
- `POST /admin/growth/signals/status?confirm=1`
- `GET /admin/growth/actions?limit=50`
- `POST /admin/growth/actions?confirm=1`
- `POST /admin/growth/actions/plan?confirm=1`
- `POST /admin/growth/actions/status?confirm=1`
- `GET /admin/growth/audit?limit=50`
- `GET /admin/growth/budget?profile=free_safe`

See the route catalogue for the full endpoint list and safety metadata.

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
npm run growth:wiring:apply
npm run growth:route-catalogue:apply
npm run growth:backend:check:local
npm run growth:backend:final:print
npm run growth:route-contract:print
npm run growth:campaigns:smoke:print
npm run growth:strategy:smoke:print
npm run growth:blackboard:smoke:print
npm run git:main-audit:print
```

## Common gotchas

### D1 schema executed locally instead of remote

If you see output mentioning `.wrangler/state/...` and `local database`, you initialized the local dev DB. Use the migration helper with `--execute` for intentional remote migration runs.

### Wrangler auth during D1 imports

If a migration import fails with Cloudflare `Authentication error [code: 10000]` but earlier runs succeeded, confirm your Wrangler login/session before retrying. Do not repeatedly rerun already-applied migrations unless an endpoint reports a missing table.
