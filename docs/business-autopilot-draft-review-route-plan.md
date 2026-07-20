# Business Autopilot historical review-record plan

Historical compatibility title: `Business Autopilot draft review route plan`.

This document preserves compatibility context for the historical Business Autopilot draft and approval record builders.

It is not an active roadmap for drafting or delivery. The current Worker is internal-metadata-only and non-executing.

## Compatibility components

```text
src/core/businessAutopilotActionDraftBuilder.ts
src/core/businessAutopilotApprovalBuilder.ts
src/core/businessAutopilotDraftReviewBundle.ts
src/core/businessAutopilotRecords.ts
src/routes/businessAutopilotAdmin.ts
```

These names remain because existing records, route contracts and validators reference them. Their presence does not enable a capability.

## Existing compatibility route

```text
POST /admin/business/action-drafts/build?confirm=1
```

The route is confirmation-gated and may create internal review metadata only. It must report:

```text
internalMetadataOnly: true
reviewOnly: true
externalExecutionAllowed: false
callsNetwork: false
callsAI: false
```

Confirmation authorises only the named internal metadata write. It cannot authorise delivery, browser work or external mutation.

## Historical builder contract

Compatibility helpers include:

```ts
buildBusinessDraftReviewBundle(input)
saveBusinessActionDraft(env, bundle.draftBuild.draft)
saveBusinessApprovalRequest(env, {
  ...bundle.approvalBuild.approvalRequest,
  actionDraftId: savedDraft.id,
})
```

Any records produced by these helpers must be treated as historical review records:

```text
historicalOnly: true
executable: false
deliverable: false
authoritativeForExecution: false
external_use_not_allowed_by_this_record
```

A stored `approvalStatus`, `requestType` or review checklist never enables another action.

## Compatibility response fields

Existing consumers may still expect:

```text
mode: business_action_draft_built
draft
approvalRequest
reviewSummary
reviewChecklist
explicitBlocks
riskFlags
safety
```

These are compatibility fields. They must not be presented as a deliverable message or executable approval.

`createApprovalRequest: false` may remain supported for compatibility. Whether true or false, no delivery permission is created.

## Historical block labels

The following exact phrases are retained only for existing validator compatibility:

```text
no email sending
no social posting
no contact-form submission
no browser execution
```

They describe permanent blocks, not available actions.

## Permanent blocks

The route and helpers must remain unable to perform external communication, browser automation, paid activity, AI generation, network research or third-party mutation.

## Validation requirements

`npm run business:autopilot:check` must continue guarding:

```text
src/core/businessAutopilotActionDraftBuilder.ts
src/core/businessAutopilotApprovalBuilder.ts
src/core/businessAutopilotDraftReviewBundle.ts
business_action_draft_build
/admin/business/action-drafts/build
business_action_draft_review
external_use_not_allowed_by_this_record
createApprovalRequest: false
```

The route-contract smoke printer must continue to reject unconfirmed calls.

No future implementation is authorised by this document.