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

function firstName(value?: string | null) {
  const name = clean(value);
  return name ? name.split(/\s+/)[0] : '';
}

function serviceLabel(value?: string | null) {
  const key = clean(value, 'digital improvement').replaceAll('_', ' ');
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function greeting(input: BusinessDraftBuildInput) {
  const name = firstName(input.contactName);
  return name ? `Hi ${name},` : 'Hi,';
}

function subjectFor(input: BusinessDraftBuildInput) {
  const organization = clean(input.organizationName, 'your website');
  const service = serviceLabel(input.recommendedService);
  if (input.intent === 'follow_up') return `Following up on ${organization}`;
  if (input.intent === 'linkedin_dm') return `Quick thought for ${organization}`;
  if (input.intent === 'content_idea') return `Content idea for ${organization}`;
  if (input.intent === 'internal_note') return `Internal note: ${organization}`;
  return `${organization} ${service} opportunity`;
}

function buildBody(input: BusinessDraftBuildInput) {
  const organization = clean(input.organizationName, 'your business');
  const evidence = clean(input.evidenceSummary, 'I noticed a few areas where the digital experience could potentially be clearer, faster or easier to convert.');
  const angle = clean(input.recommendedAngle, 'There may be an opportunity to improve the customer journey and make the site work harder as a sales asset.');
  const nextStep = clean(input.nextStep, 'I can put together a short, practical review with the most useful fixes and opportunities.');

  if (input.intent === 'internal_note') {
    return [
      `Internal review note for ${organization}.`,
      '',
      `Evidence: ${evidence}`,
      `Recommended angle: ${angle}`,
      `Next step: ${nextStep}`,
      '',
      'Do not send externally until suppression, approval, contactability and compliance checks have passed.',
    ].join('\n');
  }

  if (input.intent === 'content_idea') {
    return [
      `Content idea for ${organization}:`,
      '',
      `Create a short practical teardown around: ${angle}`,
      '',
      `Evidence basis: ${evidence}`,
      '',
      'Keep this as an internal content draft until reviewed. Do not publish or comment externally from this system.',
    ].join('\n');
  }

  if (input.intent === 'linkedin_dm') {
    return [
      greeting(input),
      '',
      `I came across ${organization} and noticed something that may be worth reviewing: ${evidence}`,
      '',
      `${angle}`,
      '',
      'No pressure at all, but I thought it may be useful to flag. Happy to send a short practical teardown if helpful.',
      '',
      'Greg',
    ].join('\n');
  }

  if (input.intent === 'follow_up') {
    return [
      greeting(input),
      '',
      `Just following up on the ${organization} digital opportunity I noted earlier.`,
      '',
      `The main point was: ${angle}`,
      '',
      `${nextStep}`,
      '',
      'Greg',
    ].join('\n');
  }

  return [
    greeting(input),
    '',
    `I came across ${organization} and noticed a few things that may be worth reviewing from a digital/customer journey point of view.`,
    '',
    `The main evidence was: ${evidence}`,
    '',
    `${angle}`,
    '',
    `${nextStep}`,
    '',
    'Greg',
  ].join('\n');
}

function draftTypeFor(intent: BusinessDraftBuildIntent): BusinessActionDraftInput['draftType'] {
  if (intent === 'linkedin_dm') return 'linkedin_dm';
  if (intent === 'follow_up') return 'follow_up';
  if (intent === 'internal_note') return 'crm_note';
  if (intent === 'content_idea') return 'internal_report';
  return 'email';
}

function channelFor(intent: BusinessDraftBuildIntent) {
  if (intent === 'linkedin_dm') return 'linkedin';
  if (intent === 'content_idea') return 'content';
  if (intent === 'internal_note') return 'internal';
  return 'email';
}

export function buildBusinessDraftOnlyAction(input: BusinessDraftBuildInput): BusinessDraftBuildResult {
  const intent = input.intent || 'audit_email';
  const riskFlags = ['draft_only', 'approval_required', 'suppression_check_required', 'contactability_check_required'];
  const explicitBlocks = [
    'Do not send email from this route.',
    'Do not post on social platforms from this route.',
    'Do not comment on third-party websites or posts from this route.',
    'Do not submit contact forms from this route.',
    'Do not execute browser actions from this route.',
    'Do not bypass suppression, unsubscribe or consent requirements.',
  ];
  const reviewChecklist = [
    'Confirm the organization and contact are correct.',
    'Confirm evidence is accurate, current and not sensitive.',
    'Check suppression and unsubscribe state before any future external action.',
    'Check jurisdiction-specific outreach requirements before any future send.',
    'Check tone, relevance and EVAVO positioning.',
    'Get explicit operator approval before any external action.',
  ];

  return {
    draft: {
      organizationId: clean(input.organizationId) || undefined,
      personId: clean(input.personId) || undefined,
      opportunityId: clean(input.opportunityId) || undefined,
      auditPackId: clean(input.auditPackId) || undefined,
      draftType: draftTypeFor(intent),
      channel: channelFor(intent),
      subject: subjectFor({ ...input, intent }),
      body: buildBody({ ...input, intent }),
      payload: {
        intent,
        organizationName: clean(input.organizationName) || null,
        recommendedService: clean(input.recommendedService) || null,
        recommendedAngle: clean(input.recommendedAngle) || null,
        evidenceSummary: clean(input.evidenceSummary) || null,
        nextStep: clean(input.nextStep) || null,
        tone: input.tone || 'low_key',
      },
      riskFlags,
      metadata: {
        generatedBy: 'businessAutopilotActionDraftBuilder',
        externalExecution: false,
        requiresApproval: true,
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
