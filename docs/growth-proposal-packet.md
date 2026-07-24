# Growth Worker proposal packet

The Worker may produce a reviewed candidate packet for the canonical Growth system, but it does not send, persist, promote or execute that packet in the current runtime.

## Contract

The packet version is:

```text
growth_worker_proposal_v1
```

The producer source is:

```text
src/core/growthProposalPacket.ts
```

The mirrored canonical fixture is:

```text
fixtures/growth-worker-proposal-v1.json
```

The matching consumer lives in `EVAVO-STUDIO/next-website`:

```text
src/server/growth-autopilot/workerProposalPacket.ts
tests/fixtures/growth-worker-proposal-v1.json
```

## Current posture

```text
proposalMode: proposal_only
externalExecutionRequested: false
canonicalPromotionRequested: false
```

The producer is pure. It performs no network request, D1 write, scheduled work, browser operation, provider call or external action.

## Required packet fields

```text
contractVersion
sourceSystem
sourceRouteFamily
sourceRecordId
sourceFingerprint
organisationId
workspaceId
candidateKind
candidateTitle
candidateSummary
evidenceItems
confidence
proposedAction
doNothingRationale
riskNotes
idempotencyKey
createdAt
proposalMode
externalExecutionRequested
canonicalPromotionRequested
```

Allowed route families:

```text
growth
business
opportunity
operations
```

Allowed candidate kinds:

```text
account_candidate
opportunity_signal
evidence_packet
analysis_recommendation
next_action_proposal
```

## Safety and quality rules

- Packet size is capped at 48,000 UTF-8 bytes.
- Evidence count is between one and twelve.
- Organisation and workspace IDs are UUIDs.
- Source fingerprints and idempotency keys are opaque bounded identifiers; slash, traversal-like `..` segments and trailing punctuation are rejected.
- Confidence values are finite and between zero and one.
- Evidence URLs use HTTPS, with localhost HTTP accepted only for development fixtures.
- URL credentials and fragments are rejected.
- Packet and evidence timestamps are bounded against stale and future-skew limits.
- Proposed actions must be preparatory or review-oriented.
- Send, post, publish, submit, provider-write, delete, export, campaign-launch and charging language fails closed.

## What this does not enable

The packet builder does not:

- call the `next-website` API;
- read or expose `ADMIN_TOKEN`;
- read an ingestion secret;
- write Worker D1 records;
- create canonical Supabase Growth records;
- create an approval;
- promote a candidate;
- send email, post content, submit forms or mutate providers;
- run from the scheduled entrypoint.

A future transport must remain server-to-server, signed with a dedicated bridge credential, replay-protected, proposal-only, idempotent and audited. The consumer must parse the exact packet before persistence, and canonical promotion remains a separate owner-approved operation.
