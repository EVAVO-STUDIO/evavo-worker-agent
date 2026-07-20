# Growth capability registry

This document defines the capability model for the EVAVO Growth Research Worker.

The registry is a control-plane and reporting feature. It describes currently available internal capabilities, reserved modelling levels, and blocked capabilities. It does not execute any capability by itself.

## Current code

```text
src/core/growthCapabilities.ts
src/routes/growthCapabilitiesAdmin.ts
```

The registry is a static typed source of truth. It does not accept runtime overrides and does not grant execution permission.

## Runtime posture

Scheduled external execution is disabled.

Manual research is permitted only through authenticated, POST-only routes that require explicit confirmation and enforce bounded limits. Manual research saves review items or internal metadata only.

Draft generation is disabled.

Browser execution is disabled.

External delivery is blocked.

Email sending, social posting, form submission and external state mutation are disabled.

## Autonomy modelling levels

```text
0 read_only
1 draft_only
2 internal_write
3 approved_external
4 trusted_bounded_external
5 autonomous_campaign
```

These levels are modelling vocabulary, not enabled runtime modes. The current Worker supports read-only analysis and explicitly confirmed internal metadata writes. Levels involving drafting, browser execution, external delivery or autonomous campaigns remain blocked.

## Capability IDs

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

A capability entry may exist to model a blocked or future concept. `currentImplementation` is authoritative:

```text
available
planned
blocked
```

An entry marked `blocked` has no executable runtime implementation.

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

## Registry safety posture

The registry reports:

```text
scheduledExecutionEnabled: false
scheduledExternalResearchEnabled: false
manualResearchRequiresAuthentication: true
manualResearchRequiresConfirmation: true
manualResearchIsBounded: true
manualResearchSavesReviewItemsOnly: true
draftingEnabled: false
browserExecutionEnabled: false
externalDeliveryEnabled: false
autonomousCampaignsEnabled: false
readOnly: true
registryOnly: true
executesCapabilities: false
callsAI: false
touchesExternalChannel: false
callsNetwork: false
```

The blocked external-delivery entry exists only so the control plane can describe a prohibited capability explicitly. It is not a roadmap commitment and does not enable external execution.

Internal approval requests are metadata records only. Creating an approval request does not activate the proposed action.

Historical draft and lead records may remain readable for compatibility, but they are not executable.

## Worker route

The protected Worker route is:

```text
GET /admin/growth/capabilities
```

The handler is:

```text
src/routes/growthCapabilitiesAdmin.ts
```

The route requires the canonical server-side `ADMIN_TOKEN`, authenticates before method handling, accepts GET only, and returns registry metadata without executing any capability.
