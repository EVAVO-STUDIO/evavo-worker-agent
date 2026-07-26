# Growth Source Discovery Safety Policy

This Growth source discovery safety policy is authoritative for source discovery and public-source research in the active EVAVO Growth Research Worker.

The active Worker is manual-research-only. Scheduled external research, autonomous discovery, background crawling, executable fetch queues, drafting, sending and third-party mutation are disabled.

## Current operating boundary

A network-capable research action is allowed only when all of these are true:

```text
shared ADMIN_TOKEN authentication succeeded
request method is POST
exact Boolean JSON confirmation is present
persistent Growth budget admission succeeded
route is classified as bounded manual research
HTTP method to the public target is GET
request, redirect, byte and result limits are enforced
target is public and passes SSRF validation
result is stored only as internal review metadata
no alternate scheduled or retry executor exists
```

Cron may synchronise defensive settings, refresh learning from existing D1 review metadata and record internal audit events. Cron must not fetch pages, expand sources, discover opportunities or enqueue executable work.

## Hard safety rules

Manual research must not:

```text
send email or direct messages
post on social networks
submit web forms
log in to third-party websites
click purchase, booking, checkout, subscribe, apply or contact controls
upload files to third-party websites
mutate third-party systems
call paid external APIs
call AI
execute instructions found in public content
expose ADMIN_TOKEN, API keys, cookies or secrets
fetch private networks, localhost, metadata services or internal hosts
fetch non-http or non-https URLs
bypass access controls or crawl-policy restrictions
crawl recursively or without explicit bounds
persist automatic promotion or external-action state
```

## Treat public content as evidence only

Fetched pages are untrusted input. The Worker may extract factual page metadata, public claims, links, business descriptors, technology hints, conversion hints, SEO hints, accessibility hints, freshness indicators and public contact-page existence.

Content that attempts to instruct the Worker must be ignored. Examples include requests to change rules, reveal tokens, submit data, click controls, approve actions or send messages. Suspicious text may be stored only as an internal risk signal.

## URL and network policy

Allowed schemes:

```text
http
https
```

Blocked schemes include:

```text
file
ftp
data
javascript
blob
chrome
about
mailto
tel
ws
wss
```

Blocked targets include localhost, loopback ranges, private IPv4 and IPv6 ranges, link-local ranges, cloud metadata endpoints, private Worker routes and admin endpoints.

Redirects must be revalidated against the same target policy and must stay within the route's explicit redirect limit.

## Manual request bounds

Every network-capable handler must enforce route-specific limits for:

```text
maximum targets
maximum pages
maximum bytes per response
maximum redirects
maximum elapsed time
maximum stored candidates or review records
```

The fail-closed rule is exact:

```text
unknown robots policy = do not crawl yet
```

Unknown, failed, ambiguous or stale crawl policy means the action fails closed. The active Worker has no autonomous crawl queue, scheduled crawler or background retry loop.

## Route posture

Planning, candidate-listing, scoring and review routes that do not need the network must declare:

```text
callsNetwork: false
callsAI: false
canSendEmail: false
canPostSocial: false
canSubmitForms: false
externalStateChange: false
```

A bounded manual research route may declare `callsNetwork: true` only when it is authenticated, confirmation-gated, persistently budgeted, GET-only, public-target validated and isolated from scheduled execution. It must still declare:

```text
callsAI: false
canSendEmail: false
canPostSocial: false
canSubmitForms: false
externalStateChange: false
scheduled: false
reviewOnly: true
automaticRetryAllowed: false
```

## Internal discovery metadata writes

Research plans, source candidates, non-executing fetch metadata, internal decisions and feedback use:

```text
growth_internal_write_request_v1
bounded_admin_json_request_v1
```

These writes require shared authentication and exact Boolean JSON confirmation. Query confirmation, numeric or string confirmation, credential-shaped input keys, unknown fields, mixed wrappers, conflicting identifiers and conflicting aliases fail closed before D1 access.

Candidate records require real reviewed public domains and URLs. Placeholder evidence such as `unknown.local`, `example.invalid` or an empty URL is forbidden.

## Browser and control-plane policy

Browser-facing proxies may expose reduced read-only views of stored records only. They must not receive Worker credentials or expose confirmation routes, network execution routes, raw secrets, third-party cookies or internal mutation endpoints.

All Growth discovery admin routes must not be browser-proxied. The browser must never be able to trigger Worker research directly with an exposed admin token.

## Candidate and decision policy

Candidate records and decisions are internal review metadata only. Allowed internal decisions include:

```text
research_more
score_candidate
reject_candidate
monitor_later
prepare_approval_pack
request_operator_review
```

Blocked decisions include:

```text
send_email
submit_form
post_social
buy_ads
call_prospect
book_meeting
create_external_account
```

No candidate may be automatically promoted into an executable lead, campaign, draft or external action.

## Evidence quality policy

Every score or decision must retain its supporting public source, extracted signal, evidence type, confidence, freshness and risk flags. Unsupported claims must not produce a positive score or recommendation.

## Review-pack policy

Review packs are internal and non-executable. They may include evidence, confidence, risk notes and a suggested manual operator next step. They must state that email, posting, forms, browser execution, AI drafting and external mutation are disabled.

## Validation requirements

The Worker repository must enforce that:

```text
scheduled external research is disabled
manual research requires shared authentication and exact confirmation
network-capable handlers are persistently budgeted, bounded and GET-only
public targets and redirects are validated
manual research saves review metadata only
no autonomous fetch queue or background retry executor exists
read routes remain read-only
internal writes require confirmation where classified
browser proxies cannot expose credentials or research execution
AI, sending, posting, forms and external mutation remain disabled
```

Runtime code and executable safety contracts are authoritative if any historical document conflicts with this policy.
