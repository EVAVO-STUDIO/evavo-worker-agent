import { BusinessSignalLike, matchEvavoServicesFromSignals } from './businessAutopilotServiceMatcher';
import { BusinessOpportunityScore, scoreBusinessOpportunity } from './businessAutopilotOpportunityScoring';
import { businessAutopilotMetadataWriteSafety } from './businessAutopilotSafety';

export type BusinessAuditPackInput = {
  organizationId?: string | null;
  organizationName: string;
  domain?: string | null;
  websiteUrl?: string | null;
  industry?: string | null;
  location?: string | null;
  hasContactPath?: boolean;
  signals?: BusinessSignalLike[];
  riskFlags?: string[];
  notes?: string | null;
};

export type BusinessAuditPack = {
  id: string;
  organizationId: string | null;
  title: string;
  summary: string;
  auditType: 'opportunity_teardown';
  score: BusinessOpportunityScore;
  findings: Array<Record<string, unknown>>;
  recommendations: Array<Record<string, unknown>>;
  riskFlags: string[];
  confidenceScore: number;
  status: 'needs_review';
  metadata: Record<string, unknown>;
  safety: ReturnType<typeof businessAutopilotMetadataWriteSafety>;
};

function clean(value?: string | null) {
  const text = value?.trim();
  return text || null;
}

function signalFinding(signal: BusinessSignalLike, index: number) {
  return {
    id: `finding_${index + 1}`,
    signalType: signal.signalType || 'general_signal',
    strength: signal.signalStrength || 0,
    confidence: signal.confidenceScore || 0,
    evidenceSummary: signal.evidenceSummary || 'Evidence summary not supplied yet.',
  };
}

export function buildBusinessAuditPack(input: BusinessAuditPackInput): BusinessAuditPack {
  const signals = input.signals || [];
  const riskFlags = input.riskFlags || [];
  const score = scoreBusinessOpportunity({
    organizationName: input.organizationName,
    industry: input.industry,
    location: input.location,
    hasWebsite: Boolean(input.websiteUrl || input.domain),
    hasContactPath: Boolean(input.hasContactPath),
    signals,
    riskFlags,
  });
  const serviceMatches = matchEvavoServicesFromSignals(signals, 4);
  const primaryService = serviceMatches[0];

  const title = `${input.organizationName.trim()} internal opportunity audit pack`;
  const summary = primaryService
    ? `${input.organizationName.trim()} is classified as a ${score.priority}-priority internal review candidate for ${primaryService.label}. ${score.nextStep}`
    : `${input.organizationName.trim()} has been reviewed, but stronger evidence is needed before assigning a specific EVAVO service recommendation.`;

  const findings = signals.length
    ? signals.map(signalFinding)
    : [{ id: 'finding_1', signalType: 'needs_research', strength: 0, confidence: 0, evidenceSummary: 'No evidence signals have been attached yet.' }];

  const recommendations = [
    {
      id: 'recommendation_1',
      type: 'internal_review_step',
      title: 'Internal review step',
      detail: score.nextStep,
      priority: score.priority,
      executable: false,
      externalActionAllowed: false,
    },
    ...serviceMatches.map((match, index) => ({
      id: `service_match_${index + 1}`,
      type: 'service_match',
      serviceKey: match.serviceKey,
      title: match.label,
      detail: match.reason,
      matchScore: match.matchScore,
      evidence: match.evidence,
      advisoryOnly: true,
    })),
    {
      id: 'recommendation_compliance',
      type: 'governance',
      title: 'Governance requirement',
      detail: 'Keep this as internal review metadata only. Email, social posts, third-party comments, contact-form messages, deliverable drafts and all other external actions are disabled in this Worker; approval or confirmation cannot enable them.',
      blockedExternalActions: ['send_email', 'post_social', 'comment_social', 'submit_form', 'generate_deliverable_draft', 'approve_for_delivery'],
    },
  ];

  return {
    id: `audit_${crypto.randomUUID()}`,
    organizationId: clean(input.organizationId),
    title,
    summary,
    auditType: 'opportunity_teardown',
    score,
    findings,
    recommendations,
    riskFlags,
    confidenceScore: score.confidenceScore,
    status: 'needs_review',
    metadata: {
      contract: 'business_audit_pack_v2_internal_review_only',
      organizationName: input.organizationName.trim(),
      domain: clean(input.domain),
      websiteUrl: clean(input.websiteUrl),
      industry: clean(input.industry),
      location: clean(input.location),
      notes: clean(input.notes),
      serviceMatches,
      scoreReasoning: score.reasoning,
      reviewOnly: true,
      executable: false,
      deliverable: false,
      authoritativeForExecution: false,
      externalExecutionAllowed: false,
    },
    safety: businessAutopilotMetadataWriteSafety(),
  };
}
