# Zero-source route catalogue

This document explains how the authenticated Worker route catalogue represents safe operation when no manual source list has been supplied.

Zero-source operation is manual-only. It is not a scheduled source-expansion mode, crawl queue, autonomous discovery loop or outbound workflow.

## Catalogue advertisement

The route catalogue advertises:

- read-only route-map metadata
- confirmed internal D1 metadata writes
- specifically classified bounded manual public-source research routes
- disabled historical compatibility routes where required

A route name does not grant capability. The route's current safety fields and dispatcher contract are authoritative.

The `zero_source_route_map` item remains read-only guidance:

```text
id: zero_source_route_map
method: GET
path: /admin/planner/routes
section: planner
safety: read_only
callsNetwork: false
callsAI: false
canSendEmail: false
```

The map itself performs no research and creates no state change.

## Authoritative runtime posture

Expected current capability reporting is:

```text
scheduledExecutionEnabled: false
scheduledExternalResearchEnabled: false
manualResearchRequiresAuthentication: true
manualResearchRequiresConfirmation: true
manualResearchIsBounded: true
manualResearchSavesReviewItemsOnly: true
aiDraftingEnabled: false
sendingEnabled: false
externalExecutionEnabled: false
```

Historical fields such as `engineEnabled`, source-expansion settings or old run statuses are compatibility data only. They must not be used as permission to execute.

## Safe route sequence

### 1. Read route and capability metadata

Use authenticated read routes to inspect the current route catalogue, capability registry, source metadata and review state.

Verify that every route selected for network access explicitly advertises a bounded manual-research posture.

### 2. Record seed or query-hint metadata

A confirmed internal metadata route may save seed labels, query hints or operator notes without network access.

It must report:

```text
callsNetwork: false
callsAI: false
externalStateChange: false
internalMetadataOnly: true
```

### 3. Run one bounded manual research request

A network-capable request must be:

- authenticated with `ADMIN_TOKEN`
- POST-only
- explicitly confirmed
- classified as bounded manual research
- GET-only against validated public targets
- capped by request, byte, time and result limits
- review-only in persistence

The request must stop if any safety requirement is unavailable.

### 4. Review candidate evidence

Candidate, source-health and evidence records remain internal review metadata.

No candidate may be automatically promoted into:

- a live autonomous source
- a scheduled scan
- an opportunity execution
- a deliverable draft
- an approval to act
- an external campaign

### 5. Record a manual internal disposition

A separate confirmed metadata write may record that the operator accepted, rejected, blocked or deferred an item.

This decision does not schedule another request and does not authorise external action.

## Historical route names

Historical route names may still mention expansion, scans, drafts, approvals, campaigns or run-due processing. Their names are not authoritative.

The active dispatcher, authentication boundary, confirmation requirement, route safety fields and current runtime contracts determine whether a route is available. Disabled compatibility routes must fail closed.

## Hard boundaries

Zero-source operation must retain:

- no scheduled public-source research
- no autonomous fetch queue
- no background crawling
- no automatic retry executor
- no private or authenticated third-party access
- no access-control bypass
- no AI drafting
- no email, social posting or form submission
- no browser automation
- no advertising spend
- no third-party mutation
- no automatic promotion
- explicit authentication and confirmation for every bounded manual network request

## Operational rule

When no useful source-origin evidence exists, present safe manual research options to the operator. Do not start research automatically, do not queue follow-on work and do not infer permission from historical settings.