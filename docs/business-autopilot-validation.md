# Business Autopilot validation workflow

This document records the safe validation flow for the EVAVO Business Autopilot Worker layer.

Business Autopilot is currently an internal metadata, website/page memory, scoring, audit-pack and draft-only governance layer. It does not perform external execution.

## Hard safety posture

The Business Autopilot foundation must not:

```text
send email
post on social platforms
comment on third-party websites or posts
submit contact forms
execute browser actions
buy ads
mutate external systems
call AI from metadata routes
call network from metadata routes
bypass suppression
bypass unsubscribe or consent requirements
```

## Core local checks

Run from the Worker repo:

```powershell
cd C:\GitRepos\evavo-worker-agent
git pull
npm run business:autopilot:check
npm run typecheck
```

The Business checker guards:

```text
business docs
0021 migration
Business safety helpers
Business core types
Business website/page records
service matcher
opportunity scoring
audit-pack builder
audit-pack persistence
draft-only action builder
approval request builder
draft-review bundle builder
Business admin routes
Business website/page admin routes
Business route catalogue entries
route-contract printer
read-only verification printer
package scripts
```

## Route catalogue wiring

Run:

```powershell
npm run growth:route-catalogue:apply
npm run growth:route-delegates:check
npm run growth:route-safety-flags:check
```

Expected Business read route IDs:

```text
business_organizations
business_websites
business_pages
business_signals
business_opportunities
business_service_matches
business_audit_packs
business_action_drafts
business_approval_requests
business_suppression_list
business_content_ideas
business_followups
business_learning_events
```

Expected Business confirm-required route IDs:

```text
business_organization_save
business_website_save
business_page_save
business_signal_save
business_opportunity_save
business_service_match_save
business_audit_pack_save
business_action_draft_build
business_action_draft_save
business_approval_request_save
business_suppression_save
business_content_idea_save
business_followup_save
business_learning_event_save
```

## Remote route-contract smoke printer

Run:

```powershell
npm run business:route-contract:print
```

Then copy the printed PowerShell after setting:

```powershell
$env:WORKER_URL="https://your-worker-url"
$env:ADMIN_TOKEN="your-admin-token"
```

The route-contract smoke verifies:

```text
all Business route IDs are advertised
read routes are read-only
confirm routes require confirm
confirm routes are metadata-only
website/page read routes return safe metadata payloads
unconfirmed draft-builder writes are blocked
read route safety is safe
```

## Read-only verification printer

Run:

```powershell
npm run business:autopilot:readonly:print
```

Then copy the printed PowerShell after setting the same environment variables.

This reads all Business Autopilot read routes:

```text
/admin/business/organizations?limit=5
/admin/business/websites?limit=5
/admin/business/pages?limit=5
/admin/business/signals?limit=5
/admin/business/opportunities?limit=5
/admin/business/service-matches?limit=5
/admin/business/audit-packs?limit=5
/admin/business/action-drafts?limit=5
/admin/business/approval-requests?limit=5
/admin/business/suppression?limit=5
/admin/business/content-ideas?limit=5
/admin/business/followups?limit=5
/admin/business/learning?limit=5
```

Each response must be:

```text
ok: true
safety.readOnly: true
safety.internalMetadataOnly: true
safety.externalStateChange: false
safety.callsAI: false
safety.callsNetwork: false
safety.canSendEmail: false
safety.canPostSocial: false
safety.canSubmitForms: false
```

## Full Worker validation sequence

```powershell
cd C:\GitRepos\evavo-worker-agent
git pull
npm run db:migration:one -- 0021 --execute
npm run growth:wiring:apply
npm run growth:route-catalogue:apply
npm run business:autopilot:check
npm run growth:backend:check:local
npm run business:route-contract:print
npm run business:autopilot:readonly:print
npm run growth:backend:final:print
```

## Next dashboard follow-up

After Worker validation, open the Next Operations Hub:

```text
http://localhost:3000/ops/outbound-agent-config#business-autopilot
```

Confirm the panel shows:

```text
organizations
websites
pages
signals
opportunities
service matches
audit packs
draft records
approval requests
suppression
content ideas
follow-ups
learning events
execution blocked
approvals Worker-only
read-only proxy safety
Worker payload safety
```
