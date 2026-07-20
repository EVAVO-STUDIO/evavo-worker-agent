# Growth engagement action model

This document defines the active internal action taxonomy for the EVAVO Growth Research Worker.

The Worker does not draft, queue, approve for delivery or execute engagement actions. It may save public-source evidence, score an internal opportunity, record a blocked decision and recommend a manual operator next step.

## Current action lifecycle

```text
discovered
scored
needs_manual_review
blocked
archived
```

The following historical lifecycle states are non-executable compatibility data only:

```text
drafted
queued
approved
executed
outcome_recorded
```

A stored historical status never enables execution.

## Active action types

### save_signal

Save public evidence and internal classification metadata.

Safety posture:

```text
internalMetadataOnly: true
reviewOnly: true
scheduled: false
callsNetwork: false unless a separately confirmed bounded manual-research route is executing
callsAI: false
sendsEmail: false
postsExternally: false
submitsForms: false
externalStateChange: false
```

### research_public_source

Run one explicitly classified public-source research action.

Requirements:

- shared `ADMIN_TOKEN` authentication
- POST request
- explicit confirmation
- bounded request, byte, redirect, time and result limits
- public HTTP or HTTPS target only
- GET-only behaviour
- SSRF and redirect validation
- review-only internal persistence
- no automatic retry or scheduled fallback

### score_internal_opportunity

Score existing evidence and save internal reasons, confidence and risk metadata.

This action is internal-only and cannot create a draft, campaign or external delivery task.

### request_manual_review

Record that an operator should review evidence and decide what to do outside the Worker.

This is not approval for execution and does not activate any channel capability.

### do_not_engage

Record that no engagement should occur.

Reasons may include:

- bad fit
- channel rules unclear
- self-promotion blocked
- insufficient evidence
- suppression or privacy concern
- negative channel history
- low expected value
- reputational risk

## Disabled historical action types

The following names may exist in historical records or design documents, but they are disabled in the active Worker:

```text
draft_email
draft_contact_form
draft_thread_reply
draft_video_comment
draft_directory_profile
draft_owned_social_post
draft_blog_outline
submit_directory_listing
submit_contact_form
send_email
post_owned_channel
post_community_reply
book_meeting
buy_ads
```

No route, approval object, stored setting, channel class or budget state may activate them.

## Required internal record fields

Every active internal action record should include:

- source or signal identifier
- action type
- reason
- public evidence references
- confidence
- risk flags
- manual-review status
- blocked external actions
- created and updated timestamps

It must also include or inherit these safety facts:

```text
reviewOnly: true
executable: false
draftingEnabled: false
emailSendingEnabled: false
socialPostingEnabled: false
formSubmissionEnabled: false
browserExecutionEnabled: false
externalStateChangeEnabled: false
```

## Scoring gates

### evidence fit

Pass only when the score is supported by stored public evidence.

### EVAVO fit

Pass only when the signal maps to an active EVAVO service or strategic objective.

### channel risk

Record channel constraints and disclosure concerns as internal metadata only.

### privacy and suppression

Block or minimise records when personal data, consent, suppression or do-not-contact concerns exist.

### cost fit

Cost metadata may limit research priority. It cannot authorise drafting or execution.

## Manual review envelope

Before saving a manual-review recommendation, the Worker must verify:

- evidence is present
- the recommendation is specific and non-deceptive
- blocked external actions are recorded
- no delivery payload is generated
- no third-party credential is required
- no external state change will occur
- an audit record can be written

If any check fails, mark the record `blocked` with a reason.

## Outcome and learning model

The Worker may learn only from existing internal review metadata and manually recorded outcomes.

Learning may adjust:

- source quality
- evidence confidence
- internal opportunity score
- manual-review priority
- cooldown or suppression metadata

Learning must not activate drafting, sending, posting, form submission, browser execution or autonomous campaigns.

## Default order

The active safe order is:

1. save signal
2. research one confirmed bounded public source when explicitly requested
3. score internal evidence
4. request manual review or mark blocked
5. record manual outcome metadata
6. learn from existing review metadata

There is no execution stage in the active Worker.
