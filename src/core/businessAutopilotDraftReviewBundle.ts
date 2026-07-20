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
    needsApproval: false;
    draftOnly: false;
    historicalOnly: true;
    reviewOnly: true;
    deliverable: false;
    authoritativeForExecution: false;
    externalExecutionAllowed: false;
    blockedExternalActions: string[];
    operatorChecklist: string[];
  };
  safety: ReturnType<typeof businessAutopilotMetadataWriteSafety>;
};

export function buildBusinessDraftReviewBundle(input: BusinessDraftReviewBundleInput): BusinessDraftReviewBundle {
  const draftBuild = buildBusinessDraftOnlyAction(input);
  const blockedExternalActions = [
    'send_email',
    'post_social',
    'comment_social',
    'submit_form',
    'execute_browser_action',
    'mutate_external_system',
    'buy_ads',
    'generate_deliverable_draft',
    'create_executable_approval',
  ];

  return {
    draftBuild,
    approvalBuild: null,
    reviewSummary: {
      needsApproval: false,
      draftOnly: false,
      historicalOnly: true,
      reviewOnly: true,
      deliverable: false,
      authoritativeForExecution: false,
      externalExecutionAllowed: false,
      blockedExternalActions,
      operatorChecklist: draftBuild.reviewChecklist,
    },
    safety: businessAutopilotMetadataWriteSafety(),
  };
}
