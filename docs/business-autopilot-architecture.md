# EVAVO Business Autopilot architecture

This document defines the active internal architecture for EVAVO Business Autopilot.

The active system is a private, authenticated, review-first intelligence and metadata platform. It does not draft deliverable content, send messages, publish content, submit forms, execute browser actions, buy advertising, schedule external activity or mutate third-party systems.

## Authoritative operating principle

```text
Evidence-backed internal decisions and review metadata only.
```

Confirmation authorises only the specific internal D1 metadata write named by a route. Approval records, historical draft records, execution records and suppression records are compatibility or governance metadata. They never enable delivery.

## Current runtime posture

```text
scheduledExternalResearchEnabled: false
manualResearchRequiresAuthentication: true
manualResearchRequiresConfirmation: true
manualResearchIsBounded: true
manualResearchSavesReviewItemsOnly: true
draftingEnabled: false
emailSendingEnabled: false
socialPublishingEnabled: false
socialCommentingEnabled: false
formSubmissionEnabled: false
browserExecutionEnabled: false
adBuyingEnabled: false
externalStateChangeEnabled: false
autonomousCampaignsEnabled: false
```

Scheduled processing is internal-only. Cron must not research public sources, expand sources, discover opportunities, draft content or perform external actions.

## Active layers

### 1. Intelligence layer

Stores operator-provided or confirmed bounded-research evidence as internal metadata.

Includes:

```text
organization records
person records
website and page records
website audit observations
business signals
opportunity records
source and evidence quality metadata
```

There is no autonomous crawl queue or background research executor.

### 2. Evaluation layer

Produces deterministic internal scoring and review metadata.

Includes:

```text
fit scoring
need scoring
urgency scoring
budget-likelihood scoring
contactability scoring
evidence-quality scoring
risk scoring
confidence scoring
```

Scores are advisory and non-executable.

### 3. Strategy layer

Maps stored evidence to EVAVO services and internal review priorities.

Includes:

```text
EVAVO service matching
segment analysis
market-map summaries
competitor and peer signals
positioning recommendations
internal campaign-theme observations
```

### 4. Review-output layer

Creates internal review objects only.

Includes:

```text
website audit packs
opportunity briefs
service-match records
internal follow-up tasks
content ideas
manual-review recommendations
learning notes
```

Historical action-draft and approval records may remain readable, but they are non-deliverable and non-executable.

### 5. Governance layer

Enforces authentication, explicit confirmation, internal-only writes, bounded manual research, auditability and fail-closed behaviour.

Includes:

```text
route safety classification
confirmation gates
suppression metadata
risk flags
audit logs
historical compatibility records
```

### 6. Disabled execution layer

There is no active execution layer.

The following capabilities are blocked:

```text
send email
publish social content
comment on third-party content
submit contact forms
create external calendar invitations
write to external CRM systems
run browser automation
buy advertising
call delivery webhooks
mutate third-party systems
```

No approval, policy, stored setting, budget profile or historical status may activate these capabilities.

## Active capability level

The active Worker has one Business Autopilot level:

### Level 0: authenticated internal intelligence and review metadata

Allowed:

```text
read internal records
save confirmed internal metadata
run explicitly confirmed bounded manual public-source research
score stored evidence
build internal audit packs
record review outcomes
record learning metadata
```

Blocked:

```text
AI generation
external delivery
browser execution
scheduled external research
autonomous campaigns
third-party mutation
```

Historical labels such as draft-only, approval-required execution, capped campaign mode and broad external autonomy are not active levels.

## Data model families

The retained metadata foundation includes:

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
```

The names `business_action_drafts`, `business_approval_requests` and `business_execution_records` are historical schema compatibility names. Records in those tables do not authorise drafting, approval-to-delivery or execution.

## Useful operator outputs

The system may provide internal outputs such as:

```text
businesses worth manual review
website weaknesses by EVAVO service fit
website audit packs
stored evidence and confidence
service-match recommendations
internal follow-up tasks
content-topic observations
industries showing digital weakness
review outcomes and learning notes
```

It must not produce deliverable drafts or execute external activity.

## Non-goals

The active Business Autopilot must not:

```text
generate email or social drafts
send, post or comment
submit forms
schedule external activity
buy ads
execute browser actions
scrape behind authentication
call AI
turn approval metadata into permission
turn historical execution records into runnable work
```

Any future proposal to add an external capability requires a separate product decision, threat model, implementation, migration and independently enforced safety contract. Nothing in this document authorises that work.