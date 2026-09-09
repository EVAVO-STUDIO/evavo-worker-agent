# EVAVO Growth Research Worker

This repository contains the Cloudflare Worker backend for EVAVO Growth Autopilot and Business Autopilot.

The active Worker is a governed, review-first opportunity-intelligence system. It supports bounded public-source research, source and opportunity review, internal scoring, strategy memory, audit metadata, historical review records and private operational reporting.

It does **not** provide outbound execution.

## Package and deployment identity

The npm package identifier is `evavo-worker-agent`.

The live Cloudflare Worker deployment identifier remains `evavo-outbound-agent`. The historical D1 resource identifier remains `evavo_outbound_agent`. Those infrastructure identifiers are compatibility resources only; they do not describe an enabled outbound capability.

Changing the npm package identity does not rename or deploy the Worker, alter the Wrangler deployment name, rename D1, apply a migration or mutate remote data.

## Enforced operating posture

- AI execution is disabled.
- Draft generation is disabled.
- Email sending is disabled.
- Social posting is disabled.
- Contact-form submission is disabled.
- Browser automation is disabled.
- External state mutation is disabled.
- The former legacy execution engine and email sender remain deleted.
- Scheduled work is internal-only and may synchronise defensive flags, refresh learning from existing D1 review metadata and record internal audit events.
- Scheduled work cannot fetch public sources, expand source candidates, discover opportunities, generate drafts or perform external actions.
- Public-source research is manual-only, authenticated, explicitly confirmed, bounded and review-only.
- Confirmation is the exact JSON boolean `true`; query-string, numeric and string coercions are rejected.
- Confirmed research and source-management JSON bodies are media-type checked, stream-bounded, structure-bounded and SHA-256 fingerprinted.
- Public research URLs and every redirect are validated against the shared public-only network policy.
- Sensitive query credentials and binary response bodies are rejected.
- Research runs distinguish attempts from successful fetches and report skipped, failed, partial and completed outcomes truthfully.
- Opportunity extraction is deterministic, boundary-aware and evidence-quality-scored.
- Missing deadlines, values, currencies, eligibility and scope remain missing rather than being inferred.
- Historical source and review learning may calibrate grounded evidence but cannot promote weak evidence into high confidence.
- Persisted opportunity candidates are internal review records only and cannot become drafts, approvals or external actions.
- Historical draft-shaped and approval-shaped records are non-deliverable, non-executable and non-authoritative.
- Public routes expose aggregate, non-sensitive status only.
- The browser must never receive the Worker admin token.
- Tracked source is scanned for environment files, private keys, live provider-token shapes, credential-bearing URLs and non-placeholder sensitive assignments.
- Local `.env`, `.dev.vars` and Wrangler state remain ignored; only reviewed placeholder templates may be tracked.
- GitHub repository visibility must be private; current public visibility is a release and governance blocker.

The authoritative model is research-memory-first, metadata-first, review-first and non-executing.

## Zero-cost and execution architecture

GitHub-hosted validation is not part of the active execution architecture. The complete repository gate is local and is run through `npm run check:local`. The compatibility script name `worker:workflow-action-pinning:check` is retained, but it now proves that the active `.github/workflows` directory contains no hosted-runner workflows and that provider-sensitive checks remain local/read-only.

Cloudflare runtime scheduling is separate from GitHub Actions. The Worker may keep bounded internal-only Cloudflare Cron Triggers defined in `wrangler.toml`; those schedules do not grant external-research, AI, browser, drafting or outbound authority.

Provider metadata such as repository visibility is read explicitly when needed. Development Studio, Brain or an operator may run the repository-owned live visibility checker with a read-only GitHub token. No GitHub Action is required for that evidence.

## Active architecture

The Worker is organised around typed route-policy registries:

- top-level Worker route families;
- opportunity routes;
- Growth routes;
- Business Autopilot routes;
- planner and source routes;
- historical review-record and strategy-score routes;
- autonomy and legacy-safety routes.

Each policy records authentication, mutation, confirmation, network and prohibited-capability posture. The Worker dispatcher delegates through those registries rather than maintaining an unstructured pathname chain.

## Source-secret and repository posture

The Worker must remain free of deployable credentials regardless of who can read its source.

```powershell
npm run worker:source-secret-safety:check
```

The guard scans tracked text files without printing matched values. It rejects real environment files, private-key material, common live provider-token shapes, credential-bearing URLs, npm authentication tokens and non-placeholder assignments to sensitive variables.

Use `.dev.vars.example` as the local template. Copy it to the ignored `.dev.vars` file and replace placeholders only in that local file. `ADMIN_TOKEN` remains a Cloudflare server-side secret and must never be committed, exposed to browser code or placed in client-visible configuration.

GitHub currently reports this repository as **public**. The required repository posture is `private: true`, `visibility: private` and `archived: false`. Until an approved GitHub repository-administration path changes the visibility and the live check passes, repository confidentiality remains a release and governance blocker.

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

This live read performs no repository mutation and no deployment. Source-secret safety and private repository visibility are independent requirements; passing one does not prove the other.

Authoritative detailed contracts:

- `docs/worker-source-secret-posture.md`
- `docs/worker-repository-confidentiality.md`
- `docs/bounded-admin-json-boundary.md`
- `docs/public-research-fetch-boundary.md`
- `docs/opportunity-evidence-quality.md`
- `docs/manual-research-concurrency.md`

## Bounded request boundary

Manual research and source-management handlers use `src/core/boundedJsonRequest.ts` with contract:

```text
bounded_admin_json_request_v1
```

The default request-body cap is 65,536 bytes. The boundary checks declared and observed byte counts, validates strict UTF-8 JSON, requires an object root and limits nesting, node count, array size, string length and key length. Prototype-pollution keys are rejected.

A valid body produces a compact request receipt containing its contract, byte count and SHA-256 body hash. The full body is not logged or echoed.

## Public research boundary

Allowed network activity is read-only public research through explicitly classified, authenticated, confirmation-gated and bounded manual source or opportunity handlers.

All active research handlers use `src/core/publicResearchFetch.ts` with contract:

```text
public_research_fetch_v2
```

The boundary rejects non-public hosts, embedded URL credentials, sensitive query parameters, unsafe protocols and non-standard ports. Redirects are followed manually only after the next target passes the same public URL policy. Cloudflare runtime configuration also enables `global_fetch_strictly_public`.

The default response limit is 1,048,576 bytes, the default redirect limit is four and the default full-operation timeout is 12 seconds. One deadline covers redirects, response headers and streamed body reads. Binary bodies are rejected even if a remote server omits or misstates its content type.

Manual research may fetch public HTML, robots files and bounded sitemap data, save source/research evidence, update source health metadata and score review-only opportunities. It may not authenticate to third-party services, bypass controls, submit forms, send messages, post/comment, purchase advertising, mutate third-party data or invoke the deleted execution engine.

## Opportunity evidence quality

Opportunity extraction uses canonical public URLs and boundary-aware term matching. Tracking parameters are removed before deduplication. Dates and monetary values are normalized only when the evidence actually supplies the necessary information.

Each candidate reports evidence quality, evidence strength, missing facts and review flags. Confidence requires both a useful opportunity score and sufficient evidence quality. Weak evidence cannot receive a positive historical-learning promotion into high confidence.

Candidates can be persisted only with explicit review-only, non-executable and non-deliverable posture.

## Current operating documents

- `docs/worker-source-secret-posture.md`
- `docs/worker-repository-confidentiality.md`
- `docs/bounded-admin-json-boundary.md`
- `docs/public-research-fetch-boundary.md`
- `docs/opportunity-evidence-quality.md`
- `docs/manual-research-concurrency.md`
- `docs/zero-source-startup.md`
- `docs/zero-source-route-catalogue.md`
- `docs/growth-autonomous-discovery-architecture.md`
- `docs/growth-source-discovery-safety-policy.md`
- `docs/growth-zero-source-research-runbook.md`
- `docs/growth-autonomy-agent.md`
- `docs/growth-channel-policy.md`
- `docs/growth-engagement-action-model.md`
- `docs/growth-cost-governor.md`
- `docs/growth-campaign-intelligence.md`
- `docs/business-autopilot-architecture.md`
- `docs/business-autopilot-governance-policy.md`
- `docs/business-autopilot-compliance-policy.md`
- `docs/business-autopilot-data-model.md`
- `docs/business-autopilot-validation.md`
- `migrations/README.md`

Historical labels and schema families are retained only for data compatibility. They do not describe enabled drafting, approvals-to-execution, campaigns or external delivery.

## Local validation

Install dependencies and run the complete gate:

```powershell
cd C:\GitRepos\evavo-worker-agent
git pull --ff-only origin main
npm ci
npm run check:local
```

Important focused checks include:

```powershell
npm run worker:source-secret-safety:check
npm run worker:repository-visibility:check
npm run worker:workflow-action-pinning:check
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

## Deployment

The guarded deployment command is:

```powershell
npm run deploy
```

The npm `predeploy` hook runs repository-sync, generated-route, PowerShell-runner, aggregate backend and complete local validation before Wrangler deploys. A direct `wrangler deploy` bypasses npm `predeploy` and should only be used deliberately.

`ADMIN_TOKEN` is server-side only and is configured through Cloudflare, for example:

```powershell
wrangler secret put ADMIN_TOKEN
```

No email-provider secrets are used by the active Worker.

## Runtime configuration

`wrangler.toml` configures the D1 binding, bounded manual public-research capacity, strict public-only Cloudflare subrequests, an internal-only Worker schedule, brand/geographic context and a compatibility Cloudflare AI binding that active safety contracts prohibit from executing.

There are no draft or send runtime caps because those execution capabilities and modules do not exist.

## Safe zero-source workflow

When no approved source list exists:

1. Read the autonomy and runtime policy.
2. Create a bounded manual research plan.
3. Review candidate domains and crawl policy.
4. Send an authenticated request with `Content-Type: application/json` and exact `confirm: true`.
5. Run one bounded manual research action.
6. Save findings as internal review metadata only.
7. Review request/fetch receipts, run status, evidence quality, missing facts and source health manually.
8. Do not draft, send, post, submit or mutate external systems.

## Truth boundary

A passing source or local validation gate proves only the checked source contract. It does not prove the GitHub repository is private, a Cloudflare deployment is current, D1 migrations are applied, a provider credential exists, a research result is correct, or any external action is authorised. Those claims require their own fresh evidence.
