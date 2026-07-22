# EVAVO Business Autopilot data model

This document defines the durable internal metadata foundation for the EVAVO Business Autopilot.

The active Worker supports:

```text
business intelligence
opportunity scoring
website audit packs
service matching
action drafts
approval records
execution records
suppression records
content planning
follow-up tracking
learning loops
```

The last three action-shaped families are historical schema and compatibility vocabulary only. They do not enable drafting, approval-to-execution or delivery.

The first implementation is metadata-only. It does not send, post, comment, submit forms, buy ads, call AI, execute browser actions, or mutate external systems.

## Authoritative runtime posture

```text
internalMetadataOnly: true
reviewOnly: true
historicalActionRecordsOnly: true
scheduledExternalResearchEnabled: false
deliverableDraftGenerationEnabled: false
approvalToExecutionEnabled: false
externalExecutionEnabled: false
```

Confirmation authorises only the named internal metadata write or bounded manual-research action. It never grants external permission.

## Schema sources

Durable foundation tables are created by:

```text
migrations/0021_business_autopilot_foundation.sql
```

Website and funnel audit metadata tables are created by:

```text
migrations/0022_business_website_audit_records.sql
```

`business_audit_observation_candidates` is a computed read-only route over stored internal metadata. It is not a migration table.

## Durable table families

```text
business_organizations
business_people
business_websites
business_pages
business_signals
business_opportunities
business_service_matches
business_audit_packs
business_action_drafts
business_approval_requests
business_execution_records
business_suppression_list
business_content_ideas
business_content_calendar
business_followups
business_learning_events
business_website_audit_runs
business_audit_observations
```

## Entity and evidence families

### business_organizations

Internal organization metadata, including name, domain, website, industry, location, source context, scores and metadata.

### business_people

Internal contact-context metadata, including organization relationship, role, contact fields, source context, allowed-use review and confidence.

`allowed_use` and `contact_status` describe operator knowledge only. They do not grant permission to send, post, comment, submit forms, enrich contacts, scrape profiles, or execute browser actions. They do not grant permission for any external action.

### business_websites and business_pages

Stored website/page metadata only. Fields such as `crawl_allowed`, `last_fetched_at`, `http_status` and `content_hash` are historical or operator-supplied metadata. They are not crawl instructions.

### business_website_audit_runs

Internal audit-run metadata. It is not a crawler, browser-automation instruction or scheduled research job.

### business_audit_observations

Structured internal website, UX, funnel, analytics or conversion observations used for review, service matching and audit packs.

### business_audit_observation_candidates

A read-only computed route derived from stored internal metadata.

```text
observationCandidates
reviewOnly: true
source: internal_metadata
safety.readOnly: true
```

The candidate route does not crawl, fetch, send, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems.

## Active internal relationship model

```text
business_organizations
→ business_websites
→ business_pages
→ business_signals
→ business_website_audit_runs
→ business_audit_observations
→ business_audit_observation_candidates
→ business_opportunities
→ business_service_matches
→ business_audit_packs
→ manual review or blocked disposition
```

People/contact context ends at manual review:

```text
business_organizations
→ business_people
→ allowed-use review
→ contactability review
→ manual internal disposition
```

There is no active pipeline from either relationship into delivery.

## Intelligence family

### business_signals

Evidence-backed internal signals found during operator review or explicitly confirmed bounded manual research.

### business_opportunities

Ranked internal opportunities derived from evidence, service matching and strategy context. Scores and recommendations are advisory metadata only.

### business_service_matches

Internal mappings between evidence and EVAVO service categories, including website rebuild, web app, UX/UI, analytics/SEO, AI chatbot, automation, 3D/interactive, gamification, funnels, hotspot, ecommerce, performance/maintenance and content strategy.

### business_audit_packs

Evidence-backed internal review packages. They support manual analysis only and are not outreach packs or deliverable drafts.

## Historical action-shaped families

### business_action_drafts

Historical review-record storage retained for compatibility with existing D1 records, route IDs and validators.

Drafts do not send or execute.

Every active-runtime record created through the compatibility builder must be interpreted as:

```text
historicalOnly: true
reviewOnly: true
executable: false
deliverable: false
authoritativeForExecution: false
externalExecutionAllowed: false
```

The active builder stores an internal CRM-style review note only. Direct arbitrary draft writes are disabled.

### business_approval_requests

Historical approval-shaped review metadata only. An approval status, request type, checklist, expiry, operator label or stored setting cannot authorise another action.

```text
historicalOnly: true
reviewOnly: true
executable: false
deliverable: false
authoritativeForExecution: false
externalExecutionAllowed: false
```

Direct approval-request writes are disabled.

### business_execution_records

Historical execution-attempt compatibility records only. The current routes remain metadata-only and do not execute external delivery.

The active Worker must not append a new external execution attempt. Existing rows may be read for historical review, audit and migration compatibility only.

## Safety and planning families

### business_suppression_list

Do-not-contact, block, suppression and safety memory. Suppression overrides scores, recommendations and historical action statuses.

### business_content_ideas

Internal content-idea metadata only. It does not generate or publish deliverable content.

### business_content_calendar

Internal editorial planning metadata only. It does not schedule or publish content externally.

### business_followups

Internal task and follow-up metadata only. It cannot send reminders or contact third parties.

### business_learning_events

Operator feedback, review outcomes and internal learning notes.

## Route posture

Read routes must advertise:

```text
readOnly: true
internalMetadataOnly: true
callsNetwork: false
callsAI: false
externalStateChange: false
canSendEmail: false
canPostSocial: false
canSubmitForms: false
```

Internal write routes must require explicit confirmation and retain the same non-executing capability flags.

Historical read routes for `business_action_drafts` and `business_approval_requests` must be clearly labelled, non-recommended in the Operations Hub and non-authoritative.

The compatibility build route may save one internal historical review record only. It cannot create deliverable copy or approval permission.

These direct writes are retired and must fail closed:

```text
POST /admin/business/action-drafts
POST /admin/business/approval-requests
```

The expected response is `410 Gone` with `historical_record_write_disabled`.

## Permanent boundary

No table name, route ID, schema field, approval status, budget profile, channel policy, operator preference or historical record may enable:

```text
email sending
social publishing
third-party commenting
contact-form submission
browser automation
ad buying
AI draft generation
scheduled external research
external system mutation
approval-to-execution
```

This data model is descriptive storage compatibility, not an execution roadmap.
