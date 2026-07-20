# Growth channel policy

This document is the authoritative channel-classification policy for the active EVAVO Growth Research Worker.

The active Worker is manual-research-only. Channel classifications may guide internal research, scoring and operator review, but they do not enable drafting, sending, posting, form submission, browser automation or third-party mutation.

## Current runtime posture

```text
scheduledExternalResearchEnabled: false
draftingEnabled: false
emailSendingEnabled: false
socialPostingEnabled: false
formSubmissionEnabled: false
browserExecutionEnabled: false
externalStateChangeEnabled: false
autonomousCampaignsEnabled: false
```

Approval records, channel policies, stored settings and historical modes are internal metadata only. They are not execution permission.

## Shared policy

All channel classes inherit these rules:

- public-source research is manual, authenticated, explicitly confirmed and bounded
- research results are saved as internal review metadata only
- no hidden-human mode
- no fake neutral recommendations
- no repeated automated outreach
- no hidden promotional links
- no CAPTCHA or access-control bypass
- no drafting or external execution
- if channel rules are unclear, save a blocked reason and stop
- no route may convert approval metadata into delivery capability

## Channel classes

### owned

EVAVO-controlled websites, social accounts, newsletters and other owned properties.

Current Worker use:

- record owned-channel context
- save internal content opportunities
- score relevance and evidence
- recommend a manual operator next step

Blocked in the Worker:

- drafting
- publishing
- scheduling posts
- changing website content
- sending newsletters

### provider_expected

Directories, marketplaces, supplier databases and provider-listing channels.

Current Worker use:

- record public listing requirements
- store eligibility and evidence
- identify duplicate or missing-profile risks
- recommend manual review

Blocked in the Worker:

- creating or updating profiles
- submitting listings
- selecting service categories on third-party systems
- uploading assets

### direct

Business email, contact pages, procurement contacts, warm contacts and inbound or permissioned follow-ups.

Current Worker use:

- identify public contact paths as evidence
- classify consent and suppression risk
- record a manual follow-up recommendation

Blocked in the Worker:

- generating email or contact-form drafts
- sending email
- submitting forms
- booking meetings
- calling prospects

### community

Forums, comments, discussion groups and public communities.

Current Worker use:

- record public context and channel rules
- save a do-not-engage or manual-review recommendation
- store reputational risk evidence

Blocked in the Worker:

- generating replies
- posting comments
- voting, reacting or messaging
- joining groups or authenticating to platforms

### procurement

Tenders, grants, supplier panels and formal proposal pathways.

Current Worker use:

- extract public opportunity metadata
- record eligibility requirements and deadlines
- save evidence and internal review notes

Blocked in the Worker:

- generating proposal drafts
- submitting tenders or applications
- uploading documents
- answering clarification questions

### blocked

Any channel that is private, gated, unclear, hostile to provider engagement, rate-limit sensitive or reputationally unsafe.

Allowed:

- store a blocked reason
- retain minimal public evidence needed for review

Everything else is blocked.

## Link and disclosure metadata

Link and disclosure classifications are internal review metadata only. They may help an operator assess a manual action outside the Worker, but they do not enable drafting or execution.

Possible link classifications:

```text
allowed_for_manual_review
contextual_manual_review
manual_approval_required
blocked
```

Possible disclosure classifications:

```text
not_applicable
recommended_for_manual_action
required_for_manual_action
blocked
```

## Execution policy

The active Worker has one execution classification:

```text
blocked
```

There is no `auto_allowed`, `owned_only`, `approved_autopilot`, `owned_channel_autopilot` or confirmation-to-execution mode in the active runtime.

Explicit confirmation authorises only the specific bounded internal metadata write or manual public-source research action named by the route. It never authorises delivery.

## Channel memory

Channel records may store internal review metadata such as:

- platform and public URL
- channel class
- public rules evidence
- risk classification
- manual-review status
- blocked reason
- last reviewed time
- internal notes

They must not store reusable third-party credentials, authenticated cookies, execution tokens or instructions for automated delivery.

## Cooldowns and risk learning

Historical outcomes or operator feedback may lower a channel's internal research priority. They cannot increase execution capability because external execution remains disabled.

The safe default for every uncertain channel is:

```text
save minimal evidence
mark needs_manual_review or blocked
do not draft
do not execute
```
