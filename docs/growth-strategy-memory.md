# Growth Strategy Memory

Growth Strategy Memory gives the EVAVO Growth Operator durable strategic intent.

It is the layer that tells the Worker what EVAVO is trying to achieve, who it wants to reach, what it can offer, how it should sound, and what runtime constraints must govern autonomous behaviour.

This is still an internal metadata-only layer. It does not call AI, browse, send email, post content, submit forms, spend money, or change external systems.

## Code

```text
migrations/0016_growth_strategy_memory.sql
src/core/growthStrategyMemory.ts
src/routes/growthStrategyMemoryAdmin.ts
src/core/growthAutonomousRuntime.ts
```

## Migration

```powershell
cd C:\GitRepos\evavo-worker-agent
npm run db:migration:one -- 0016 --execute
```

## Tables

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

Run the route wiring helper before deploy:

```powershell
npm run growth:wiring:apply
```

Run the route catalogue helper before route-contract checks:

```powershell
npm run growth:route-catalogue:apply
```

## What each object means

### Objectives

Objectives are the top-level growth outcomes the operator should optimise toward.

Examples:

```text
Generate qualified EVAVO opportunities
Increase visibility for EVAVO AI and automation services
Build a reviewed opportunity pipeline
```

### Key results

Key results are measurable targets attached to objectives.

Examples:

```text
20 reviewed high-fit opportunities
5 qualified replies
2 booked discovery calls
```

### Target segments

Target segments describe who EVAVO wants the system to look for.

Useful fields include:

```text
geography
industry
company size
buyer roles
pain points
priority
```

### Offer profiles

Offer profiles describe what EVAVO can credibly offer.

Examples:

```text
Website, UX, and AI automation review
Digital product design and build
Analytics and conversion improvement
Custom AI assistant or workflow automation
```

### Positioning profiles

Positioning profiles control voice, value proposition, preferred angles, proof assets, and phrases to avoid.

This helps future AI drafting stay aligned with EVAVO's calm, premium, practical tone.

### Runtime constraints

Runtime constraints are hard or soft operating rules.

Examples:

```text
No external action without explicit approval
No sending email while external delivery is blocked
No AI drafting until prompt/version/evidence controls exist
No claims without evidence
```

## Autonomy integration

`GET /admin/growth/autonomy` now loads strategy memory and returns:

```text
strategicIntent
```

The autonomy runtime reports:

```text
activeObjectives
targetSegments
offerProfiles
positioningProfiles
runtimeConstraints
```

It also reports missing setup blockers:

```text
missing_objectives
missing_target_segments
missing_offer_profiles
missing_positioning_profiles
missing_runtime_constraints
```

Once seeded, the Growth Operator can reason from strategic intent instead of only campaign mechanics.

## Safety posture

All strategy-memory routes are internal metadata only:

```text
externalStateChange: false
callsAI: false
callsNetwork: false
```

All write routes require confirmation:

```text
confirm=1
```

This layer lets the operator know what to do, but does not give it external execution ability.

## Local verification

```powershell
cd C:\GitRepos\evavo-worker-agent
git pull
npm run growth:wiring:apply
npm run growth:route-catalogue:apply
npm run db:migrations:check
npm run growth:strategy:check
npm run check:local
```

## Smoke verification

```powershell
npm run growth:strategy:smoke:print
```

The printed smoke commands seed:

```text
one objective
one key result
one target segment
one offer profile
one positioning profile
one runtime constraint
```

Then they verify:

```text
GET /admin/growth/strategy-memory
GET /admin/growth/autonomy
```

## Recommended seed posture

The initial EVAVO seed should keep the Worker at autonomy level 1:

```text
Observe and write confirmed internal metadata only.
```

External execution remains blocked until evidence packs, approval records, suppression, caps, contact permissions, channel policies, and audited adapters exist.
