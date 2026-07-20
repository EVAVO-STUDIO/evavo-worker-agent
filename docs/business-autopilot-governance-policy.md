# EVAVO Business Autopilot governance policy

This policy is authoritative for the active EVAVO Business Autopilot runtime.

The platform is an authenticated, review-first internal intelligence system. It is not an internet actor and it has no drafting, sending, posting, form-submission, browser-execution, advertising or third-party mutation capability.

## Primary rule

```text
Research manually when explicitly confirmed. Store internal review metadata. Never execute externally.
```

## Current governance posture

```text
scheduledExternalResearchEnabled: false
manualResearchRequiresAuthentication: true
manualResearchRequiresConfirmation: true
manualResearchIsBounded: true
manualResearchSavesReviewItemsOnly: true
draftingEnabled: false
externalDeliveryEnabled: false
browserExecutionEnabled: false
externalStateChangeEnabled: false
autonomousCampaignsEnabled: false
```

## Hard blocks

The following actions are always blocked:

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
call_delivery_webhook
generate_deliverable_draft
```

No approval record, historical status, budget profile, channel policy, operator preference or stored setting may activate a blocked action.

## Allowed internal actions

The Worker may perform authenticated internal metadata actions:

```text
record organization
record person metadata
record website and page metadata
record website audit observation
record signal
record opportunity
record service match
record audit pack
record manual-review request
record suppression metadata
record internal follow-up
record content-topic idea
record learning event
```

Any write requires the route's explicit confirmation contract. Confirmation authorises only that named internal write.

## Manual research governance

A network-capable route is allowed only when all of the following are true:

```text
shared ADMIN_TOKEN authentication succeeded
request method and route policy permit manual research
explicit confirmation is present
public target validation succeeds
redirect validation succeeds
GET-only behaviour is enforced
request, byte, time and result bounds are enforced
result is stored as internal review metadata only
```

There is no scheduled crawler, background queue, automatic retry executor or alternate fallback path.

## Historical approval and execution records

The retained schema may include:

```text
business_action_drafts
business_approval_requests
business_execution_records
```

These names are historical compatibility metadata only.

Approval records may capture a review decision, but:

```text
authoritativeForExecution: false
externalUseAllowed: false
executable: false
deliverable: false
```

Historical statuses such as `draft`, `approved`, `scheduled`, `executed`, `failed` or `expired` remain readable only for compatibility and audit history. They cannot enter a runnable lifecycle.

## Suppression policy

Suppression metadata remains useful for privacy, legal-risk and do-not-contact review even though delivery is disabled.

Suppression may apply to:

```text
email address
domain
organization
person
channel
campaign
source
```

Suppression reasons may include:

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

Suppression wins over all recommendations and review metadata.

## Rate and budget policy

Current limits for disabled capabilities are permanently zero:

```text
AI generations: 0
email sends: 0
social posts: 0
social comments: 0
form submissions: 0
browser actions: 0
ad actions: 0
external retries: 0
```

Budgets may further restrict internal reads, internal writes and confirmed bounded manual research. They cannot enable execution.

## Audit requirements

Record:

```text
authenticated route family
confirmation state
internal record type
manual research bounds when applicable
review decision
suppression decision
failure reason
operator-provided context
created and updated timestamps
```

Do not create delivery attempts or provider-message references because the active Worker has no delivery provider.

## Fail-closed control

The effective external-execution kill switch is permanently on.

When authentication, confirmation, target validation, bounds, schema state or audit metadata is unavailable, the action must fail without retry, fallback or partial external work.

## Browser safety

The browser may display read-only records and request server-side confirmed internal metadata writes through protected proxy routes.

The browser must never receive:

```text
Worker admin token
provider token
execution secret
raw private credential
server-side research credential
```

## Authoritative active posture

The Business Autopilot is limited to:

```text
internal metadata records
read-only dashboard visibility
confirmed internal metadata writes
confirmed bounded manual public-source research
internal scoring and audit packs
manual-review metadata
suppression metadata
learning metadata
```

It does not draft deliverable content and does not execute external actions.