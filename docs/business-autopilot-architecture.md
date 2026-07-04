# EVAVO Business Autopilot architecture

The EVAVO Business Autopilot is the broader governed autonomy layer above Growth Ops.

Growth remains a core use case, but the platform should support a wider agency operating model:

```text
business intelligence
opportunity discovery
website and market audits
service matching
content strategy
relationship memory
approval packs
action drafts
controlled execution
learning loops
```

## Operating principle

```text
Evidence-backed decisions and approved actions, not uncontrolled automation.
```

The system should autonomously research, organise, score, draft, monitor, and recommend. External actions such as email, social publishing, commenting, contact-form submission, ad buying, or other state-changing actions require explicit governance, approval, suppression checks, and audit records.

## Core layers

### 1. Intelligence layer

Responsible for reading public or operator-approved sources, extracting facts, classifying entities, and creating evidence records.

Includes:

```text
source discovery
robots / crawl policy
fetch queue
page evidence extraction
entity resolution
signal extraction
source quality scoring
```

### 2. Evaluation layer

Responsible for deciding whether a business is worth attention.

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

### 3. Strategy layer

Responsible for mapping evidence to EVAVO services and campaign angles.

Includes:

```text
EVAVO service matching
segment analysis
market-map summaries
competitor and peer signals
positioning recommendations
campaign theme recommendations
```

### 4. Action-preparation layer

Responsible for preparing useful human-reviewable outputs.

Includes:

```text
website audit packs
opportunity briefs
email drafts
LinkedIn draft posts
LinkedIn draft comments
contact-form message drafts
proposal intros
follow-up drafts
CRM notes
calendar / task suggestions
```

### 5. Governance layer

Responsible for making sure actions are legal, safe, brand-appropriate, capped, auditable, and reversible.

Includes:

```text
approval queue
consent and lawful-basis records
suppression list
unsubscribe readiness
sender identity checks
daily and campaign caps
risk flags
audit logs
kill switch
```

### 6. Execution layer

Responsible for performing only approved controlled actions.

Early execution should be internal-only.

Allowed early:

```text
create internal task
create internal reminder
create CRM note
send internal report
save approved content to calendar
```

Allowed later only after compliance/governance is proven:

```text
send approved email
publish approved owned social post
schedule approved content
```

High-friction / late-stage only:

```text
comment on third-party posts
submit contact forms
any browser automation
any paid ad action
```

## Autonomy levels

### Level 0: Read-only intelligence

The system may research, extract, score, summarise, and recommend.

Blocked:

```text
send email
post socially
comment
submit forms
log in
spend money
mutate external systems
```

### Level 1: Draft-only

The system may draft messages, posts, comments, proposals, audit summaries, and follow-ups.

External execution remains blocked.

### Level 2: Approval-required execution

The system may execute a specific action only after an explicit approval record exists.

### Level 3: Rules-approved internal actions

The system may automatically tag leads, create internal notes, schedule reminders, or send internal summaries under configured caps.

### Level 4: Capped campaign mode

The system may execute tightly scoped external campaigns only when all of these exist:

```text
approved audience
approved template family
send / publish caps
suppression checks
unsubscribe readiness where required
audit logs
kill switch
```

### Level 5: Broad external autonomy

Blocked until the system has proven reliability, compliance, feedback learning, suppression handling, and operator trust.

## Data model families

The foundation model is split into reusable families:

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

## Useful operator outputs

The Business Autopilot should provide weekly outputs such as:

```text
Top businesses worth reviewing
Weak websites by EVAVO service fit
Recommended website teardown packs
Recommended outreach angles
Prepared action drafts
Content ideas from market patterns
Industries showing strongest digital weakness
Follow-ups due
Rejected leads and why
Learning from approvals and rejections
```

## Non-goals for the first implementation

The first implementation must not send, post, comment, submit forms, buy ads, execute browser actions, scrape behind logins, or call AI from browser-proxied routes.

The first implementation should create the durable foundation for these future capabilities:

```text
metadata storage
route catalogue safety
read-only Next visibility
approval records
action drafts
execution records
suppression records
learning records
```
