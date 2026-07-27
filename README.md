# EVAVO Growth Research Worker

This repository contains the Cloudflare Worker backend for EVAVO Growth Autopilot and Business Autopilot.

The active Worker is a governed, review-first opportunity-intelligence system. It supports bounded public-source research, source and opportunity review, internal scoring, strategy memory, audit metadata, historical review records and private operational reporting.

It does **not** provide outbound execution.

## Package and deployment identity

The npm package identifier is `evavo-worker-agent`.

The live Cloudflare Worker deployment identifier remains `evavo-outbound-agent`. The historical D1 resource identifier remains `evavo_outbound_agent`. These infrastructure names are compatibility resources only; they do not describe an enabled outbound capability.

Changing the npm package identity does not rename or deploy the Worker, alter the Wrangler deployment name, rename the D1 database, run a migration or mutate remote data.

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
- Confirmation is the exact JSON boolean `true`; query-string, numeric and string coercions are rejected.
- Confirmed research and source-management JSON bodies are media-type checked, stream-bounded, structure-bounded and SHA-256 fingerprinted.
- Public research URLs and every redirect are validated against the shared public-only network policy.
- Public response bodies are full-operation-timeout-bounded, byte-bounded and hashed for evidence receipts.
- Sensitive query credentials and binary response bodies are rejected.
- Unsafe rejected URL inputs are redacted rather than reflected in route responses or audit metadata.
- Research runs distinguish attempts from successful fetches and report skipped, failed, partial and completed outcomes truthfully.
- Paired source-health and source-run audit updates use a D1 transaction.
- Opportunity extraction is deterministic, boundary-aware and evidence-quality-scored.
- Missing deadlines, values, currencies, eligibility and scope remain missing rather than being inferred.
- Historical source and review learning may calibrate grounded evidence but cannot promote weak evidence into high confidence.
- Persisted opportunity candidates are internal review records only and cannot become drafts, approvals or external actions.
- Manual legacy execution routes return a fail-closed response.
- All protected routes require server-side Worker authentication.
- Confirmed write routes mutate internal D1 metadata only.
- Historical draft-shaped and approval-shaped records are non-deliverable, non-executable and non-authoritative.
- Public routes expose aggregate, non-sensitive status only.
- The browser must never receive the Worker admin token.
- Tracked source is scanned for environment files, private keys, live provider-token shapes, credential-bearing URLs and non-placeholder sensitive assignments.
- Local `.env`, `.dev.vars` and Wrangler state remain ignored; only reviewed placeholder templates may be tracked.
- GitHub repository visibility must be private; current public visibility is a release and governance blocker.

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

## Source-secret and repository posture

The Worker must remain free of deployable credentials regardless of who can read its source. The focused command is:

```powershell
npm run worker:source-secret-safety:check
```

The guard scans tracked text files without printing matched values. It rejects real environment files, private-key material, common live provider-token shapes, credential-bearing URLs, npm authentication tokens and non-placeholder assignments to sensitive variables.

Use [`.dev.vars.example`](.dev.vars.example) as the local template. Copy it to the ignored `.dev.vars` file and replace placeholders only in that local file. `ADMIN_TOKEN` remains a Cloudflare server-side secret and must never be committed, exposed to browser code or placed in client-visible configuration.

GitHub currently reports this repository as **public**. The required repository posture is `private: true`, `visibility: private` and `archived: false`. Until an approved GitHub administrator changes the visibility and the live check passes, repository confidentiality remains a release and governance blocker.

Run the deterministic static policy check locally:

```powershell
npm run worker:repository-visibility:check
```

A live metadata check requires a read-only GitHub token and the exact repository context:

```powershell
$env:GITHUB_REPOSITORY = "EVAVO-STUDIO/evavo-worker-agent"
$env:GITHUB_TOKEN = "<read-only GitHub token>"
node .\scripts\check-worker-repository-visibility.mjs --live
```

The separate `Worker repository confidentiality` GitHub Actions workflow performs this live read with the built-in read-only repository token. It performs no repository mutation and no deployment. Source-secret safety and private repository visibility are independent requirements; passing one does not prove the other.

The authoritative detailed contracts are:

- [`docs/worker-source-secret-posture.md`](docs/worker-source-secret-posture.md)
- [`docs/worker-repository-confidentiality.md`](docs/worker-repository-confidentiality.md)

## Bounded request boundary

Manual research and source-management handlers use `src/core/boundedJsonRequest.ts` with contract:

```text
bounded_admin_json_request_v1
```

The default request-body cap is 65,536 bytes. The boundary checks declared and observed byte counts, validates strict UTF-8 JSON, requires an object root and limits nesting, node count, array size, string length and key length. Prototype-pollution keys are rejected.

A valid body produces a compact request receipt containing its contract, byte count and SHA-256 body hash. The full body is not logged or echoed. This lets operators correlate the exact confirmed request without retaining sensitive raw input.

The authoritative detailed contract is [`docs/bounded-admin-json-boundary.md`](docs/bounded-admin-json-boundary.md).

## Research boundary

Allowed network activity is read-only public research through explicitly classified, authenticated, confirmation-gated and bounded manual source or opportunity handlers.

All active research handlers use `src/core/publicResearchFetch.ts` with contract `public_research_fetch_v2`. The boundary rejects non-public hosts, embedded URL credentials, sensitive query parameters, unsafe protocols and non-standard ports. Redirects are followed manually only after the next target passes the same public URL policy. Cloudflare runtime configuration also enables `global_fetch_strictly_public`.

The default response limit is 1,048,576 bytes, the default redirect limit is four and the default full-operation timeout is 12 seconds. One deadline covers the redirect chain, response headers and streamed body read. Bodies are cancelled when the configured byte or time limit is exceeded. Binary bodies are rejected even if the server omits or misstates its content type.

Each completed fetch returns an evidence receipt containing the requested URL, final URL, status, content type, content length, language, ETag, Last-Modified value, redirect count, redirect chain, byte count, SHA-256 body hash, elapsed time, fetch timestamp and `timeoutScope: full_operation`. Source expansion and opportunity candidates retain relevant receipt data, and inserted lead discoveries retain the source-run identifier.

Research summaries keep network attempts separate from successful pages. A run is `skipped` when no eligible source exists, `failed` when every attempted source fails, `partial` when only some sources fail and `completed` when all attempted sources succeed.

Sitemap research traverses sitemap indexes to a maximum depth of two while remaining inside the caller’s existing fetch and candidate caps. Sitemap indexes do not create a crawler: discovered page URLs are saved only as internal review candidates and are not fetched by the sitemap engine.

Manual research handlers may:

- fetch public HTML, robots files, sitemap XML and bounded sitemap indexes with GET requests
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

The authoritative detailed contract is [`docs/public-research-fetch-boundary.md`](docs/public-research-fetch-boundary.md).

## Opportunity evidence quality

Opportunity extraction uses canonical public URLs and boundary-aware term matching so short signals such as `ai`, `ar`, `ui`, `eoi`, `rfp` and `rft` do not match inside unrelated words. Tracking parameters are removed before deduplication.

Deadlines are normalised only when a complete supported date, including the year, is present. Monetary values are parsed only when marked with `AUD`, `NZD` or a dollar sign. The Worker does not guess years, timezones, currencies, budgets, eligibility or scope.

Each candidate reports an evidence-quality score, evidence strength, missing facts and review flags. Confidence requires both a useful opportunity score and sufficient evidence quality. Positive historical learning is blocked for weak evidence and tightly capped for limited evidence.

Candidates can be persisted only with explicit review-only, non-executable and non-deliverable posture. Operator-facing recommendations are internal review instructions such as shortlisting for eligibility review or inspecting the source evidence. They are not response-preparation or execution instructions.

The authoritative detailed contract is [`docs/opportunity-evidence-quality.md`](docs/opportunity-evidence-quality.md).

## Current operating documents

- [`docs/worker-source-secret-posture.md`](docs/worker-source-secret-posture.md)
- [`docs/worker-repository-confidentiality.md`](docs/worker-repository-confidentiality.md)
- [`docs/bounded-admin-json-boundary.md`](docs/bounded-admin-json-boundary.md)
- [`docs/public-research-fetch-boundary.md`](docs/public-research-fetch-boundary.md)
- [`docs/opportunity-evidence-quality.md`](docs/opportunity-evidence-quality.md)
- [`docs/manual-research-concurrency.md`](docs/manual-research-concurrency.md)
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

The authoritative model is research-memory-first, metadata-first, review-first and non-executing.

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
npm run worker:source-secret-safety:check
npm run worker:repository-visibility:check
npm run safety:gates:check
npm run docs:operating-posture:check
npm run docs:readme-truthfulness:check
npm run worker:health:check
npm run worker:routes:check
npm run worker:package-identity:check
npm run scheduled:autonomy-safety:check
npm run manual:execution-safety:check
npm run legacy:engine-isolation:check
npm run public:surface-safety:check
npm run research:bounded-json-safety:check
npm run research:public-fetch-safety:check
npm run research:manual-lease-safety:check
npm run opportunities:evidence-quality:check
npm run opportunities:execution-boundary-safety:check
npm run runtime:capability-config:check
npm run opportunities:route-policy:check
npm run business:route-policy:check
npm run business:route-catalogue-truthfulness:check
npm run business:draft-runtime-safety:check
npm run business:historical-type-isolation:check
npm run business:review-record-storage-isolation:check
npm run business:ci-parity:check
npm run operations:route-policy:check
npm run planner:catalogue-truthfulness:check
npm run growth:route-policy:check
npm run growth:negative-safety:check
npm run growth:backend:aggregate:check
npm run growth:backend:check:local
npm run worker:final-gate:print
npm run test:core
npm run typecheck
```

The focused commands are useful for diagnosing one contract, but `npm run check:local` remains the authoritative complete gate.

The GitHub Actions Worker contract workflow runs the tracked-source secret check, focused request, fetch and evidence checks, deterministic Node tests and the authoritative `check:local` chain with read-only repository permissions. It does not deploy and does not request Worker credentials.

The separate Worker repository confidentiality workflow performs a bounded live GitHub metadata read using only the built-in read-only repository token. It remains red while the repository is public and performs no repository mutation or deployment.

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
- strict public-only Cloudflare subrequests
- an internal-only Worker schedule
- brand and geographic context
- a compatibility Cloudflare AI binding that active safety contracts prohibit from executing

There are no draft or send runtime caps because those execution capabilities and modules do not exist.

## Safe zero-source workflow

When no approved source list exists:

1. Read the autonomy and runtime policy.
2. Create a bounded manual research plan.
3. Review candidate domains and crawl policy.
4. Send an authenticated request with `Content-Type: application/json` and exact `confirm: true`.
5. Run one bounded manual research action.
6. Save findings as internal review metadata only.
7. Review the request receipt, fetch receipts, redirect chain, run status, evidence quality, missing facts and source health manually.
8. Do not draft, send, post, submit or mutate external systems.
