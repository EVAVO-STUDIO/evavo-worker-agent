# Growth backend validation

This document records the preferred local validation flow for the Worker side of EVAVO Growth Ops and Business Autopilot.

## Safety posture

The Worker is the backend source of truth for Growth route metadata, Business Autopilot route metadata, and the inner payload safety posture consumed by the Next read-only proxy console.

Current Worker read safety requirements:

```text
readOnly: true
internalMetadataOnly: true
externalStateChange: false
callsAI: false
callsNetwork: false
canSendEmail: false
canPostSocial: false
canSubmitForms: false
```

Legacy compatibility fields must also remain false where present:

```text
sendsEmail: false
postsPublicly: false
submitsForms: false
```

Confirmed metadata-write routes must remain server-side only, require explicit confirmation, and advertise metadata-only posture. They must not send email, post socially, submit forms, browse, call AI, call arbitrary network actions, execute browser actions, or perform external state changes.

## Backend responsibility boundary

The Worker owns the backend contract for:

```text
route catalogue metadata
inner Worker payload safety posture
confirmation-gated metadata-write route posture
legacy compatibility safety flags
backend final validation printer
Worker final local gate
Worker PowerShell runner checks
generated route wiring clean checks
autonomous discovery metadata-only routes
autonomous discovery route-contract checks
Business Autopilot metadata-only routes
Business people metadata route docs
Business website/page metadata route docs
Business Autopilot route-contract checks
```

The autonomous discovery backend contract includes:

```text
migrations/0020_growth_autonomous_discovery.sql
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

The Business Autopilot backend contract includes:

```text
migrations/0021_business_autopilot_foundation.sql
business_organizations
business_people
business_websites
business_pages
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

The Worker must keep these safety guarantees true for every Growth and Business route catalogue entry and metadata-write route:

```text
no AI calls
no arbitrary network calls
no email sending
no social posting
no third-party commenting
no form submission
no browser execution
no external state change
```

The Next repo may display and verify this backend posture, but the Worker remains the source of truth for route catalogue metadata and inner Worker payload safety.

## Automated workflow gate

The Worker repository has an automated GitHub Actions gate for Growth backend changes:

```text
.github/workflows/growth-backend-validation.yml
```

Detailed workflow requirements live in:

```text
docs/growth-backend-workflow-gate.md
```

That workflow runs on pull requests and main-branch pushes, uses Node 24, installs with `npm ci`, runs `npm run growth:backend:aggregate:check`, runs `npm run business:people:docs:check`, runs `npm run business:website-pages:docs:check`, runs `npm run worker:powershell:check`, runs `npm run growth:generated-routes:check`, prints `npm run worker:final-gate:print`, runs `npm run growth:backend:check:local`, and prints `npm run growth:backend:final:print`.

## Preferred local aggregate check

Run this from PowerShell after pulling the latest repo:

```powershell
cd C:\GitRepos\evavo-worker-agent
git pull
npm run growth:wiring:apply
npm run growth:route-catalogue:apply
npm run growth:backend:check:local
```

`growth:backend:check:local` first runs the aggregate command contract checker, then runs the existing full backend local check:

```powershell
npm run growth:backend:aggregate:check
npm run check:local
```

The aggregate command contract checker validates the Worker backend validation docs, the backend final printer tokens, the Worker final local gate printer, the README runbook, the generated route wiring checker, the PowerShell runner checker, and the expected package script wiring.

The backend local check expands to helper-script parsing, migration presence, Business Autopilot foundation checks, Business Autopilot raw-error safety checks, Business people docs checks, Business website/page docs checks, Worker PowerShell runner checks, route delegates, route safety flags, capability registry, campaign intelligence, strategy memory, blackboard, review queue, autonomous discovery, and TypeScript validation.

```powershell
npm run scripts:check
npm run db:migrations:check
npm run business:autopilot:check
npm run business:autopilot:raw-error-safety:check
npm run business:people:docs:check
npm run business:website-pages:docs:check
npm run worker:powershell:check
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

## Worker final local gate

Use this when you want the final non-migration local gate printed before deploy:

```powershell
npm run worker:final-gate:print
```

The final local gate does not rerun migrations 0021 or 0022. It prints the sequence that checks local contracts, runs `npm run worker:powershell:check`, runs `npm run growth:generated-routes:check`, runs `npm run check:local`, runs `npm run growth:backend:check:local`, prints `npm run db:verify:print`, and leaves `npm run deploy` as a manual guarded Worker deploy step.

## Guarded PowerShell runner

On Windows, the equivalent runnable gate is:

```powershell
.\Run-WorkerFinalGate.ps1
```

That script also avoids rerunning migrations. It runs the same checks, prints D1 verification commands, and stops before deploy. `npm run deploy` then runs the npm `predeploy` guard before invoking the underlying Cloudflare Worker command, `wrangler deploy`.

The autonomous discovery check guards:

```text
growth autonomous discovery architecture docs
growth source discovery safety policy
growth zero-source research runbook
migrations/0020_growth_autonomous_discovery.sql
autonomous discovery records helpers
autonomous discovery admin routes
autonomous discovery route catalogue entries
autonomous discovery route-contract printer coverage
canPostSocial false and canSubmitForms false route defaults
```

The Business people docs check guards:

```text
docs/business-autopilot-people-routes.md
docs/business-autopilot-data-model.md
docs/business-autopilot-validation.md
business_people
business_person_save
/admin/business/people
```

The Business website/page docs check guards:

```text
docs/business-autopilot-data-model.md
docs/business-autopilot-website-page-routes.md
docs/business-autopilot-validation.md
business_websites
business_pages
business_website_save
business_page_save
/admin/business/websites
/admin/business/pages
```

## Final backend validation printer

Use this when you want the deploy-and-smoke command set printed for the Worker:

```powershell
npm run growth:backend:final:print
```

The final printer now prefers the aggregate backend check before deploy and references the Worker final local gate before the deploy-and-smoke path.
