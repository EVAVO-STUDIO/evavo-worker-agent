# Growth Blackboard

The Growth Blackboard is the internal knowledge substrate for the EVAVO Growth Operator. It stores structured facts, entities, relationships, market signals and proof assets that support evidence-backed decisions.

It is not an execution layer. It does not call AI, browse, send email, post content, submit forms, create calendar events, write providers or mutate external systems.

## Migration and tables

```powershell
cd C:\GitRepos\evavo-worker-agent
npm run db:migration:one -- 0017 --execute
```

Migration:

```text
migrations/0017_growth_blackboard.sql
```

Tables:

```text
growth_blackboard_facts
growth_entities
growth_entity_relationships
growth_market_signals
growth_asset_inventory
```

## Data model

### Facts

`growth_blackboard_facts` stores evidence-linked internal statements about EVAVO, target segments, offers, market context and proof. Important fields include subject and object references, predicate, summary, evidence references, confidence, source and status.

### Entities

`growth_entities` stores internal entities such as EVAVO, companies, sectors, segments, offers and proof assets. It records type, name, canonical URL, description, bounded attributes and status.

### Relationships

`growth_entity_relationships` links saved entities, for example:

```text
EVAVO -> strategy_fit -> Australian B2B services
Offer -> best_for -> target segment
Proof asset -> supports -> offer
```

### Market signals

`growth_market_signals` stores bounded market or segment observations with source references, evidence references, strength, freshness and status. A saved signal is internal evidence, not permission to contact anyone.

### Asset inventory

`growth_asset_inventory` stores internal proof assets, service pages, case studies, demos and capability evidence together with their suitable segments, offers and proof points.

## Admin routes

Read routes:

```text
GET /admin/growth/blackboard
GET /admin/growth/blackboard/facts
GET /admin/growth/blackboard/entities
GET /admin/growth/blackboard/relationships
GET /admin/growth/blackboard/signals
GET /admin/growth/blackboard/assets
```

Write routes:

```text
POST /admin/growth/blackboard/facts
POST /admin/growth/blackboard/entities
POST /admin/growth/blackboard/relationships
POST /admin/growth/blackboard/signals
POST /admin/growth/blackboard/assets
```

Every POST uses:

```text
growth_internal_write_request_v1
bounded_admin_json_request_v1
```

The request must be authenticated, use `Content-Type: application/json`, and include an exact Boolean confirmation:

```json
{
  "confirm": true
}
```

Numeric or string confirmation is rejected. POST query parameters are rejected before body parsing or D1 access.

Bodies are bounded by bytes, depth, node count, array length, string length and key length. Credential-shaped keys are rejected recursively. The blackboard routes never accept tokens, secrets, passwords, API keys, private keys, service-role keys, authorization values or cookies as metadata.

Each route has an exact field set. Input may use the supported flat form or one route-specific wrapper:

```text
fact
entity
relationship
signal
asset
```

Wrapped and flat fields cannot be mixed. Conflicting outer and inner identifiers fail closed. Unexpected fields are rejected rather than silently stored or discarded.

Successful writes return a reduced request receipt stating that the bounded body hash was available and exact confirmation passed. The hash itself is not returned. Database and migration failures use finite errors without raw database messages.

Read routes use a documented 50-record fallback when `limit` is absent. A missing query parameter is not coerced to zero and clamped to one.

## Cycle integration

`GET /admin/growth/cycle` includes a Blackboard section under:

```text
growth_operator_cycle_v3_strategy_blackboard_read_only
```

The cycle reports completeness, missing setup, counts and bounded saved knowledge. It may identify blockers such as:

```text
missing_blackboard_facts
missing_growth_entities
missing_entity_relationships
missing_market_signals
missing_asset_inventory
```

Those are internal readiness observations only.

## Autonomy compatibility view

`GET /admin/growth/autonomy` includes `knowledgeSubstrate` under the historical compatibility contract:

```text
growth_autonomous_runtime_v3_strategy_blackboard
```

The runtime can report `missing_knowledge_substrate` and `governance.hasKnowledgeSubstrate`. Those fields do not grant AI, network or execution capability.

## Safety posture

All Blackboard routes retain:

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

The Blackboard is useful because it makes facts, assumptions, evidence and missing context explicit before any high-risk action is considered. It cannot draft, publish or deliver anything. External execution remains blocked until separately designed approval, suppression, identity, idempotency, audit and channel-specific adapter contracts exist.

## Local verification

```powershell
cd C:\GitRepos\evavo-worker-agent
git pull --ff-only origin main

node scripts/check-growth-blackboard.mjs
node --test tests/growthBlackboardWriteBoundary.test.ts

npm run growth:blackboard:check
npm run growth:blackboard:smoke:print
npm run test:core
npm run check:local
npm run typecheck
```

The smoke flow seeds internal metadata only: studio and segment entities, a relationship, a positioning fact, a market signal and a proof asset. It then verifies the protected Blackboard read model without enabling any external action.
