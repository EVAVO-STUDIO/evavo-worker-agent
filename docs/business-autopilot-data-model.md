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

Business people records are contact-context metadata only. `allowed_use` and `contact_status` describe what the operator currently knows about lawful/appropriate use and contactability. They do not grant permission to send, post, comment, submit forms, enrich contacts, scrape profiles, or execute browser actions.

People route layer:

```text
GET  /admin/business/people?limit=25
POST /admin/business/people?confirm=1
```

People route catalogue IDs:

```text
business_people
business_person_save
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

### business_website_audit_runs

Represents metadata for a website or funnel audit run. This is a record of internal review state, not a crawler or browser-automation instruction.

Important fields:

```text
website_id
organization_id
status
audit_type
source
requested_by
started_at
completed_at
readiness_score
risk_score
confidence_score
summary
metadata_json
```

### business_audit_observations

Represents a structured website, UX, funnel, analytics or conversion observation that can support an audit pack, opportunity, service match or draft-only review.

Important fields:

```text
audit_run_id
website_id
organization_id
page_id
signal_id
category
severity
title
evidence_summary
recommendation
confidence_score
metadata_json
```

### business_audit_observation_candidates

This is a read-only computed route, not a durable table. `GET /admin/business/audit-observation-candidates?limit=25` derives unsaved review candidates from stored internal metadata only.

Candidate inputs:

```text
business_websites
business_pages
business_signals
business_website_audit_runs
business_audit_observations
```

Candidate outputs use:

```text
observationCandidates
reviewOnly: true
source: internal_metadata
safety.readOnly: true
```

The candidate route does not crawl, fetch, send, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems.

## Website/page relationship layer

Website and page records provide the evidence spine between an organization and later Business Autopilot signals.

Canonical relationship:

```text
business_organizations
→ business_websites
→ business_pages
→ business_signals
→ business_website_audit_runs
→ business_audit_observations
→ business_audit_observation_candidates
→ business_opportunities
→ business_audit_packs
→ business_action_drafts
→ business_approval_requests
```

People/contact-context relationship:

```text
business_organizations
→ business_people
→ allowed-use review
→ contactability check
→ draft-only action
→ approval request
```

Route layer:

```text
GET  /admin/business/websites?limit=25
POST /admin/business/websites?confirm=1
GET  /admin/business/pages?limit=25
POST /admin/business/pages?confirm=1
GET  /admin/business/website-audit-runs?limit=25
POST /admin/business/website-audit-runs?confirm=1
GET  /admin/business/audit-observations?limit=25
POST /admin/business/audit-observations?confirm=1
GET  /admin/business/audit-observation-candidates?limit=25
```

Route catalogue IDs:

```text
business_websites
business_pages
business_website_audit_runs
business_audit_observations
business_audit_observation_candidates
business_website_save
business_page_save
business_website_audit_run_save
business_audit_observation_save
```

Safety requirements:

```text
metadata-only
read routes advertise readOnly and internalMetadataOnly
write routes require confirm=1
observation candidates are read-only and unsaved
no crawling
no fetching
no email sending
no social posting
no third-party commenting
no contact-form submission
no browser execution
no ad buying
no external mutation
no AI calls from metadata routes
no network calls from metadata routes
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
funnels
hotspot
ecommerce
performance_maintenance
content_strategy
```

### business_audit_packs

Evidence-backed teardown package for review and draft preparation.

Important fields:

```text
organization_id
opportunity_id
status
summary
evidence_json
recommendations_json
risk_flags_json
score_json
metadata_json
```

### business_action_drafts

Draft-only action metadata. Drafts do not send or execute.

Important fields:

```text
organization_id
opportunity_id
audit_pack_id
draft_type
status
subject
body
review_checklist_json
risk_flags_json
metadata_json
```

### business_approval_requests

Internal approval records for future operator review.

Important fields:

```text
draft_id
status
approval_type
request_summary
review_checklist_json
risk_flags_json
metadata_json
```

### business_suppression_list

Do-not-contact, block, suppression and safety memory. Suppression wins over enthusiasm and must be visible in review.

### business_content_ideas

Internal content and campaign idea memory.

### business_followups

Internal follow-up/task metadata.

### business_learning_events

Operator feedback, outcomes and learning notes.
