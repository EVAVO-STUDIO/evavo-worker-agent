import { BusinessApprovalRequestInput } from './businessAutopilotTypes';
import { businessAutopilotMetadataWriteSafety } from './businessAutopilotSafety';

export type BusinessApprovalBuildInput = {
  actionDraftId?: string | null;
  draftType?: string | null;
  channel?: string | null;
  reviewChecklist?: string[];
  riskFlags?: string[];
  explicitBlocks?: string[];
  payload?: Record<string, unknown>;
  expiresAt?: string | null;
};

export type BusinessApprovalBuildResult = {
  approvalRequest: BusinessApprovalRequestInput;
  safety: ReturnType<typeof businessAutopilotMetadataWriteSafety>;
};

function clean(value?: string | null) {
  const text = value?.trim();
  return text || null;
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function buildBusinessActionDraftApproval(input: BusinessApprovalBuildInput): BusinessApprovalBuildResult {
  const reviewChecklist = unique([
    ...(input.reviewChecklist || []),
    'Confirm the historical review record is accurate and relevant.',
    'Confirm evidence is not private, sensitive or stale.',
    'Record suppression, privacy and legal risks.',
    'Choose a manual internal disposition only.',
    'Do not treat this review record as permission for an external step.',
  ]);
  const riskFlags = unique([
    ...(input.riskFlags || []),
    'historical_record_only',
    'review_only',
    'non_deliverable',
    'external_use_not_allowed_by_this_record',
    'approval_cannot_enable_execution',
  ]);
  const explicitBlocks = unique([
    ...(input.explicitBlocks || []),
    'This approval request records historical review metadata only.',
    'This approval request does not send email.',
    'This approval request does not post on social platforms.',
    'This approval request does not submit forms.',
    'This approval request does not execute browser actions.',
    'This approval request cannot authorise delivery or external mutation.',
  ]);

  return {
    approvalRequest: {
      actionDraftId: clean(input.actionDraftId) || undefined,
      requestType: 'business_action_draft_review',
      reviewChecklist,
      riskFlags,
      approvalReason: 'Review historical Business Autopilot metadata and record an internal disposition only.',
      expiresAt: clean(input.expiresAt) || undefined,
      metadata: {
        generatedBy: 'businessAutopilotApprovalBuilder',
        contract: 'business_historical_review_approval_v2',
        historicalOnly: true,
        reviewOnly: true,
        executable: false,
        deliverable: false,
        authoritativeForExecution: false,
        externalExecutionAllowed: false,
        draftType: clean(input.draftType),
        channel: clean(input.channel),
        explicitBlocks,
        payload: input.payload || {},
      },
    },
    safety: businessAutopilotMetadataWriteSafety(),
  };
}
