# Growth cost governor

This document defines cost controls for the active EVAVO Growth Research Worker.

It is authoritative only for internal reporting, confirmed bounded manual research, D1 metadata reads and writes, and review-first learning. It does not authorise drafting, AI execution, scheduled external research, sending, posting, form submission, browser automation or third-party mutation.

## Active runtime posture

```text
scheduledExternalResearchEnabled: false
manualResearchRequiresAuthentication: true
manualResearchRequiresConfirmation: true
manualResearchIsBounded: true
manualResearchSavesReviewItemsOnly: true
aiExecutionEnabled: false
draftingEnabled: false
emailSendingEnabled: false
socialPostingEnabled: false
formSubmissionEnabled: false
browserExecutionEnabled: false
externalStateChangeEnabled: false
```

A budget profile can restrict an allowed internal action. It cannot enable a disabled capability.

## Governed cost categories

Track only costs and usage that can occur in the active runtime:

- Worker invocations
- estimated CPU milliseconds
- D1 rows read
- D1 rows written
- confirmed manual network fetches
- bytes fetched
- bounded research results saved for review
- internal learning passes
- validation failures
- errors
- estimated cost cents

Historical columns or records for AI calls, draft generations, public actions, contact actions or execution attempts may remain readable for compatibility. They are historical-only and non-executable.

## Active budget profile

The active posture is `manual_research_safe`.

Recommended limits must remain conservative and deployment-specific:

```text
scheduled network fetches/day: 0
AI calls/day: 0
draft generations/day: 0
public actions/day: 0
contact actions/day: 0
manual network requests/run: bounded by route policy
manual results/run: bounded by route policy
D1 writes/day: bounded internal metadata only
```

No profile named `research_budgeted`, `growth_budgeted`, `autopilot`, or similar may activate AI, drafting or delivery.

## Manual research envelope

Each network-capable run must follow this order:

1. Authenticate with the shared `ADMIN_TOKEN` contract.
2. Require an explicit POST confirmation.
3. Resolve a route that is classified as bounded manual research.
4. Validate the public target and redirect chain.
5. Enforce request, byte, time and result limits before fetching.
6. Perform only GET requests.
7. Persist only internal review metadata.
8. Record actual bounded usage and any failure reason.
9. Stop immediately when a cap or safety check fails.

There is no scheduled network budget, background queue, alternate executor or retry worker.

## Fail-closed rules

Reject or stop work when:

- authentication fails
- confirmation is absent
- route classification is missing or unsafe
- budget state is missing or malformed
- target validation fails
- request, byte, time or result limits cannot be resolved
- redirect safety cannot be verified
- usage accounting cannot be written where required
- a retry would exceed the single-run policy
- the operation would call AI, generate a draft or mutate an external system

A failed manual run must not fall back to another network path.

## Retry policy

Automatic retries are disabled.

A manual operator may start a new confirmed request after reviewing the prior failure. That new request must pass the complete authentication, confirmation, target-validation and budget sequence again.

## Scheduled processing

Cron is internal-only. It may:

- synchronise defensive settings
- learn from existing D1 review metadata
- record internal audit information

Cron must not consume a network budget, fetch public pages, expand sources, discover opportunities, call AI, create drafts or perform external actions.

## Historical ledger compatibility

Existing ledger fields such as these may remain for historical data compatibility:

```text
ai_calls
draft_generations
public_actions_executed
contact_actions_executed
retries
```

Their current-runtime limits are always zero. Their presence in a table, report or migration is not capability evidence.

## Dashboard requirements

Authenticated reporting may show:

- current manual-research limits
- confirmed manual usage
- D1 read/write usage
- bounded request and byte usage
- hard-stop reasons
- recent failed or partial manual runs
- internal learning activity
- historical counters clearly labelled non-executable

The dashboard must not present a next executable action, delivery allowance, AI allowance or autopilot budget.

## Scaling rule

The active runtime does not earn execution capability through outcomes.

Good review outcomes may inform future manual research prioritisation or tighter source selection. They must not increase AI, drafting, send, post, form, browser or external-mutation limits above zero.

Any proposal to add a new paid service or external capability requires a separate product decision, threat model, route contract, implementation and safety review. Editing this document or a budget record is never sufficient.