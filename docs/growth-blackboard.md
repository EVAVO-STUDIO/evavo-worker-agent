# Growth Blackboard

The Growth Blackboard is the internal knowledge substrate for the EVAVO Growth Operator.

It is not an execution layer. It stores structured internal metadata that helps the operator reason about strategy, campaigns, proof assets, market context, and entity relationships before any future approval-gated external action exists.

## Safety posture

All Growth Blackboard routes are internal admin routes.

- No email sending
- No social posting
- No form submission
- No browser execution
- No AI calls
- No network calls
- No external state changes
- Writes require `confirm=1`

The current system remains supervised internal metadata only.

## Migration

Apply:

```powershell
npm run db:migration:one -- 0017 --execute
```

Migration file:

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

### `growth_blackboard_facts`

Stores structured statements the operator can use later for reasoning.

Examples:

```text
EVAVO uses calm premium practical positioning.
EVAVO should avoid hype-led language.
A segment pain point supports a specific offer.
A proof asset supports a campaign angle.
```

Important fields:

```text
fact_type
subject_type
subject_id
subject_name
predicate
object_type
object_id
object_name
summary
evidence_refs_json
confidence_score
source
status
```

### `growth_entities`

Stores internal entities such as EVAVO, segments, offers, companies, sectors, proof assets, or future approved contacts.

Important fields:

```text
entity_type
name
canonical_url
description
attributes_json
status
```

### `growth_entity_relationships`

Links entities together.

Examples:

```text
EVAVO -> strategy_fit -> Australian B2B services
Offer -> best_for -> target segment
Proof asset -> supports -> offer
```

Important fields:

```text
from_entity_id
to_entity_id
relationship_type
summary
confidence_score
status
```

### `growth_market_signals`

Stores market or segment notes that can later support campaign decisions.

Important fields:

```text
signal_type
segment_id
segment_name
offer_id
offer_name
summary
source_url
evidence_refs_json
strength_score
freshness_score
status
```

### `growth_asset_inventory`

Stores internal proof assets, service pages, case studies, demos, examples, or capability evidence.

Important fields:

```text
asset_type
name
url
summary
best_for_segments_json
best_for_offers_json
proof_points_json
status
```

## Admin routes

Read routes:

```text
GET /admin/growth/blackboard
GET /admin/growth/blackboard/facts?limit=50
GET /admin/growth/blackboard/entities?limit=50
GET /admin/growth/blackboard/relationships?limit=50
GET /admin/growth/blackboard/signals?limit=50
GET /admin/growth/blackboard/assets?limit=50
```

Write routes:

```text
POST /admin/growth/blackboard/facts?confirm=1
POST /admin/growth/blackboard/entities?confirm=1
POST /admin/growth/blackboard/relationships?confirm=1
POST /admin/growth/blackboard/signals?confirm=1
POST /admin/growth/blackboard/assets?confirm=1
```

Every write is confirm-gated and metadata only.

## Cycle integration

`GET /admin/growth/cycle` now includes a `blackboard` section.

Contract version:

```text
growth_operator_cycle_v3_strategy_blackboard_read_only
```

The cycle reports:

```text
blackboard.complete
blackboard.missing
blackboard.counts
blackboard.facts
blackboard.entities
blackboard.marketSignals
blackboard.assets
```

The cycle can block readiness with:

```text
missing_blackboard_facts
missing_growth_entities
missing_entity_relationships
missing_market_signals
missing_asset_inventory
```

## Autonomy integration

`GET /admin/growth/autonomy` now includes `knowledgeSubstrate`.

Contract version:

```text
growth_autonomous_runtime_v3_strategy_blackboard
```

The autonomy runtime reports:

```text
knowledgeSubstrate.complete
knowledgeSubstrate.missing
knowledgeSubstrate.counts
knowledgeSubstrate.facts
knowledgeSubstrate.entities
knowledgeSubstrate.marketSignals
knowledgeSubstrate.assets
```

The runtime can block with:

```text
missing_knowledge_substrate
```

Governance reports:

```text
governance.hasKnowledgeSubstrate
```

## Local checks

Run:

```powershell
npm run growth:blackboard:check
```

This validates blackboard migration, core service, routes, and route wiring tokens.

Full local check:

```powershell
npm run check:local
```

## Smoke flow

Print smoke commands:

```powershell
npm run growth:blackboard:smoke:print
```

The smoke flow seeds internal metadata only:

```text
studio entity
target segment entity
studio-to-segment relationship
positioning fact
market signal
proof asset
```

Then it verifies `GET /admin/growth/blackboard` includes at least:

```text
1 fact
2 entities
1 relationship
1 market signal
1 asset
```

## Intended next layer

The blackboard is the bridge between raw strategy memory and future approval-gated operator actions. Before drafting, browsing, sending, posting, or form submission exists, the operator should have enough internal knowledge to explain:

- what EVAVO is trying to achieve
- who EVAVO is targeting
- which offers and proof assets support that target
- what known market signals support the campaign
- what evidence or assumptions are being used
- what is still missing

External execution remains blocked until approval, suppression, caps, identity, audit, and channel-specific governance are implemented.
