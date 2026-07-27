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

The query contract accepts only:

```text
limit: one integer from 1 through 100; omitted means 25
contactStatus: one bounded status value
```

Unknown or duplicate query fields fail closed. An omitted `limit` remains 25 rather than being coerced to one record.

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
POST /admin/business/people
Content-Type: application/json
```

Confirm route ID:

```text
business_person_save
```

The canonical request shape is:

```json
{
  "confirm": true,
  "person": {
    "name": "Reviewed person name",
    "organizationId": "optional-internal-organization-id",
    "role": "Optional public role",
    "email": "optional@example.com",
    "phone": "+61 400 000 000",
    "profileUrl": "https://www.example.com/profile",
    "sourceType": "operator",
    "sourceUrl": "https://www.example.com/about",
    "allowedUse": "review_only",
    "contactStatus": "new",
    "confidenceScore": 70,
    "metadata": {}
  }
}
```

The write boundary requires:

```text
shared ADMIN_TOKEN authentication before body parsing
bounded_admin_json_request_v1
maximum request body: 32,768 bytes
exact Boolean JSON confirmation
queryConfirmationAllowed: false
confirmationCoercionAllowed: false
exact top-level fields: confirm, person
exact reviewed person fields
required non-empty bounded name
public HTTP or HTTPS profile and source URLs
no URL credentials or sensitive query parameters
no credential-shaped keys in nested metadata
confidence score from 0 through 100
```

`?confirm=1`, `confirm: 1`, `confirm: "1"`, mixed flat/wrapped bodies, unknown fields, malformed URLs and credential-shaped metadata all fail before D1 access.

A confirmed write stores internal metadata only. Its response is also redacted and must not echo raw contact details, arbitrary metadata or the request-body hash.

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
exactBooleanConfirmation: true
confirmationCoercionAllowed: false
queryConfirmationAllowed: false
```

Database and schema failures return finite reduced diagnostics with `rawErrorExposed: false`. They do not echo the stored person, contact details, metadata or database exception text.

## Validation

Run from the Worker repo:

```powershell
cd C:\GitRepos\evavo-worker-agent
git pull --ff-only origin main

npm run business:people-response-minimisation:check
npm run business:people:docs:check
npm run business:autopilot:check
npm run test:core
npm run typecheck
npm run check:local
```

Optional route printers must include:

```text
/admin/business/people?limit=5
business_people
business_person_save
```

The printers produce review commands only. They do not call the Worker, store a person, or enable external action.
