# Growth Campaign Intelligence Brain

This is the first large-step architecture layer for the EVAVO Growth Operator.

It adds campaign, experiment, evidence, decision, candidate-action, and learning-note structures so the agent can reason about what to do next instead of only listing queue items.

The initial implementation is intentionally internal metadata only. It does not deliver messages, publish content, submit browser steps, or call AI.

## Code

```text
migrations/0014_growth_campaign_intelligence.sql
src/core/growthCampaignIntelligence.ts
src/core/growthCampaignDecisions.ts
src/routes/growthCampaignIntelligenceAdmin.ts
```

## Migration

```powershell
cd C:\GitRepos\evavo-worker-agent
npm run db:migration:one -- 0014 --execute
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
```

## Intended routes

```text
GET  /admin/growth/operator
GET  /admin/growth/campaigns
POST /admin/growth/campaigns?confirm=1
GET  /admin/growth/experiments
POST /admin/growth/experiments?confirm=1
GET  /admin/growth/decisions
POST /admin/growth/decisions/plan?confirm=1
```

The handler exists at:

```text
src/routes/growthCampaignIntelligenceAdmin.ts
```

Wire these paths in `src/index.ts` before the generic `/admin/growth/` branch.

## Decision planner

The first deterministic planner uses a game-AI-inspired utility model. It considers campaign state, experiment state, latest metrics, evidence count, and pending review count.

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

## Campaign health

The first health model returns:

```text
green
amber
red
unknown
```

It looks at campaign status, recorded feedback, meeting count, review coverage, sample size, and the existence of metrics.

## Safety posture

All routes are internal metadata only:

```text
externalStateChange: false
callsAI: false
callsNetwork: false
```

This layer is the brain and planning layer. Execution remains a later phase after evidence packs, approvals, suppression, caps, and channel-specific controls exist.

## Local verification

```powershell
cd C:\GitRepos\evavo-worker-agent
git pull
npm run db:migrations:check
npm run growth:campaigns:check
npm run check:local
```
