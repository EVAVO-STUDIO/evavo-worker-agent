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
  status: 'draft';
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

  const title = `${input.organizationName.trim()} opportunity audit pack`;
  const summary = primaryService
    ? `${input.organizationName.trim()} looks like a ${score.priority}-priority opportunity for ${primaryService.label}. ${score.nextStep}`
    : `${input.organizationName.trim()} has been reviewed, but stronger evidence is needed before recommending a specific EVAVO service.`;

  const findings = signals.length
    ? signals.map(signalFinding)
    : [{ id: 'finding_1', signalType: 'needs_research', strength: 0, confidence: 0, evidenceSummary: 'No evidence signals have been attached yet.' }];

  const recommendations = [
    {
      id: 'recommendation_1',
      type: 'next_step',
      title: 'Recommended next step',
      detail: score.nextStep,
      priority: score.priority,
    },
    ...serviceMatches.map((match, index) => ({
      id: `service_match_${index + 1}`,
      type: 'service_match',
      serviceKey: match.serviceKey,
      title: match.label,
      detail: match.reason,
      matchScore: match.matchScore,
      evidence: match.evidence,
    })),
    {
      id: 'recommendation_compliance',
      type: 'governance',
      title: 'Governance requirement',
      detail: 'Keep this as an internal review pack. Any email, social post, third-party comment or contact-form message must remain draft-only until approval, suppression and compliance checks exist.',
      blockedExternalActions: ['send_email', 'post_social', 'comment_social', 'submit_form'],
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
    status: 'draft',
    metadata: {
      organizationName: input.organizationName.trim(),
      domain: clean(input.domain),
      websiteUrl: clean(input.websiteUrl),
      industry: clean(input.industry),
      location: clean(input.location),
      notes: clean(input.notes),
      serviceMatches,
      scoreReasoning: score.reasoning,
    },
    safety: businessAutopilotMetadataWriteSafety(),
  };
}
