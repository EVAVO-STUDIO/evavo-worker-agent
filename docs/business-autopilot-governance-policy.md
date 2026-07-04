# EVAVO Business Autopilot governance policy

The Business Autopilot must be useful without becoming an uncontrolled internet actor.

This policy governs autonomy, approvals, external actions, suppression, auditability, and operator controls.

## Primary rule

```text
Research autonomously. Draft helpfully. Execute only under governed approval.
```

## Hard blocks by default

The default platform posture blocks:

```text
send_email
post_social
comment_social
submit_form
log_in
buy_ads
purchase
book_meeting_with_external_party
mutate_external_system
execute_browser_action
bypass_robots_policy
scrape_private_or_login_content
ignore_suppression
ignore_unsubscribe
```

## Allowed by default

The system may perform safe internal metadata actions:

```text
record organization
record person
record website
record page metadata
record signal
record opportunity
record service match
record audit pack
record action draft
record approval request
record follow-up
record content idea
record learning event
```

## Approval requirements

Any action that can change external state requires an approval request and execution record.

External-state actions include:

```text
email_send
social_publish
social_comment
contact_form_submit
crm_external_write
calendar_external_invite
ad_platform_change
webhook_to_external_system
```

Approval records must capture:

```text
action type
target entity
target person or channel
content preview
evidence ids
risk flags
compliance status
approver
approval timestamp
expiry timestamp
approved execution window
maximum retry count
```

## Action statuses

```text
draft
needs_review
approved
rejected
scheduled
executed
failed
cancelled
suppressed
expired
```

## Compliance statuses

```text
not_required_internal
draft_only
requires_consent
consent_verified
suppressed
unsubscribe_required
sender_identity_missing
approval_missing
approved_to_send
blocked
```

## Suppression rules

The suppression list is mandatory before external execution.

Suppression can apply to:

```text
email address
domain
organization
person
channel
campaign
source
```

Suppression reasons include:

```text
manual_do_not_contact
unsubscribe
bounce
complaint
bad_fit
competitor
existing_client
legal_risk
brand_risk
duplicate
```

Suppression wins over approval. If an approved action becomes suppressed before execution, it must not run.

## Rate and campaign caps

External actions must support caps before execution is enabled:

```text
daily cap
weekly cap
campaign cap
per-domain cap
per-channel cap
cooldown window
retry cap
```

The initial implementation should store cap fields and enforce them for any future execution endpoint.

## Audit requirements

Every draft, approval, suppression decision, execution attempt, and outcome must be recorded.

Execution records must include:

```text
action draft id
approval id
execution status
provider
provider message id or external reference
attempt count
request timestamp
result timestamp
failure reason
operator override reason
```

## Kill switch

The platform must support an environment-level or settings-level kill switch for external execution.

If the kill switch is active, only read-only and draft-only actions may proceed.

## Browser safety

The Next dashboard may display records and submit confirmation-gated metadata writes through server-side proxy routes only.

The browser must not receive:

```text
Worker admin token
email provider token
social provider token
execution secret
raw private credentials
```

## Initial implementation posture

The first Business Autopilot implementation is limited to:

```text
metadata records
read-only dashboard visibility
action drafts
approval request metadata
execution record metadata
suppression metadata
content calendar metadata
learning metadata
```

It must not execute external actions until the execution layer has explicit compliance checks and approval enforcement.
