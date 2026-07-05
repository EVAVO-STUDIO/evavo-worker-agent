# Business Autopilot website and page routes

This document records the Worker-side Business Autopilot website/page metadata route layer.

## Purpose

Business website and page records provide internal metadata memory for the agency intelligence flow:

```text
organization
→ website
→ page
→ signal
→ opportunity
→ audit pack
→ draft-only action
→ approval request
```

These routes are metadata-only. They do not crawl, fetch, send, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems.

## Tables

```text
business_websites
business_pages
```

## Core files

```text
src/core/businessAutopilotWebsiteRecords.ts
src/routes/businessAutopilotWebsiteAdmin.ts
src/routes/businessAutopilotRouteCatalogue.ts
src/index.ts
```

## Read routes

```text
GET /admin/business/websites?limit=25
GET /admin/business/pages?limit=25
```

Read route IDs:

```text
business_websites
business_pages
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
```

Confirm route IDs:

```text
business_website_save
business_page_save
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
business_websites
business_pages
business_website_save
business_page_save
```
