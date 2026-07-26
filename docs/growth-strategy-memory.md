# Growth Strategy Memory

Growth Strategy Memory gives the EVAVO Growth Operator durable strategic intent. It records what EVAVO is trying to achieve, who it wants to reach, what it can credibly offer, how it should sound, and which runtime constraints govern internal planning.

This remains an internal metadata-only layer. It does not call AI, browse, send email, post content, submit forms, spend money, create calendar events or mutate external systems.

## Code and migration

```text
migrations/0016_growth_strategy_memory.sql
src/core/growthStrategyMemory.ts
src/core/growthInternalWriteRequest.ts
src/routes/growthStrategyMemoryAdmin.ts
src/core/growthAutonomousRuntime.ts
```

```powershell
cd C:\GitRepos\evavo-worker-agent
npm run db:migration:one -- 0016 --execute
```

The migration creates:

```text
growth_objectives
growth_key_results
growth_target_segments
growth_offer_profiles
growth_positioning_profiles
growth_runtime_constraints
```

## Routes

```text
GET  /admin/growth/strategy-memory
GET  /admin/growth/objectives
POST /admin/growth/objectives
GET  /admin/growth/key-results
POST /admin/growth/key-results
GET  /admin/growth/segments
POST /admin/growth/segments
GET  /admin/growth/offers
POST /admin/growth/offers
GET  /admin/growth/positioning
POST /admin/growth/positioning
GET  /admin/growth/runtime-constraints
POST /admin/growth/runtime-constraints
```

Every POST uses these shared contracts:

```text
growth_internal_write_request_v1
bounded_admin_json_request_v1
```

The request must be authenticated, use `Content-Type: application/json`, and contain an exact Boolean confirmation:

```json
{
  "confirm": true
}
```

`1`, `"1"` and query-string confirmation are not accepted. POST query parameters are rejected before body parsing or D1 access.

Bodies are bounded by bytes, depth, node count, array length, string length and key length. Credential-shaped keys such as token, secret, password, API key, private key, service-role key, authorization and cookie are rejected recursively.

Each route has an exact field set. Records can use the supported flat form or one route-specific wrapper such as `objective`, `keyResult`, `segment`, `offer`, `positioning` or `constraint`. Wrapped and flat fields cannot be mixed. Conflicting outer and inner identifiers fail closed.

Successful writes include only a reduced request receipt:

```text
contractVersion: growth_internal_write_request_v1
bodySha256Available: true
exactBooleanConfirmation: true
```

The body hash itself is not returned. Database and migration failures use finite response codes without raw database messages.

Absent list-limit parameters retain the documented route fallback, normally 25 records and 50 for key results and runtime constraints. Missing limits are not coerced to zero and clamped to one.

Run the wiring and route-catalogue helpers before deployment checks:

```powershell
npm run growth:wiring:apply
npm run growth:route-catalogue:apply
```

## What each object means

### Objectives

Objectives are top-level Growth outcomes, such as building a reviewed opportunity pipeline or increasing qualified visibility for EVAVO services.

### Key results

Key results are measurable targets linked to objectives, such as reviewed high-fit opportunities, qualified replies or booked discovery conversations. They remain internal measurements and cannot trigger delivery.

### Target segments

Target segments describe who EVAVO wants the research system to look for. Relevant fields include geography, industry, company size, buyer roles, pain points, priority and status.

### Offer profiles

Offer profiles describe services EVAVO can credibly offer, proof points, suitable segments, risks and priority. They do not authorise proposals or external outreach.

### Positioning profiles

Positioning profiles hold voice notes, value propositions, preferred angles, proof assets and phrases to avoid. They support consistent internal reasoning. AI drafting remains disabled.

### Runtime constraints

Runtime constraints are hard or soft operating rules, for example:

```text
No external action without explicit approval.
No sending while external delivery is blocked.
No AI drafting until evidence and version controls exist.
No claim without evidence.
No paid-service call in zero-paid-service mode.
```

## Autonomy compatibility view

`GET /admin/growth/autonomy` loads Strategy Memory and reports strategic intent, knowledge substrate and missing setup blockers such as:

```text
missing_objectives
missing_target_segments
missing_offer_profiles
missing_positioning_profiles
missing_runtime_constraints
missing_knowledge_substrate
```

The historical contract name `growth_autonomous_runtime_v3_strategy_blackboard` is compatibility naming. It reports internal reasoning readiness only. It does not confer permission to call AI, browse or execute externally.

## Safety posture

All Strategy Memory routes retain:

```text
internalMetadataOnly: true
externalStateChange: false
callsAI: false
callsNetwork: false
canSendEmail: false
canPostSocial: false
canSubmitForms: false
rawErrorExposed: false
queryConfirmationAllowed: false
confirmationCoercionAllowed: false
sensitiveInputKeysAllowed: false
```

Strategy Memory tells the operator what EVAVO is trying to achieve; it does not give the system external execution authority. External execution remains blocked until separately designed channel adapters, suppression checks, permissions, idempotency, audit and owner approval contracts exist.

## Local verification

```powershell
cd C:\GitRepos\evavo-worker-agent
git pull --ff-only origin main

node scripts/check-growth-strategy-memory.mjs
node --test tests/growthStrategyMemoryWriteBoundary.test.ts

npm run growth:wiring:apply
npm run growth:route-catalogue:apply
npm run db:migrations:check
npm run growth:strategy:check
npm run test:core
npm run check:local
npm run typecheck
```

The strategy smoke helper remains:

```powershell
npm run growth:strategy:smoke:print
```

It seeds one objective, key result, target segment, offer profile, positioning profile and runtime constraint, then reads the protected Strategy Memory and autonomy compatibility views.
