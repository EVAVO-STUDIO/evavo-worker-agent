# Business Autopilot draft review route plan

This plan documents the intended route glue between the draft-only action builder and the approval request builder.

The direct admin route patch was blocked by the connector safety layer, so the current implementation keeps the core pieces separate and guarded:

```text
src/core/businessAutopilotActionDraftBuilder.ts
src/core/businessAutopilotApprovalBuilder.ts
src/core/businessAutopilotDraftReviewBundle.ts
src/core/businessAutopilotRecords.ts
src/routes/businessAutopilotAdmin.ts
```

## Existing route

```text
POST /admin/business/action-drafts/build?confirm=1
```

Current behavior:

1. Requires confirmation.
2. Builds a draft-only action via `buildBusinessDraftOnlyAction`.
3. Saves the generated draft to `business_action_drafts`.
4. Returns the saved draft, review checklist, explicit blocks, risk flags and safety posture.

Current hard blocks:

```text
no email sending
no social posting
no third-party commenting
no contact-form submission
no browser execution
no ad buying
no external mutation
no AI calls
no network calls
```

## Intended next glue

The safe route implementation should use:

```ts
buildBusinessDraftReviewBundle(input)
saveBusinessActionDraft(env, bundle.draftBuild.draft)
saveBusinessApprovalRequest(env, {
  ...bundle.approvalBuild.approvalRequest,
  actionDraftId: savedDraft.id,
})
```

The route response should include:

```text
ok: true
mode: business_action_draft_built
draft
approvalRequest
reviewSummary
reviewChecklist
explicitBlocks
riskFlags
safety
```

## Approval defaults

The approval record should use:

```text
requestType: business_action_draft_review
approvalStatus: pending
riskFlags includes approval_required
riskFlags includes suppression_check_required
riskFlags includes external_use_not_allowed_by_this_record
```

The approval metadata should preserve:

```text
generatedBy: businessAutopilotApprovalBuilder
draftType
channel
explicitBlocks
payload
```

## Optional behavior

The route may support:

```text
createApprovalRequest: false
```

When false, it should still save the draft and return the bundle review summary, but `approvalRequest` should be `null`.

## Non-goals

This route must not:

```text
send email
post social content
comment on third-party websites or posts
submit contact forms
execute browser actions
buy ads
mutate external systems
call AI
make network calls
bypass suppression
bypass unsubscribe or consent requirements
```

## Validation requirements

`npm run business:autopilot:check` must keep guarding:

```text
src/core/businessAutopilotActionDraftBuilder.ts
src/core/businessAutopilotApprovalBuilder.ts
src/core/businessAutopilotDraftReviewBundle.ts
business_action_draft_build
/admin/business/action-drafts/build
business_action_draft_review
external_use_not_allowed_by_this_record
```

The route-contract smoke printer should continue to verify that unconfirmed calls to the build route are rejected.
