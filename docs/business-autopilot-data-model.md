# EVAVO Business Autopilot data model

This document defines the durable metadata foundation for the EVAVO Business Autopilot.

The model is designed for:

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

The first implementation is metadata-only. It does not send, post, comment, submit forms, buy ads, call AI, execute browser actions, or mutate external systems.

## Entity family

### business_organizations

Represents a company, agency, public body, partner, competitor, prospect, client, or other business entity.

Important fields:

```text
name
domain
website_url
industry
location
source_type
source_url
status
fit_score
priority_score
risk_score
confidence_score
metadata_json
```

### business_people

Represents a person connected to an organization.

Important fields:

```text
organization_id
name
role
email
phone
profile_url
source_type
source_url
allowed_use
contact_status
confidence_score
metadata_json
```

### business_websites

Represents a website associated with an organization.

Important fields:

```text
organization_id
url
domain
status
last_checked_at
robots_status
crawl_allowed
tech_hints_json
metadata_json
```

### business_pages

Represents an observed page or important page candidate.

Important fields:

```text
website_id
organization_id
url
page_type
title
status
last_fetched_at
http_status
content_hash
metadata_json
```

## Intelligence family

### business_signals

Evidence-backed signal found during research or audit.

Examples:

```text
weak_mobile_ux
missing_analytics
weak_cta
stale_content
hiring_signal
funding_signal
conversion_gap
seo_gap
trust_gap
automation_opportunity
interactive_experience_opportunity
```

Important fields:

```text
organization_id
website_id
page_id
signal_type
signal_strength
evidence_summary
evidence_url
confidence_score
risk_flags_json
metadata_json
```

### business_opportunities

A ranked opportunity derived from signals, service matching, and strategy context.

Important fields:

```text
organization_id
opportunity_type
status
priority
fit_score
need_score
urgency_score
budget_likelihood_score
contactability_score
evidence_quality_score
risk_score
confidence_score
recommended_service
recommended_angle
next_step
metadata_json
```

### business_service_matches

Maps an organization/opportunity/signal to an EVAVO service category.

Service categories:

```text
website_rebuild
web_app
ux_ui
analytics_seo
ai_chatbot
automation
three_d_interactive
gamification
funnels_hotspots_customer_journeys
ecommerce
performance_maintenance
content_strategy
```

Important fields:

```text
organization_id
opportunity_id
signal_id
service_key
match_score
reason
evidence_json
metadata_json
```

### business_audit_packs

A reusable evidence-backed audit/teardown pack.

Important fields:

```text
organization_id
opportunity_id
title
summary
audit_type
findings_json
recommendations_json
risk_flags_json
confidence_score
status
metadata_json
```

## Action family

### business_action_drafts

Represents a prepared but unexecuted action.

Draft types:

```text
email
linkedin_post
linkedin_comment
linkedin_dm
contact_form_message
proposal_intro
audit_summary
follow_up
crm_note
calendar_task
internal_report
```

Important fields:

```text
organization_id
person_id
opportunity_id
audit_pack_id
draft_type
channel
subject
body
payload_json
risk_flags_json
compliance_status
approval_status
status
metadata_json
```

### business_approval_requests

Represents approval metadata for a draft or action.

Important fields:

```text
action_draft_id
request_type
status
review_checklist_json
risk_flags_json
approval_reason
approved_by
approved_at
expires_at
metadata_json
```

### business_execution_records

Represents attempted or completed execution.

Execution is metadata-only until governed execution endpoints exist.

Important fields:

```text
action_draft_id
approval_request_id
execution_type
provider
status
attempt_count
external_reference
failure_reason
executed_at
metadata_json
```

### business_suppression_list

Represents entities that must not be contacted or acted upon.

Important fields:

```text
scope_type
scope_value
reason
source
active
expires_at
metadata_json
```

## Content and follow-up family

### business_content_ideas

Content ideas derived from research and market patterns.

Important fields:

```text
title
content_type
summary
source_signal_ids_json
target_segment
recommended_channel
priority_score
status
metadata_json
```

### business_content_calendar

Planned content calendar entries.

Important fields:

```text
content_idea_id
scheduled_for
channel
status
caption
asset_notes
approval_status
metadata_json
```

### business_followups

Follow-up tasks or reminders.

Important fields:

```text
organization_id
person_id
opportunity_id
action_draft_id
followup_type
due_at
status
notes
metadata_json
```

### business_learning_events

Stores feedback and outcome learning.

Important fields:

```text
entity_type
entity_id
event_type
outcome
score_delta
notes
metadata_json
```

## Safety fields

Most tables use one or more of these fields:

```text
status
risk_flags_json
confidence_score
metadata_json
created_at
updated_at
```

Action-related tables also use:

```text
approval_status
compliance_status
execution_status
```

## Status guidance

Common statuses:

```text
new
active
needs_review
approved
rejected
queued
blocked
suppressed
archived
```

## First migration

The foundation migration is:

```text
migrations/0021_business_autopilot_foundation.sql
```

It creates the metadata tables only. It must not enable external execution.
