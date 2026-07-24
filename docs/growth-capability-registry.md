# Growth capability registry

This document defines the capability, bridge-readiness and protected route-inventory model for the EVAVO Growth Research Worker.

The registry is a control-plane and reporting feature. It describes available internal capabilities, reserved modelling levels, blocked capabilities and the safety posture of every protected Worker POST owner. It does not execute a capability by itself.

## Current code

```text
src/core/growthCapabilities.ts
src/core/growthBridgeReadiness.ts
src/core/growthWorkerRouteParity.ts
src/core/growthBusinessRouteInventory.ts
src/routes/workerRoutePolicy.ts
src/routes/growthRoutePolicy.ts
src/routes/businessRoutePolicy.ts
src/routes/opportunityRoutePolicy.ts
src/routes/operationsRoutePolicy.ts
src/routes/adminProtected.ts
src/routes/admin.ts
src/routes/tools.ts
src/routes/growthCapabilitiesAdmin.ts
```

The registry is a static typed source of truth. It does not accept runtime overrides and does not grant execution permission.

## Runtime posture

- Scheduled external execution is disabled.
- Manual public research is authenticated, explicitly confirmed and bounded.
- Manual research performs public GET-only inspection and saves review items or internal metadata only.
- Draft generation is disabled.
- Browser execution is disabled.
- Email sending, social posting, form submission and external state mutation are disabled.

## Autonomy modelling levels

```text
0 read_only
1 draft_only
2 internal_write
3 approved_external
4 trusted_bounded_external
5 autonomous_campaign
```

These levels are modelling vocabulary, not enabled runtime modes. The current Worker supports read-only analysis, bounded confirmed public research and explicitly confirmed internal metadata writes. Drafting, browser execution, external delivery and autonomous campaigns remain blocked.

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

`currentImplementation` is authoritative:

```text
available
planned
blocked
```

An entry marked `blocked` has no executable runtime implementation.

## Bridge readiness

The protected registry includes:

```text
growth_worker_bridge_v2
```

Current posture:

```text
bridgeEnabled: false
routeInventoryComplete: true
routeInventoryVersion: growth_worker_route_inventory_v2
routeInventoryScope: all_protected_worker_post_route_owners
routeInventoryCompleteForScope: true
routeInventoryCompleteForAllWorkerPostRoutes: true
routeInventoryIncludesBoundedReadOnlyResearch: true
routeInventoryExternalExecutionGroups: 0
unclassifiedPostRouteGroups: 0
clientBrowserAccess: false
adminTokenBrowserExposure: false
draftingEnabled: false
externalExecutionEnabled: false
ownerApprovalRequired: true
idempotencyRequired: true
auditRequired: true
transport: server_to_server_only
promotionMode: proposal_only
```

Inventory completion does **not** enable the bridge. The exact next-website proposal page is present, but Worker proposal delivery is not implemented. The remaining blockers are:

```text
worker_proposal_delivery_not_implemented
cross_repo_contract_tests_not_implemented
```

Candidate delivery, canonical promotion and external execution remain unavailable.

## Complete protected POST-owner inventory

The protected registry also includes:

```text
growth_worker_route_inventory_v2
```

The inventory follows the dispatcher ownership order and covers:

```text
growth
business
opportunity
operations
admin-fallback
```

`tools` is protected and GET-only. `health`, `public` and `root` are public read-only families.

Source-of-truth files include:

```text
src/index.ts
src/routes/workerRoutePolicy.ts
src/routes/growthRoutePolicy.ts
src/routes/businessRoutePolicy.ts
src/routes/opportunityRoutePolicy.ts
src/routes/operationsRoutePolicy.ts
src/routes/adminProtected.ts
src/routes/admin.ts
src/routes/tools.ts
```

Every protected POST owner is classified as one of:

```text
metadata-write
internal-mutation
external-dry-run
retired-write-fail-closed
```

`external-dry-run` means bounded, confirmed, read-only public research that may save internal review metadata. It does not mean third-party mutation, delivery or autonomous execution.

The inventory records:

```text
routeFamily
handlerId
priority
ownership
readMethods
writeMethods
postClassification
authentication
confirmation
networkPosture
callsExternalNetwork
callsAI
canSendEmail
canPostSocial
canSubmitForms
externalStateChange
historicalOnly
retiredWritesFailClosed
legacyExecutionFailClosed
browserCallable
canonicalGrowthPromotion
```

Current inventory contract:

```text
scope: all_protected_worker_post_route_owners
completeForScope: true
completeForAllWorkerPostRoutes: true
bridgeEligible: false
unclassifiedPostRouteGroups: 0
externalExecutionGroups: 0
```

Important classifications:

- Growth and Business writes are internal D1 mutations; historical Business write groups fail closed.
- Opportunity discovery and source expansion may perform bounded confirmed public research and save review metadata only.
- Opportunity reviews, learning, source health and candidate decisions are internal mutations.
- Operations source routes may perform bounded confirmed public research; planner and settings routes remain internal.
- `/admin/run` remains fail-closed through the legacy execution safety handler.
- The only top-level admin fallback POST owner is confirmed historical lead metadata insertion at `/admin/leads`.
- No inventory entry is browser-callable or able to promote canonical Supabase Growth records.

Current inventory safety posture:

```text
browserCallable: false
exposesAdminToken: false
inventoryIncludesBoundedReadOnlyResearch: true
inventoryIncludesExternalExecution: false
registryRouteCallsExternalNetwork: false
callsAI: false
canSendEmail: false
canPostSocial: false
canSubmitForms: false
canonicalGrowthPromotionEnabled: false
```

## Registry safety posture

The registry itself reports:

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

The blocked external-delivery entry exists only to describe a prohibited capability explicitly. It is not a roadmap commitment and does not enable external execution.

Internal approval requests are metadata records only. Creating one does not activate the proposed action. Historical draft and lead records may remain readable for compatibility, but they are not executable.

## Worker route

The protected route is:

```text
GET /admin/growth/capabilities
```

The route requires the canonical server-side `ADMIN_TOKEN`, authenticates before method handling, accepts GET only, and returns registry, bridge-readiness and route-inventory metadata without executing any capability or calling the network.
