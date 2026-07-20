# EVAVO Growth Autonomy Agent

This document preserves historical future-state design vocabulary. It is not an active-runtime contract, implementation authorisation or roadmap for enabling outbound execution.

The active EVAVO Growth Research Worker is manual-research-only, review-first and non-executing.

## Current authoritative posture

The active Worker may:

```text
read stored internal metadata
score and prioritise existing research evidence
maintain strategy and learning metadata
create internal approval or review records
perform explicitly classified manual public-source research only after shared authentication and explicit confirmation
save bounded research results as review-only internal metadata
```

The active Worker must not:

```text
generate drafts
send email or direct messages
post or comment
submit forms
operate a browser
buy advertising
log in to third-party systems
mutate third-party data
publish owned-channel content
run autonomous or scheduled external research
queue background network work
execute approved external actions
```

Scheduled processing is internal-only. Cron must not fetch public pages, discover opportunities, expand sources or trigger an alternate executor.

## Historical concept vocabulary

Earlier designs used terms such as autonomy agent, observe, draft, assist, approved autopilot and owned-channel autopilot. These labels are retained only to explain historical records or future design discussions.

They do not correspond to enabled runtime modes.

The only current operational posture is:

```text
manual_research_review_only
```

That posture requires:

```text
shared ADMIN_TOKEN authentication
explicit confirmation
bounded route classification
GET-only public research
public-target and redirect validation
review-only persistence
no AI
no drafting
no sending
no posting
no forms
no browser execution
no external state mutation
```

## Internal decision support

The Worker may record internal decisions such as:

```text
research_more
score_candidate
reject_candidate
monitor_later
prepare_review_pack
request_operator_review
```

These records are non-executable. Approval metadata does not enable an action and must never be interpreted as permission to send, post, submit, publish or mutate an external system.

## Blocked historical action classes

Historical design materials may refer to these action classes, but they are blocked in the active Worker:

```text
draft email
draft contact form
draft social or community content
send email
submit contact form
submit directory listing
post owned-channel content
post community replies
schedule publication
execute provider or marketplace actions
```

No route, capability registry, stored setting or approval state may activate them.

## Strategy inputs

Internal strategy records may still describe services, campaigns, audiences, regions, offers, proof points, tone, risk appetite and budgets. These inputs are used only for internal scoring, prioritisation and review context.

They do not authorise external execution.

## Future-state governance rule

Any proposal to add drafting, browser execution, delivery or external mutation would require a separate product decision, new threat model, new runtime design and explicit approval outside this document.

Until that happens:

```text
draftingEnabled: false
browserExecutionEnabled: false
externalDeliveryEnabled: false
autonomousCampaignsEnabled: false
scheduledExternalResearchEnabled: false
```

The source code and executable safety contracts are authoritative if any historical document or stored record conflicts with this posture.
