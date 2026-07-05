# Business Autopilot people routes

This document records the Worker-side Business Autopilot people metadata route layer.

## Purpose

Business people records provide internal contact-context metadata for the agency intelligence flow:

```text
organization
→ person
→ allowed-use review
→ contactability check
→ signal / opportunity context
→ draft-only action
→ approval request
```

These routes are metadata-only. They do not enrich contacts, scrape profiles, send email, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems.

## Table

```text
business_people
```

Important fields:

```text
organization_id
name
role
email
phone
profile_url
source_type
source_url
allowed_use
contact_status
confidence_score
metadata_json
```

## Core files

```text
src/core/businessAutopilotPeopleRecords.ts
src/routes/businessAutopilotPeopleAdmin.ts
src/routes/businessAutopilotRouteCatalogue.ts
src/index.ts
```

## Read route

```text
GET /admin/business/people?limit=25
```

Read route ID:

```text
business_people
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

## Confirm metadata-write route

```text
POST /admin/business/people?confirm=1
```

Confirm route ID:

```text
business_person_save
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
/admin/business/people?limit=5
business_people
business_person_save
```
