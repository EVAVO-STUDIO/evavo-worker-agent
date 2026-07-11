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

## Final local gate

After migrations have already been applied, do not rerun them. Use the final gate printer or PowerShell runner to validate the Worker before deploy:

```powershell
cd C:\GitRepos\evavo-worker-agent
git pull
npm run worker:final-gate:print
.\Run-WorkerFinalGate.ps1
```

The final gate runs local helper, migration-presence, Business Autopilot, raw-error safety, people docs, website/page docs, aggregate backend and TypeScript checks, then prints D1 verification commands. It stops before deployment. Deploy manually only after the gate passes:

```powershell
npm run deploy
```

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
- Growth goals, strategy, channels, signals, actions, campaigns, metrics, evidence, learning, strategy memory, blackboard writes, approval records, autonomous discovery metadata writes, and Business Autopilot metadata writes require explicit confirmation and are metadata-only
- Budget counters, run history, approval requests, autonomous discovery research memory, and Business Autopilot agency memory are tracked in D1 once migrations are applied

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

## Business Autopilot summary

Business Autopilot extends Growth Ops into broader agency intelligence and operating memory.

Business Autopilot: metadata-only agency intelligence, website/funnel audit memory, draft preparation, approval governance, and learning support for EVAVO.

It is currently internal metadata only: it stores organizations, people/contact context, websites, pages, website/funnel audit runs, audit observations, evidence signals, opportunities, EVAVO service matches, audit packs, draft-only action records, approval requests, suppression records, content ideas, follow-ups and learning events. It also exposes computed audit observation candidates from stored internal metadata only.

Core Business Autopilot modules:

```text
businessAutopilotSafety
businessAutopilotTypes
businessAutopilotServiceMatcher
businessAutopilotOpportunityScoring
businessAutopilotAuditPacks
businessAutopilotAuditPackRecords
businessAutopilotActionDraftBuilder
businessAutopilotApprovalBuilder
businessAutopilotDraftReviewBundle
businessAutopilotPeopleRecords
businessAutopilotWebsiteRecords
businessAutopilotAuditObservationCandidates
businessAutopilotRecords
businessAutopilotAdmin
businessAutopilotPeopleAdmin
businessAutopilotWebsiteAdmin
businessAutopilotRouteCatalogue
```

Current Business Autopilot route IDs:

```text
business_organizations
business_people
business_websites
business_pages
business_website_audit_runs
business_audit_observations
business_audit_observation_candidates
business_signals
business_opportunities
business_service_matches
business_audit_packs
business_action_drafts
business_approval_requests
business_suppression_list
business_content_ideas
business_followups
business_learning_events
business_organization_save
business_person_save
business_website_save
business_page_save
business_website_audit_run_save
business_audit_observation_save
business_signal_save
business_opportunity_save
business_service_match_save
business_audit_pack_save
business_action_draft_build
business_action_draft_save
business_approval_request_save
business_suppression_save
business_content_idea_save
business_followup_save
business_learning_event_save
```

Current Business Autopilot guarantees:

```text
internal metadata only
read-only routes advertise readOnly and internalMetadataOnly
metadata-write routes require confirm=1
draft builder is draft-only
approval records are review records only
suppression remains higher priority than approval
computed audit observation candidates are review-only and unsaved
no email sending
no social posting
no third-party commenting
no contact-form submission
no browser execution
no ad buying
no external mutation
no AI calls from metadata routes
no network calls from metadata routes
```

Business Autopilot validation commands:

```powershell
npm run business:operator:runbook:print
npm run business:autopilot:check
npm run business:autopilot:raw-error-safety:check
npm run business:route-contract:print
npm run business:autopilot:readonly:print
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
Business Autopilot agency memory
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
6. Read Business Autopilot agency memory: organizations, people, websites, pages, website/funnel audit runs, audit observations, observation candidates, evidence signals, opportunities, service matches, audit packs, action drafts, approval requests, suppression records, content ideas, follow-ups and learning events.
7. Confirm-save Business Autopilot metadata: organizations, people, websites, pages, website/funnel audit runs, audit observations, signals, opportunities, service matches, audit packs, draft-only action records, approval records, suppression records, content ideas, follow-ups and learning events.
8. Build draft-only Business actions from evidence with explicit external-action blocks.
9. Build approval-review bundles for draft-only actions without external execution.
10. Confirm-save campaign, experiment, decision, metric, evidence, feedback, learning, strategy, blackboard, autonomous-discovery and Business Autopilot metadata.
11. Continue to block email sending, social posting, contact-form submission, arbitrary browser automation, ad buying, external mutation, AI calls and arbitrary network calls unless a later governed execution layer explicitly enables them.

Run the guarded core Worker checks:

```powershell
npm run growth:backend:check:local
```

Print useful backend verification commands:

```powershell
npm run growth:backend:workflow:print
npm run growth:backend:final:print
npm run growth:route-contract:print
npm run business:route-contract:print
npm run business:autopilot:readonly:print
npm run growth:campaigns:smoke:print
npm run growth:strategy:smoke:print
npm run growth:blackboard:smoke:print
```
