# EVAVO Business Autopilot compliance policy

This policy defines the active compliance posture for EVAVO Business Autopilot.

The active Worker is internal, authenticated, review-first and non-executing. It does not generate deliverable drafts, send email, publish or comment socially, submit forms, invite external calendar attendees, write to external CRM systems, buy ads, run browser automation or mutate third-party systems.

## Current posture

```text
manualResearchOnly: true
manualResearchRequiresAuthentication: true
manualResearchRequiresConfirmation: true
manualResearchIsBounded: true
manualResearchSavesReviewItemsOnly: true
scheduledExternalResearchEnabled: false
draftingEnabled: false
emailSendingEnabled: false
socialPublishingEnabled: false
socialCommentingEnabled: false
formSubmissionEnabled: false
browserExecutionEnabled: false
externalStateChangeEnabled: false
```

## Active compliance rule

```text
Compliance metadata can block or classify internal work. It cannot enable a disabled capability.
```

Approval, consent, lawful-basis, suppression, audit and execution records are internal governance metadata only. No record creates permission to deliver externally.

## Email posture

Email sending is disabled.

The system may store internal evidence such as:

```text
public contact-path existence
operator-provided contact source
allowed-use classification
suppression status
manual-review notes
```

It must not:

```text
generate a deliverable email draft
send email
validate an address by contacting it
subscribe or unsubscribe externally
invoke an email provider
convert approval metadata into send permission
```

Historical send-oriented fields remain non-executable compatibility data.

## Social posture

Social publishing and commenting are disabled.

The system may store:

```text
public channel URL
channel classification
public rule evidence
brand-risk notes
manual-review recommendation
```

It must not create deliverable post or comment drafts, publish, schedule, react or authenticate to a social platform.

## Contact-form posture

Contact-form submission is disabled.

A confirmed bounded manual research action may record that a public contact page or form exists, but it must not:

```text
populate fields
prepare a submission payload
solve CAPTCHA
bypass anti-bot controls
submit the form
retry submission
```

## Data minimisation

Store only information necessary for internal business intelligence, audit, review, suppression and learning.

Avoid sensitive personal information unless the operator supplies it for a clear internal purpose and a defined retention policy applies.

For person or contact metadata, prefer:

```text
source type
public source URL or operator source
collection timestamp
confidence
allowed-use classification
review notes
```

Do not enrich private profiles, scrape authenticated sources or infer sensitive attributes.

## Suppression and do-not-contact metadata

Suppression remains authoritative even though delivery is disabled.

Suppression records may be created from:

```text
operator decision
historical unsubscribe
historical complaint
historical bounce
bad-fit review
competitor flag
legal-risk flag
brand-risk flag
duplicate detection
```

Suppression records take priority over opportunity scores, recommendations, approvals and historical action statuses.

## Historical approval and execution metadata

Retained records may include:

```text
action draft id
approval id
compliance status
suppression status
historical execution provider
historical execution status
attempt count
result reference
failure reason
```

These fields are read-only compatibility and audit data.

```text
authoritativeForExecution: false
externalUseAllowed: false
executable: false
deliverable: false
```

The active Worker must not append a new external execution attempt.

## Manual research compliance gates

Before a network-capable manual research route runs, verify:

```text
shared ADMIN_TOKEN authentication
explicit confirmation
bounded route classification
public-target and redirect safety
GET-only method
request, byte, time and result limits
review-only persistence
no AI call
no alternate retry executor
```

If any condition fails, return a safe error and perform no network fallback.

## Operator override policy

Operator metadata may clarify source, classification or review outcome. It cannot override blocked capabilities.

No operator override may enable:

```text
email sending
social publishing
social commenting
form submission
browser execution
ad buying
third-party mutation
AI drafting
scheduled external research
```

## Future capability boundary

Nothing in this policy is a checklist for enabling delivery.

Any future proposal to add email, social, form, CRM, calendar, browser or advertising execution requires a separate product decision, legal review, threat model, implementation and independently enforced contract. Current metadata tables and historical fields do not satisfy that requirement.