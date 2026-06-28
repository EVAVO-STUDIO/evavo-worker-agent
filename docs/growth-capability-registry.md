# Growth capability registry

This document defines the first capability model for the EVAVO Growth Operator.

The registry is intentionally a control-plane feature. It describes what the agent can do, what is planned, what is blocked, and what level of autonomy is required. It does not execute any capability by itself.

## Current code

```text
src/core/growthCapabilities.ts
src/routes/growthCapabilitiesAdmin.ts
```

The registry currently supports a static typed list. Persistence and operator overrides should come later.

## Autonomy levels

```text
0 read_only
1 draft_only
2 internal_write
3 approved_external
4 trusted_bounded_external
5 autonomous_campaign
```

The system should move through these levels gradually. Current safe operating scope remains mostly level 0, level 1 planning, and level 2 internal metadata.

## Initial capability IDs

```text
research_public_website
score_growth_signal
draft_message
draft_owned_content
prepare_browser_step
create_internal_task
request_approval
external_delivery_approved
record_outcome
generate_growth_brief
```

## Registry fields

```text
id
label
description
category
autonomyLevelRequired
callsNetwork
callsAI
touchesExternalChannel
externalStateChange
requiresApproval
requiresEvidence
requiresContactSource
requiresSuppressionCheck
costRisk
reputationRisk
allowedInFreeSafeMode
currentImplementation
notes
```

## Current safety posture

The registry itself reports:

```text
readOnly: true
registryOnly: true
executesCapabilities: false
callsAI: false
touchesExternalChannel: false
callsNetwork: false
```

The placeholder for future approved external delivery is blocked. It is present only so the control plane can model future work before execution exists.

## Build order from here

1. Keep the static capability registry as source of truth.
2. Expose it through the Worker route once the route wiring is applied locally.
3. Add a Next proxy and Ops UI panel.
4. Add approval request records.
5. Add draft records.
6. Add browser observe/prepare service.
7. Add approved execution only after evidence, approval, suppression, and caps exist.

## Local wiring note

The intended Worker route is:

```text
GET /admin/growth/capabilities
```

A route handler exists at:

```text
src/routes/growthCapabilitiesAdmin.ts
```

If connector-side content filtering prevents direct index wiring, wire it locally by importing `handleGrowthCapabilitiesAdmin` in `src/index.ts` and routing `/admin/growth/capabilities` before the generic `/admin/growth/` branch.
