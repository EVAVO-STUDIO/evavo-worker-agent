# EVAVO Business Autopilot compliance policy

This policy defines the minimum compliance model before the Business Autopilot can execute email, social, form, CRM, calendar, or other external actions.

It is intentionally stricter than the first implementation needs. The first implementation is metadata-only and draft-only.

## Initial posture

The first implementation supports:

```text
read-only intelligence
action drafts
approval metadata
suppression metadata
execution metadata
learning metadata
```

The first implementation does not support autonomous sending, posting, commenting, submitting forms, buying ads, or mutating external systems.

## Email compliance gates

Before any email send endpoint can be enabled, the platform must verify:

```text
recipient identity is known
contact source is recorded
consent basis or lawful basis is recorded
sender identity is configured
business contact details are configured
unsubscribe mechanism is configured where required
suppression list has been checked
approval record exists
message body matches approved draft or approved template family
daily and campaign caps are not exceeded
audit record is created before execution
```

If any check fails, the action status must become:

```text
blocked
```

or:

```text
suppressed
```

## Social compliance gates

Owned social publishing requires:

```text
approved content draft
approved target channel
operator approval
publish window
brand voice check
campaign cap check
audit record
```

Third-party commenting requires a higher threshold:

```text
specific post URL
specific approved comment text
manual approval per comment
brand-risk check
no impersonation
no spam repetition
no hidden automation identity
```

Third-party commenting should remain disabled until owned-channel scheduling is reliable.

## Contact-form policy

Contact form submission is blocked by default.

The system may:

```text
detect contact forms
summarise form fields
draft a message
prepare manual submission instructions
```

The system must not submit forms automatically unless the target form is an explicitly trusted and approved workflow.

## Data minimisation

Store only what is useful for business intelligence, approval, execution and audit.

Avoid storing sensitive personal information unless there is a clear business purpose and retention policy.

## Source-of-contact recording

Any person or email record used for outreach must store:

```text
source type
source URL or operator source
collection timestamp
confidence
allowed use
notes
```

## Unsubscribe and suppression

Suppression must be checked before any external message action.

Suppression records may be created by:

```text
operator decision
unsubscribe event
complaint
bounce
bad-fit review
competitor flag
legal-risk flag
duplicate detection
```

Suppression records must be treated as higher priority than approval records.

## Execution evidence

Every external execution attempt must record:

```text
draft id
approval id
compliance status
suppression status
execution provider
execution status
attempt count
result reference
failure reason
```

## Draft-only exception

Draft generation may occur without consent checks if the draft is not sent or posted and remains internal.

Drafts must clearly identify whether they are:

```text
internal note
email draft
social post draft
social comment draft
contact form draft
proposal draft
follow-up draft
```

## Operator override policy

Operator overrides must record:

```text
operator id or label
reason
risk accepted
expiry
```

Overrides must not bypass suppression unless the suppression reason is corrected or removed.

## Future execution requirement

Before enabling any send/post/submit endpoint, add dedicated checks for:

```text
compliance gate
suppression gate
approval gate
rate/cap gate
audit gate
kill switch gate
```
