# EVAVO Growth Research Worker

This repository contains the Cloudflare Worker backend for EVAVO Growth Autopilot and Business Autopilot.

The active Worker is a governed, review-first opportunity-intelligence system. It supports bounded public-source research, source and opportunity review, internal scoring, strategy memory, audit metadata, historical review records and private operational reporting.

It does **not** provide outbound execution.

## Enforced operating posture

- AI execution is disabled.
- Draft generation is disabled.
- Email sending is disabled.
- Social posting is disabled.
- Contact-form submission is disabled.
- Browser automation is disabled.
- External state mutation is disabled.
- The former legacy execution engine and email sender have been deleted.
- Scheduled work is internal-only and may synchronise defensive flags, refresh learning from existing D1 review metadata and record internal audit events.
- Scheduled work cannot fetch public sources, expand source candidates, discover opportunities, generate drafts or perform external actions.
- Public-source research is manual-only, authenticated, explicitly confirmed, bounded and review-only.
- Manual legacy execution routes return a fail-closed response.
- All protected routes require server-side Worker authentication.
- Confirmed write routes mutate internal D1 metadata only.
- Historical draft-shaped and approval-shaped records are non-deliverable, non-executable and non-authoritative.
- Public routes expose aggregate, non-sensitive status only.
- The browser must never receive the Worker admin token.

## Active architecture

The Worker is organised around typed route-policy registries:

- top-level Worker route families
- opportunity routes
- Growth routes
- Business Autopilot routes
- planner and source routes
- historical review-record and strategy-score routes
- autonomy and legacy-safety routes

Each policy records authentication, mutation, confirmation, network and prohibited-capability posture. The Worker dispatcher delegates through those registries rather than maintaining an unstructured pathname chain.

## Research boundary

Allowed network activity is read-only public research through explicitly classified, authenticated, confirmation-gated and bounded manual source or opportunity handlers.

Manual research handlers may:

- fetch public HTML with GET requests
- inspect public directory or business pages
- save source candidates and research evidence
- update source health and cooldown metadata
- score and prioritise opportunities

They may not:

- run from the scheduled entrypoint
- authenticate to third-party services
- bypass access controls
- submit forms
- send messages
- post or comment
- purchase advertising
- mutate third-party data
- invoke the deleted legacy execution engine

## Current operating documents

- [`docs/zero-source-startup.md`](docs/zero-source-startup.md)
- [`docs/zero-source-route-catalogue.md`](docs/zero-source-route-catalogue.md)
- [`docs/growth-autonomous-discovery-architecture.md`](docs/growth-autonomous-discovery-architecture.md)
- [`docs/growth-source-discovery-safety-policy.md`](docs/growth-source-discovery-safety-policy.md)
- [`docs/growth-zero-source-research-runbook.md`](docs/growth-zero-source-research-runbook.md)
- [`docs/business-autopilot-architecture.md`](docs/business-autopilot-architecture.md)
- [`docs/business-autopilot-governance-policy.md`](docs/business-autopilot-governance-policy.md)
- [`docs/business-autopilot-compliance-policy.md`](docs/business-autopilot-compliance-policy.md)
- [`docs/business-autopilot-data-model.md`](docs/business-autopilot-data-model.md)
- [`docs/business-autopilot-validation.md`](docs/business-autopilot-validation.md)
- [`docs/business-autopilot-people-routes.md`](docs/business-autopilot-people-routes.md)
- [`docs/business-autopilot-website-page-routes.md`](docs/business-autopilot-website-page-routes.md)
- [`docs/growth-autonomy-agent.md`](docs/growth-autonomy-agent.md)
- [`docs/growth-capability-registry.md`](docs/growth-capability-registry.md)
- [`docs/growth-route-contract-verification.md`](docs/growth-route-contract-verification.md)
- [`docs/growth-backend-validation.md`](docs/growth-backend-validation.md)
- [`migrations/README.md`](migrations/README.md)

Historical labels and schema families are retained only for data compatibility. They do not describe enabled drafting, approvals-to-execution, campaigns or external delivery. The source policies, runtime contracts and safety checks are authoritative.

## Important production note

The remote D1 database contains live data. Do not blindly run `schema.sql` against the remote database unless intentionally rebuilding a fresh database.

Apply migrations individually and in order using the migration helper:

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

Follow [`migrations/README.md`](migrations/README.md) for the authoritative migration order.

## Local validation

Install dependencies and run the complete gate:

```powershell
cd C:\GitRepos\evavo-worker-agent
git pull origin main
npm ci
npm run check:local
```

Important focused checks include:

```powershell
npm run worker:health:check
npm run worker:routes:check
npm run scheduled:autonomy-safety:check
npm run manual:execution-safety:check
npm run legacy:engine-isolation:check
npm run public:surface-safety:check
npm run runtime:capability-config:check
npm run opportunities:route-policy:check
npm run business:route-policy:check
npm run operations:route-policy:check
npm run growth:route-policy:check
npm run growth:negative-safety:check
npm run typecheck
```

The GitHub Actions Worker contract workflow runs the authoritative `check:local` chain with read-only repository permissions. It does not deploy and does not request Worker credentials.

## Deployment

The guarded deployment command is:

```powershell
npm run deploy
```

The npm `predeploy` hook runs repository-sync, generated-route, PowerShell-runner, aggregate backend and complete local validation before Wrangler deploys.

A direct `wrangler deploy` bypasses npm `predeploy` and should only be used deliberately.

## Required secret

```powershell
wrangler secret put ADMIN_TOKEN
```

`ADMIN_TOKEN` is server-side only. It must not be exposed to browser code, public responses or client-visible configuration.

An optional `PUBLIC_BASE_URL` may be retained for future private-hub integration. No email-provider secrets are used by the active Worker.

## Runtime configuration

`wrangler.toml` configures:

- the D1 binding
- bounded manual public-research capacity
- an internal-only Worker schedule
- brand and geographic context
- a compatibility Cloudflare AI binding that active safety contracts prohibit from executing

There are no draft or send runtime caps because those execution capabilities and modules do not exist.

## Safe zero-source workflow

When no approved source list exists:

1. Read the autonomy and runtime policy.
2. Create a bounded manual research plan.
3. Authenticate and explicitly confirm each network-capable research action.
4. Save source candidates rather than promoting them automatically.
5. Review candidate metadata through explicit confirmation gates.
6. Run opportunity scoring and internal review from approved research metadata.
7. Keep every scheduled external and outbound action disabled.

The authoritative model is research-memory-first, metadata-first, review-first and non-executing.