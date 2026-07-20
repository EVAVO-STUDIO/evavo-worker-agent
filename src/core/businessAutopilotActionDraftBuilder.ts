import { businessAutopilotMetadataWriteSafety } from './businessAutopilotSafety';
import { BusinessActionDraftInput } from './businessAutopilotTypes';

export type BusinessDraftBuildIntent = 'audit_email' | 'linkedin_dm' | 'follow_up' | 'internal_note' | 'content_idea';

export type BusinessDraftBuildInput = {
  intent?: BusinessDraftBuildIntent;
  organizationId?: string | null;
  organizationName?: string | null;
  personId?: string | null;
  opportunityId?: string | null;
  auditPackId?: string | null;
  recommendedService?: string | null;
  recommendedAngle?: string | null;
  evidenceSummary?: string | null;
  nextStep?: string | null;
  contactName?: string | null;
  tone?: 'low_key' | 'direct' | 'consultative';
};

export type BusinessDraftBuildResult = {
  draft: BusinessActionDraftInput;
  reviewChecklist: string[];
  explicitBlocks: string[];
  riskFlags: string[];
  safety: ReturnType<typeof businessAutopilotMetadataWriteSafety>;
};

function clean(value?: string | null, fallback = '') {
  const text = value?.trim();
  return text || fallback;
}

function compatibilityIntent(value?: BusinessDraftBuildIntent): BusinessDraftBuildIntent {
  return value || 'internal_note';
}

function reviewSubject(input: BusinessDraftBuildInput) {
  const organization = clean(input.organizationName, 'Unspecified organization');
  return `Internal review record: ${organization}`;
}

function reviewBody(input: BusinessDraftBuildInput) {
  const organization = clean(input.organizationName, 'Unspecified organization');
  const evidence = clean(input.evidenceSummary, 'No evidence summary supplied.');
  const angle = clean(input.recommendedAngle, 'No recommendation supplied.');
  const nextStep = clean(input.nextStep, 'Manual review required.');

  return [
    `Internal Business Autopilot review record for ${organization}.`,
    '',
    `Evidence: ${evidence}`,
    `Recommendation: ${angle}`,
    `Manual next step: ${nextStep}`,
    '',
    'This record is not a message, draft, approval or delivery instruction.',
    'Do not send, post, submit, publish or otherwise use it externally.',
  ].join('\n');
}

export function buildBusinessDraftOnlyAction(input: BusinessDraftBuildInput): BusinessDraftBuildResult {
  const intent = compatibilityIntent(input.intent);
  const riskFlags = [
    'historical_record_only',
    'review_only',
    'non_deliverable',
    'external_use_not_allowed_by_this_record',
    'approval_cannot_enable_execution',
  ];
  const explicitBlocks = [
    'Do not send email from this route.',
    'Do not post on social platforms from this route.',
    'Do not comment on third-party websites or posts from this route.',
    'Do not submit contact forms from this route.',
    'Do not execute browser actions from this route.',
    'Do not bypass suppression, unsubscribe or consent requirements.',
    'Do not treat this record as deliverable copy or an approval to act.',
  ];
  const reviewChecklist = [
    'Confirm the organization and evidence references are correct.',
    'Confirm evidence is accurate, current and not sensitive.',
    'Record any suppression, privacy or legal risk.',
    'Choose a manual internal next step or mark the record blocked.',
    'Do not convert this record into external communication inside this Worker.',
  ];

  return {
    draft: {
      organizationId: clean(input.organizationId) || undefined,
      personId: clean(input.personId) || undefined,
      opportunityId: clean(input.opportunityId) || undefined,
      auditPackId: clean(input.auditPackId) || undefined,
      draftType: 'crm_note',
      channel: 'internal',
      subject: reviewSubject(input),
      body: reviewBody(input),
      payload: {
        compatibilityIntent: intent,
        organizationName: clean(input.organizationName) || null,
        recommendedService: clean(input.recommendedService) || null,
        recommendedAngle: clean(input.recommendedAngle) || null,
        evidenceSummary: clean(input.evidenceSummary) || null,
        nextStep: clean(input.nextStep) || null,
        requestedTone: input.tone || null,
        historicalOnly: true,
        executable: false,
        deliverable: false,
        authoritativeForExecution: false,
      },
      riskFlags,
      metadata: {
        generatedBy: 'businessAutopilotActionDraftBuilder',
        contract: 'business_historical_review_record_v2',
        historicalOnly: true,
        reviewOnly: true,
        executable: false,
        deliverable: false,
        authoritativeForExecution: false,
        externalExecution: false,
        requiresApproval: false,
        explicitBlocks,
        reviewChecklist,
      },
    },
    reviewChecklist,
    explicitBlocks,
    riskFlags,
    safety: businessAutopilotMetadataWriteSafety(),
  };
}
