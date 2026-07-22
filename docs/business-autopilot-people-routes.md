# Business Autopilot people routes

This document records the Worker-side Business Autopilot people metadata route layer.

## Purpose

Business people records provide internal business-context metadata for review:

```text
organization
→ person identity and role
→ allowed-use review
→ contactability classification
→ signal / opportunity context
→ manual internal review
```

These routes are metadata-only. They do not enrich contacts, scrape profiles, send email, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems.

## Storage and response boundary

The durable compatibility table remains:

```text
business_people
```

Stored fields may include:

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

Storage does not grant permission to contact, enrich or act on a person.

Worker HTTP responses apply data minimisation. Raw contact details and arbitrary metadata are not returned by the people routes. Both read and confirmed-write responses set:

```text
email: null
phone: null
profileUrl: null
sourceUrl: null
metadata: {}
contactDetailsRedacted: true
metadataRedacted: true
emailPresent: boolean
phonePresent: boolean
profileUrlPresent: boolean
sourceUrlPresent: boolean
internalReviewOnly: true
executable: false
deliverable: false
authoritativeForExecution: false
```

Presence flags indicate only whether a value exists in storage. They do not reveal the value and do not authorise outreach.

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
contactDetailsRedacted: true
metadataRedacted: true
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

A confirmed write stores internal metadata only. Its response is also redacted and must not echo raw contact details or arbitrary metadata.

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
contactDetailsRedacted: true
metadataRedacted: true
```

## Validation

Run from the Worker repo:

```powershell
cd C:\GitRepos\evavo-worker-agent
git pull
npm run business:people-response-minimisation:check
npm run business:people:docs:check
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
