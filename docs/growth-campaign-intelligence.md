# Growth Campaign Intelligence Brain

This is the internal campaign analysis, decision, loop, cycle and memory layer for the EVAVO Growth Research Worker.

The implementation is **metadata only**. It does not deliver messages, generate drafts, publish content, submit forms, run browser actions, call AI, browse, perform network research or mutate third-party systems.

## Authoritative runtime posture

```text
scheduledExternalResearchEnabled: false
manualResearchRequiresAuthentication: true
manualResearchRequiresConfirmation: true
manualResearchIsBounded: true
manualResearchSavesReviewItemsOnly: true
draftingEnabled: false
emailSendingEnabled: false
socialPostingEnabled: false
formSubmissionEnabled: false
browserExecutionEnabled: false
externalStateChangeEnabled: false
autonomousCampaignsEnabled: false
```

Campaign records, decisions, experiments, metrics and candidate actions are internal planning and review metadata. No status, approval, score, readiness value, budget or recommended command can activate delivery.

## Current contracts

Main cycle contract:

```text
growth_operator_cycle_v3_strategy_blackboard_read_only
```

Historical autonomy-named compatibility contract:

```text
growth_autonomous_runtime_v3_strategy_blackboard
```

The second identifier is retained for compatibility with existing clients and stored records. It does not indicate autonomous network or external execution.

## Code and migrations

```text
migrations/0014_growth_campaign_intelligence.sql
migrations/0015_growth_operator_cycle_events.sql
migrations/0016_growth_strategy_memory.sql
migrations/0017_growth_blackboard.sql
migrations/0018_growth_cycle_memory_snapshots.sql
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

The `growthAutonomousRuntime.ts` filename is historical compatibility naming. Its output is internal analysis only.

Apply migrations only through the guarded migration process documented in `migrations/README.md`. Do not infer runtime capability from table names such as `growth_candidate_actions`.

## Route families

Internal campaign and cycle routes include:

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

Strategy and blackboard routes remain authenticated internal metadata routes. Confirm-gated POST routes write only the named D1 metadata records.

Confirmation does not authorise drafting, delivery, network research or external mutation.

## Decision planner

The deterministic planner may produce internal candidate steps such as:

```text
review_campaign_health
gather_more_existing_evidence
create_internal_followup_task
record_learning_note
request_manual_review
mark_blocked
```

It must not produce or promote:

```text
prepare_reviewable_draft
prepare_owned_content
send_email
submit_form
post_content
run_browser_step
execute_campaign
```

All scores, readiness values, reasons and recommended commands are advisory metadata only.

## Operator loop and cycle

`GET /admin/growth/operator` returns campaign analyses and readiness summaries.

`GET /admin/growth/cycle` returns the read-only cycle contract:

```text
growth_operator_cycle_v3_strategy_blackboard_read_only
```

Possible loop steps are limited to internal work:

```text
create_campaign_metadata
add_metric_snapshot
add_existing_evidence
plan_internal_decision
record_learning
review_risk
request_manual_review
```

The loop must not call network, AI, drafting or delivery helpers.

## Historical autonomy view

`GET /admin/growth/autonomy` returns an internal reasoning and readiness view under the compatibility contract:

```text
growth_autonomous_runtime_v3_strategy_blackboard
```

Its `strategicIntent`, `knowledgeSubstrate`, `currentFocus`, `readiness`, `blockers`, `cognitionStages`, `autonomyLevels`, `capabilitySummary`, `governance`, `nextRuntimeMilestones` and `safety` fields are reporting metadata.

`autonomyLevels` and `nextRuntimeMilestones` must not be interpreted as permission or a roadmap to enable external execution. Disabled capabilities remain disabled regardless of readiness.

## Cycle memory

`POST /admin/growth/cycle/record?confirm=1` records the current read-only cycle into `growth_operator_cycle_events`.

It stores internal planning, readiness, strategy, blackboard and safety snapshots. It does not execute the selected step and cannot activate a historical candidate action.

## Safety posture

All campaign-intelligence routes are internal metadata only:

```text
externalStateChange: false
callsAI: false
callsNetwork: false
sendsEmail: false
postsExternally: false
submitsForms: false
browserExecution: false
```

Historical campaign, candidate-action or decision rows remain readable but non-executable.

There is no later execution phase authorised by this document. Any future proposal to add AI, drafting, sending, posting, form submission, browser automation or third-party mutation requires a separate product decision, threat model and new implementation. Documentation, approval metadata or stored configuration alone can never enable it.

## Local verification

```powershell
cd C:\GitRepos\evavo-worker-agent
git pull origin main
npm run growth:campaigns:check
npm run growth:strategy:check
npm run growth:blackboard:check
npm run docs:operating-posture:check
npm run check:local
```

The current validation contracts must continue to verify internal-only, read-only and non-executing behaviour.