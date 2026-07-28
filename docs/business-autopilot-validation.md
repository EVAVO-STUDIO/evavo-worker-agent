# Business Autopilot validation workflow

This document defines the safe validation flow for the EVAVO Business Autopilot Worker layer.

The active Business Autopilot is an authenticated, internal-metadata, scoring, website/page memory, audit and review system. It does not generate deliverable outreach, authorise execution or perform external actions.

## Hard safety posture

The Business Autopilot must not:

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
create approval-to-execution authority
```

Historical draft-shaped and approval-shaped records remain readable for compatibility only. They are non-deliverable, non-executable and non-authoritative for execution.

## Core local checks

Run from the Worker repository:

```powershell
cd C:\GitRepos\evavo-worker-agent
git pull origin main
git rev-parse HEAD

npm run business:draft-runtime-safety:check
npm run business:historical-record-posture:check
npm run business:autopilot:check
npm run business:score-provenance:check
npm run business:website-pages:docs:check
npm run business:route-policy:check
npm run safety:gates:check
npm run typecheck
npm run check:local
```

These checks are read-only against repository files. They do not deploy, invoke Worker routes, apply migrations or change D1.

## Guarded implementation areas

The validation contracts cover:

```text
business docs
0021, 0022 and 0024 migration presence
Business safety helpers
Business score observation provenance helpers
atomic score and observation-flag writers
Business core types
Business people records
Business website/page records
service matching
opportunity scoring
audit-pack persistence
Account 360 observed-score reads
historical review-record builder
non-authoritative approval compatibility builder
review bundle with approval creation disabled
Business admin routes
Business people admin routes
Business website/page admin routes
Business route catalogue entries
route-contract printer
read-only verification printer
package safety scripts
```

The website/page documentation checker continues to require:

```text
business_websites
business_pages
business_website_save
business_page_save
/admin/business/websites?limit=5
/admin/business/pages?limit=5
```

## Score provenance and Account 360

Migration `0024_business_score_observation_flags.sql` adds one observation flag beside every score used by Account 360. The flag distinguishes a deliberately observed score of `0` from an old `NOT NULL DEFAULT 0` sentinel.

The active read contracts are:

```text
business_account_360_observed_scores_v1
business_score_observation_flags_v1
business_account_360_bounded_chronology_v1
```

The required score semantics are:

```text
observationFlagsRequired: true
explicitZeroPreserved: true
unobservedValuesReturnedAsNull: true
```

A score-bearing write must save the numeric value and its observation flag in one D1 statement. Active organization, person, signal, opportunity, service-match, audit-pack, website-audit-run and audit-observation routes use the shared atomic provenance writers.

Account 360 must:

```text
show an explicitly observed zero as 0
return an unobserved, missing, malformed or out-of-range score as null
exclude invalid or future timestamps from latest-evidence chronology
report whether a bounded collection may be truncated
withhold scores when the exact provenance contract is absent
return 0024_business_score_observation_flags.sql as the required migration when observation columns are missing
```

The focused repository guard is:

```powershell
npm run business:score-provenance:check
```

The guard checks source contracts and executable fixtures. It does not apply migration `0024`.

## Active route catalogue

The active read route IDs are:

```text
business_organizations
business_people
business_websites
business_pages
business_website_audit_runs
business_audit_observations
business_audit_observation_candidates
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

`business_action_drafts` and `business_approval_requests` are authenticated historical reads. Their records are not deliverable and cannot authorise execution.

The active confirm-required internal metadata route IDs are:

```text
business_organization_save
business_person_save
business_website_save
business_page_save
business_website_audit_run_save
business_audit_observation_save
business_signal_save
business_opportunity_save
business_service_match_save
business_audit_pack_save
business_action_draft_build
business_suppression_save
business_content_idea_save
business_followup_save
business_learning_event_save
```

`business_action_draft_build` is a retained compatibility identifier. It saves one internal historical review record only. It does not create deliverable copy or an executable approval.

These disabled routes must not be advertised by the active catalogue:

```text
business_action_draft_save
business_approval_request_save
```

Direct POST requests to their underlying paths return `410 Gone`.

## Route-contract smoke printer

Generate the optional remote verification commands with:

```powershell
npm run business:route-contract:print
```

Only run the printed commands against an explicitly chosen Worker URL with `ADMIN_TOKEN` set. The printer verifies:

```text
all active Business route IDs are advertised
disabled direct draft and approval write IDs are absent
read routes are read-only and non-executing
confirm routes require explicit confirmation
confirm routes call no network or AI
no route advertises email, social or form capability
historical draft and approval reads retain safe metadata posture
```

The smoke printer does not itself call the Worker; it only prints PowerShell.

## Read-only verification printer

Generate authenticated read checks with:

```powershell
npm run business:autopilot:readonly:print
```

The read routes include:

```text
/admin/business/organizations?limit=5
/admin/business/people?limit=5
/admin/business/websites?limit=5
/admin/business/pages?limit=5
/admin/business/website-audit-runs?limit=5
/admin/business/audit-observations?limit=5
/admin/business/audit-observation-candidates?limit=5
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

Each response must retain:

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

Historical record responses must additionally remain non-executable and non-deliverable.

## Migration and generated-route safety

Routine validation must not execute migrations or rewrite generated route files.

Do not include these mutation commands in a normal validation run:

```text
npm run db:migration:one -- <migration> --execute
npm run growth:wiring:apply
npm run growth:route-catalogue:apply
```

Migration execution requires a separate, explicit database-target decision and the repository migration-safety workflow. Generated-route application is a maintenance action, not a validation step.

Before activating the observed-score runtime against a D1 target, verify that `0024` is absent, then use the guarded migration command separately from validation:

```powershell
npm run db:verify:print -- --remote
npm run db:migration:one -- 0024_business_score_observation_flags.sql --remote --confirm-database evavo_outbound_agent
npm run db:migration:one -- 0024_business_score_observation_flags.sql --remote --execute --confirm-database evavo_outbound_agent --confirm-unapplied
```

Do not reapply `0024` after its columns exist. The migration is one-time schema work and is not executed by any repository check.

## Dashboard verification

The Worker repository does not validate the Next dashboard by mutating it. Dashboard verification is read-only and should confirm that:

```text
historical draft and approval records are labelled as non-executable
all delivery controls remain absent
explicit observed zero scores render as 0
unobserved scores render as Not recorded
scores are withheld when the provenance contract is missing
latest-evidence time is withheld when bounded chronology is unverified
```
