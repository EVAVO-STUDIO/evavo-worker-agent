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

## Website/page relationship layer

Website and page records provide the evidence spine between an organization and later Business Autopilot signals.

Canonical relationship:

```text
business_organizations
→ business_websites
→ business_pages
→ business_signals
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
```

Route catalogue IDs:

```text
business_websites
business_pages
business_website_save
business_page_save
```

Safety requirements:

```text
metadata-only
read routes advertise readOnly and internalMetadataOnly
write routes require confirm=1
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
