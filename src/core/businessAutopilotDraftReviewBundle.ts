import { buildBusinessDraftOnlyAction, BusinessDraftBuildInput } from './businessAutopilotActionDraftBuilder';
import { buildBusinessActionDraftApproval } from './businessAutopilotApprovalBuilder';
import { businessAutopilotMetadataWriteSafety } from './businessAutopilotSafety';

export type BusinessDraftReviewBundleInput = BusinessDraftBuildInput & {
  createApprovalRequest?: boolean;
  approvalExpiresAt?: string | null;
};

export type BusinessDraftReviewBundle = {
  draftBuild: ReturnType<typeof buildBusinessDraftOnlyAction>;
  approvalBuild: ReturnType<typeof buildBusinessActionDraftApproval> | null;
  reviewSummary: {
    needsApproval: boolean;
    draftOnly: true;
    externalExecutionAllowed: false;
    blockedExternalActions: string[];
    operatorChecklist: string[];
  };
  safety: ReturnType<typeof businessAutopilotMetadataWriteSafety>;
};

export function buildBusinessDraftReviewBundle(input: BusinessDraftReviewBundleInput): BusinessDraftReviewBundle {
  const draftBuild = buildBusinessDraftOnlyAction(input);
  const createApprovalRequest = input.createApprovalRequest !== false;
  const approvalBuild = createApprovalRequest
    ? buildBusinessActionDraftApproval({
        actionDraftId: undefined,
        draftType: draftBuild.draft.draftType,
        channel: draftBuild.draft.channel,
        reviewChecklist: draftBuild.reviewChecklist,
        riskFlags: draftBuild.riskFlags,
        explicitBlocks: draftBuild.explicitBlocks,
        payload: draftBuild.draft.payload,
        expiresAt: input.approvalExpiresAt || undefined,
      })
    : null;

  const blockedExternalActions = [
    'send_email',
    'post_social',
    'comment_social',
    'submit_form',
    'execute_browser_action',
    'mutate_external_system',
    'buy_ads',
  ];

  return {
    draftBuild,
    approvalBuild,
    reviewSummary: {
      needsApproval: createApprovalRequest,
      draftOnly: true,
      externalExecutionAllowed: false,
      blockedExternalActions,
      operatorChecklist: approvalBuild?.approvalRequest.reviewChecklist || draftBuild.reviewChecklist,
    },
    safety: businessAutopilotMetadataWriteSafety(),
  };
}
