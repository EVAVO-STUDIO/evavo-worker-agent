# Growth Campaign Intelligence Brain

This is the campaign, analysis, decision, loop, cycle, and cycle-memory layer for the EVAVO Growth Operator.

It began as the first large-step architecture layer for campaign intelligence, but the current Worker brain now reads from three connected internal memory layers:

```text
campaign intelligence
strategy memory
blackboard knowledge
```

The implementation is intentionally internal metadata only. It does not deliver messages, publish content, submit browser steps, call AI, browse, or perform network research.

## Current contracts

Main cycle contract:

```text
growth_operator_cycle_v3_strategy_blackboard_read_only
```

Autonomy contract:

```text
growth_autonomous_runtime_v3_strategy_blackboard
```

These contracts mean the Worker can read campaign state, strategic intent, and blackboard knowledge together, then choose the safest next internal metadata step.

## Code

```text
migrations/0014_growth_campaign_intelligence.sql
migrations/0015_growth_operator_cycle_events.sql
migrations/0016_growth_strategy_memory.sql
migrations/0017_growth_blackboard.sql
src/core/growthCampaignAnalysis.ts
src/core/growthCampaignIntelligence.ts
src/core/growthCampaignDecisions.ts
src/core/growthCampaignRecords.ts
src/core/growthOperatorLoop.ts
src/core/growthOperatorCycle.ts
src/core/growthOperatorCycleEvents.ts
src/core/growthStrategyMemory.ts
src/core/growthBlackboard.ts
src/core/growthAutonomousRuntime.ts
src/routes/growthCampaignIntelligenceAdmin.ts
src/routes/growthStrategyMemoryAdmin.ts
src/routes/growthBlackboardAdmin.ts
```

## Migrations

```powershell
cd C:\GitRepos\evavo-worker-agent
npm run db:migration:one -- 0014 --execute
npm run db:migration:one -- 0015 --execute
npm run db:migration:one -- 0016 --execute
npm run db:migration:one -- 0017 --execute
```

## Tables

Campaign intelligence tables:

```text
growth_campaigns
growth_experiments
growth_campaign_metrics
growth_decisions
growth_candidate_actions
growth_evidence_items
growth_learning_notes
growth_operator_cycle_events
```

Strategy memory tables:

```text
growth_objectives
growth_key_results
growth_target_segments
growth_offer_profiles
growth_positioning_profiles
growth_runtime_constraints
```

Blackboard tables:

```text
growth_blackboard_facts
growth_entities
growth_entity_relationships
growth_market_signals
growth_asset_inventory
```

## Intended routes

Campaign and cycle routes:

```text
GET  /admin/growth/operator
GET  /admin/growth/autonomy
GET  /admin/growth/cycle
GET  /admin/growth/cycle/events
POST /admin/growth/cycle/record?confirm=1

GET  /admin/growth/campaigns
POST /admin/growth/campaigns?confirm=1

GET  /admin/growth/experiments
POST /admin/growth/experiments?confirm=1

GET  /admin/growth/decisions
POST /admin/growth/decisions/plan?confirm=1

GET  /admin/growth/metrics
POST /admin/growth/metrics?confirm=1

GET  /admin/growth/evidence
POST /admin/growth/evidence?confirm=1

GET  /admin/growth/learning
POST /admin/growth/learning?confirm=1
```

Strategy routes:

```text
GET  /admin/growth/strategy-memory
GET  /admin/growth/objectives
POST /admin/growth/objectives?confirm=1
GET  /admin/growth/key-results
POST /admin/growth/key-results?confirm=1
GET  /admin/growth/segments
POST /admin/growth/segments?confirm=1
GET  /admin/growth/offers
POST /admin/growth/offers?confirm=1
GET  /admin/growth/positioning
POST /admin/growth/positioning?confirm=1
GET  /admin/growth/runtime-constraints
POST /admin/growth/runtime-constraints?confirm=1
```

Blackboard routes:

```text
GET  /admin/growth/blackboard
GET  /admin/growth/blackboard/facts
POST /admin/growth/blackboard/facts?confirm=1
GET  /admin/growth/blackboard/entities
POST /admin/growth/blackboard/entities?confirm=1
GET  /admin/growth/blackboard/relationships
POST /admin/growth/blackboard/relationships?confirm=1
GET  /admin/growth/blackboard/signals
POST /admin/growth/blackboard/signals?confirm=1
GET  /admin/growth/blackboard/assets
POST /admin/growth/blackboard/assets?confirm=1
```

Wire these paths in `src/index.ts` before the generic `/admin/growth/` branch by running:

```powershell
npm run growth:wiring:apply
```

Add the route catalogue entries by running:

```powershell
npm run growth:route-catalogue:apply
```

## Decision planner

The deterministic planner uses a game-AI-inspired utility model. It considers campaign state, experiment state, latest metrics, evidence count, and pending review count.

It produces:

```text
candidate actions
utility score
risk score
expected value score
learning value score
readiness score
selected action
reasoning summary
constraints
next step
```

Initial candidate action types:

```text
review_campaign_health
gather_more_evidence
prepare_reviewable_draft
prepare_owned_content
create_internal_followup_task
record_learning_note
```

These are still metadata planning records only. Drafting and external execution remain blocked.

## Campaign health and analysis

The campaign health model returns:

```text
green
amber
red
unknown
```

It looks at campaign status, recorded feedback, meeting count, review coverage, sample size, and the existence of metrics.

`GET /admin/growth/operator` returns campaign-level analyses and a readiness summary:

```text
analyses
readiness
loopPlan
```

Each analysis includes:

```text
health
operatorState
signalScore
riskScore
readinessScore
positiveRate
reviewCoverage
evidenceScore
learningScore
decisionScore
reasons
recommendedNextActions
counts
```

## Operator loop

The operator loop is the first deterministic "always keep moving" layer. It picks the safest next internal step from the current Worker state.

Possible loop steps:

```text
create_campaign
add_metric_snapshot
add_evidence
plan_decision
record_learning
review_risk
continue_testing
```

## Operator cycle

`GET /admin/growth/cycle` returns a full read-only cycle report.

Current contract:

```text
growth_operator_cycle_v3_strategy_blackboard_read_only
```

The cycle report includes:

```text
readiness
strategy
blackboard
loopPlan
campaignBriefs
capabilitySummary
blocked
counts
safety
```

The `strategy` section summarizes:

```text
complete
missing
counts
activeObjectives
targetSegments
offerProfiles
positioningProfiles
runtimeConstraints
```

The `blackboard` section summarizes:

```text
complete
missing
counts
facts
entities
marketSignals
assets
```

Current setup blockers can include:

```text
no_campaigns
missing_objectives
missing_target_segments
missing_offer_profiles
missing_positioning_profiles
missing_runtime_constraints
missing_blackboard_facts
missing_growth_entities
missing_entity_relationships
missing_market_signals
missing_asset_inventory
missing_metric_snapshot
missing_evidence
missing_reasoned_decision
```

## Autonomous runtime

`GET /admin/growth/autonomy` returns the supervised autonomous runtime contract.

Current contract:

```text
growth_autonomous_runtime_v3_strategy_blackboard
```

The runtime includes:

```text
strategicIntent
knowledgeSubstrate
currentFocus
readiness
blockers
cognitionStages
autonomyLevels
capabilitySummary
governance
nextRuntimeMilestones
safety
```

`knowledgeSubstrate` is sourced from the Growth Blackboard and reports whether the Worker has enough internal knowledge to reason safely before future approval-gated execution exists.

## Cycle memory

`POST /admin/growth/cycle/record?confirm=1` records the current read-only cycle into `growth_operator_cycle_events`.

This gives the Worker a durable history of its internal campaign-thinking loop without executing anything externally.

Stored fields include:

```text
selected_step
target_campaign_id
target_campaign_name
priority
rationale_json
blocked_json
recommended_command
readiness_json
loop_plan_json
counts_json
safety_json
created_at
```

## Safety posture

All routes are internal metadata only:

```text
externalStateChange: false
callsAI: false
callsNetwork: false
```

Confirm-gated write routes write only internal metadata records. They do not send, publish, submit forms, run browser work, perform public actions, browse, or call AI.

This layer is the brain, analytics, memory, and planning layer. Execution remains a later phase after evidence packs, approvals, suppression, caps, identity, audit, and channel-specific controls exist.

## Local verification

```powershell
cd C:\GitRepos\evavo-worker-agent
git pull
npm run growth:wiring:apply
npm run growth:route-catalogue:apply
npm run db:migrations:check
npm run growth:campaigns:check
npm run growth:strategy:check
npm run growth:blackboard:check
npm run check:local
```

## Smoke verification

```powershell
npm run growth:route-contract:print
npm run growth:campaigns:smoke:print
npm run growth:strategy:smoke:print
npm run growth:blackboard:smoke:print
```

The campaign smoke validates:

```text
operator overview
operator cycle
campaign create
experiment create
metric snapshot create
evidence item create
learning note create
next-best decision planning
cycle record create
cycle events list
```

The strategy and blackboard smokes validate the v3 cycle/autonomy contracts:

```text
growth_operator_cycle_v3_strategy_blackboard_read_only
growth_autonomous_runtime_v3_strategy_blackboard
```
