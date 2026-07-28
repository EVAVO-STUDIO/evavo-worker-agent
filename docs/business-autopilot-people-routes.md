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
src/core/businessRoutePaths.ts
src/core/businessMetadataReadBoundary.ts
src/core/businessMetadataWriteBoundary.ts
src/core/businessAutopilotPeopleRecords.ts
src/routes/businessAutopilotPeopleAdmin.ts
src/routes/businessAutopilotRouteCatalogue.ts
src/index.ts
```

The people route uses the canonical `BUSINESS_PEOPLE_PATH` constant. It does not maintain a second route literal or a private copy of the generic read/write boundary logic.

## Read route

```text
GET /admin/business/people?limit=25
```

Read route ID:

```text
business_people
```

All Business GET requests first pass the family-wide structural preflight. The people handler then uses the shared semantic query contract:

```text
business_metadata_read_query_v1
```

The people query accepts only:

```text
limit: one integer from 1 through 100; omitted means 25
contactStatus: one bounded status value
```

Unknown or duplicate query fields fail closed. Query strings, parameter count, key length, value length and control characters are bounded before D1 access. An omitted `limit` remains 25 rather than being coerced to one record.

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
queryContract: business_metadata_read_query_v1
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

The shared write contract is:

```text
business_metadata_write_boundary_v1
```

It is backed by:

```text
bounded_admin_json_request_v1
```

The write boundary requires:

```text
shared ADMIN_TOKEN authentication before body parsing
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

The shared boundary handles media type, request size, JSON structure, confirmation, top-level shape, field allowlists, credential-shaped keys and primitive field types. The people-specific semantic layer then validates identifier syntax, maximum field lengths and public URL safety before persistence.

`?confirm=1`, `confirm: 1`, `confirm: "1"`, mixed flat/wrapped bodies, unknown fields, malformed URLs and credential-shaped metadata all fail before D1 access.

A confirmed write stores internal metadata only. Its response is also redacted and must not echo raw contact details, arbitrary metadata or the request-body hash. The reduced request receipt reports the shared boundary contract and byte count but never the SHA-256 body hash.

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
requestReceipt.boundaryContract: business_metadata_write_boundary_v1
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

The focused behavioural contract is:

```text
tests/businessPeopleWriteBoundary.test.ts
```

It verifies authentication ordering, shared read-query parsing, shared bounded writes, exact confirmation, field allowlists, credential-key rejection, reduced request receipts, D1 access ordering, contact minimisation and finite database failures.

Optional route printers must include:

```text
/admin/business/people?limit=5
business_people
business_person_save
```

The printers produce review commands only. They do not call the Worker, store a person, or enable external action.
