# Growth Campaign Intelligence Brain

This is the first large-step architecture layer for the EVAVO Growth Operator.

It adds campaign, experiment, metric, evidence, decision, candidate-action, learning-note, operator-cycle, and cycle-event structures so the agent can reason about what to do next instead of only listing queue items.

The implementation is intentionally internal metadata only. It does not deliver messages, publish content, submit browser steps, call AI, or perform network research.

## Code

```text
migrations/0014_growth_campaign_intelligence.sql
migrations/0015_growth_operator_cycle_events.sql
src/core/growthCampaignAnalysis.ts
src/core/growthCampaignIntelligence.ts
src/core/growthCampaignDecisions.ts
src/core/growthCampaignRecords.ts
src/core/growthOperatorLoop.ts
src/core/growthOperatorCycle.ts
src/core/growthOperatorCycleEvents.ts
src/routes/growthCampaignIntelligenceAdmin.ts
```

## Migrations

```powershell
cd C:\GitRepos\evavo-worker-agent
npm run db:migration:one -- 0014 --execute
npm run db:migration:one -- 0015 --execute
```

## Tables

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

## Intended routes

```text
GET  /admin/growth/operator
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

The handler exists at:

```text
src/routes/growthCampaignIntelligenceAdmin.ts
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

`GET /admin/growth/cycle` returns a full read-only cycle report:

```text
readiness
loopPlan
campaignBriefs
capabilitySummary
blocked
counts
safety
```

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

Confirm-gated write routes write only internal metadata records. They do not send, publish, submit forms, run browser work, perform public actions, or call AI.

This layer is the brain, analytics, memory, and planning layer. Execution remains a later phase after evidence packs, approvals, suppression, caps, and channel-specific controls exist.

## Local verification

```powershell
cd C:\GitRepos\evavo-worker-agent
git pull
npm run growth:wiring:apply
npm run growth:route-catalogue:apply
npm run db:migrations:check
npm run growth:campaigns:check
npm run check:local
```

## Smoke verification

```powershell
npm run growth:route-contract:print
npm run growth:campaigns:smoke:print
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
