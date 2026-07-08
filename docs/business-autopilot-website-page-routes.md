# Business Autopilot website and page routes

This document records the Worker-side Business Autopilot website/page/audit metadata route layer.

## Purpose

Business website, page, audit run, audit observation and audit observation candidate records provide internal metadata memory for the agency intelligence flow:

```text
organization
→ website
→ page
→ signal
→ website audit run
→ audit observation
→ audit observation candidate
→ opportunity
→ audit pack
→ draft-only action
→ approval request
```

These routes are metadata-only. They do not crawl, fetch, send, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems.

The audit observation candidate route is read-only. It derives unsaved review candidates from stored internal metadata only. It does not save records, crawl websites, fetch pages, call AI, send email, post, submit forms, automate a browser, buy ads or mutate external systems.

## Tables

```text
business_websites
business_pages
business_website_audit_runs
business_audit_observations
```

Audit observation candidates are computed from existing internal metadata and are not stored in a dedicated table.

## Core files

```text
src/core/businessAutopilotWebsiteRecords.ts
src/core/businessAutopilotAuditObservationCandidates.ts
src/routes/businessAutopilotWebsiteAdmin.ts
src/routes/businessAutopilotRouteCatalogue.ts
src/index.ts
```

## Read routes

```text
GET /admin/business/websites?limit=25
GET /admin/business/pages?limit=25
GET /admin/business/website-audit-runs?limit=25
GET /admin/business/audit-observations?limit=25
GET /admin/business/audit-observation-candidates?limit=25
```

Read route IDs:

```text
business_websites
business_pages
business_website_audit_runs
business_audit_observations
business_audit_observation_candidates
```

Expected read payload safety:

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

## Confirm metadata-write routes

```text
POST /admin/business/websites?confirm=1
POST /admin/business/pages?confirm=1
POST /admin/business/website-audit-runs?confirm=1
POST /admin/business/audit-observations?confirm=1
```

Confirm route IDs:

```text
business_website_save
business_page_save
business_website_audit_run_save
business_audit_observation_save
```

Unconfirmed writes must return `confirm_required`.

Confirm route safety:

```text
readOnly: false
internalMetadataOnly: true
externalStateChange: false
callsAI: false
callsNetwork: false
canSendEmail: false
canPostSocial: false
canCommentSocial: false
canSubmitForms: false
canExecuteBrowserActions: false
canBuyAds: false
canMutateExternalSystems: false
```

## Observation candidate behaviour

`GET /admin/business/audit-observation-candidates?limit=25` returns review-only candidate records under `observationCandidates`.

Candidate sources:

```text
stored business_websites
stored business_pages
stored business_signals
stored business_website_audit_runs
stored business_audit_observations
```

Candidate examples:

```text
signal evidence without a saved observation
website audit run without a saved observation
website metadata without structured page coverage
```

Candidates are prompts for operator review only. They do not become durable observations until a separate confirmed metadata save writes `business_audit_observations`.

## Validation

Run from the Worker repo:

```powershell
cd C:\GitRepos\evavo-worker-agent
git pull
npm run business:autopilot:check
npm run business:route-contract:print
npm run business:autopilot:readonly:print
```

The route-contract and read-only printers must include:

```text
/admin/business/websites?limit=5
/admin/business/pages?limit=5
/admin/business/website-audit-runs?limit=5
/admin/business/audit-observations?limit=5
/admin/business/audit-observation-candidates?limit=5
business_websites
business_pages
business_website_audit_runs
business_audit_observations
business_audit_observation_candidates
business_website_save
business_page_save
business_website_audit_run_save
business_audit_observation_save
```
