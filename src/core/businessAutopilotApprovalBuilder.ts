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
    'Confirm the draft is still accurate and relevant.',
    'Confirm evidence is not private, sensitive or stale.',
    'Confirm suppression and unsubscribe state before any future external use.',
    'Confirm jurisdiction-specific outreach rules before any future external use.',
    'Confirm the operator explicitly approves any future external step.',
  ]);
  const riskFlags = unique([
    ...(input.riskFlags || []),
    'approval_required',
    'suppression_check_required',
    'external_use_not_allowed_by_this_record',
  ]);
  const explicitBlocks = unique([
    ...(input.explicitBlocks || []),
    'This approval request records review intent only.',
    'This approval request does not send email.',
    'This approval request does not post on social platforms.',
    'This approval request does not submit forms.',
    'This approval request does not execute browser actions.',
  ]);

  return {
    approvalRequest: {
      actionDraftId: clean(input.actionDraftId) || undefined,
      requestType: 'business_action_draft_review',
      reviewChecklist,
      riskFlags,
      approvalReason: 'Review a draft-only Business Autopilot action before any future operator-approved external use.',
      expiresAt: clean(input.expiresAt) || undefined,
      metadata: {
        generatedBy: 'businessAutopilotApprovalBuilder',
        draftType: clean(input.draftType),
        channel: clean(input.channel),
        explicitBlocks,
        payload: input.payload || {},
      },
    },
    safety: businessAutopilotMetadataWriteSafety(),
  };
}
