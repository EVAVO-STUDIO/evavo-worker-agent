import {
  BUSINESS_AUTOPILOT_BLOCKED_EXTERNAL_ACTIONS,
  businessAutopilotMetadataWriteSafety,
  businessAutopilotReadSafety,
} from './businessAutopilotSafety';

export type BusinessStatus = 'new' | 'active' | 'needs_review' | 'approved' | 'rejected' | 'blocked' | 'suppressed' | 'archived';
export type BusinessPriority = 'A' | 'B' | 'C' | 'D';
export type BusinessApprovalStatus = 'needs_review' | 'approved' | 'rejected' | 'expired';
export type BusinessComplianceStatus = 'not_required_internal' | 'draft_only' | 'requires_consent' | 'consent_verified' | 'suppressed' | 'unsubscribe_required' | 'sender_identity_missing' | 'approval_missing' | 'approved_to_send' | 'blocked';
export type BusinessActionDraftType = 'email' | 'linkedin_post' | 'linkedin_comment' | 'linkedin_dm' | 'contact_form_message' | 'proposal_intro' | 'audit_summary' | 'follow_up' | 'crm_note' | 'calendar_task' | 'internal_report';

export type BusinessOrganizationInput = {
  name: string;
  domain?: string;
  websiteUrl?: string;
  industry?: string;
  location?: string;
  sourceType?: string;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
};

export type BusinessOpportunityInput = {
  organizationId?: string;
  opportunityType?: string;
  recommendedService?: string;
  recommendedAngle?: string;
  nextStep?: string;
  fitScore?: number;
  needScore?: number;
  urgencyScore?: number;
  budgetLikelihoodScore?: number;
  contactabilityScore?: number;
  evidenceQualityScore?: number;
  riskScore?: number;
  confidenceScore?: number;
  metadata?: Record<string, unknown>;
};

export type BusinessActionDraftInput = {
  organizationId?: string;
  personId?: string;
  opportunityId?: string;
  auditPackId?: string;
  draftType: BusinessActionDraftType;
  channel?: string;
  subject?: string;
  body?: string;
  payload?: Record<string, unknown>;
  riskFlags?: string[];
  metadata?: Record<string, unknown>;
};

export type BusinessApprovalRequestInput = {
  actionDraftId?: string;
  requestType?: string;
  reviewChecklist?: string[];
  riskFlags?: string[];
  approvalReason?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
};

export type BusinessSignalInput = {
  organizationId?: string;
  websiteId?: string;
  pageId?: string;
  signalType: string;
  signalStrength?: number;
  evidenceSummary?: string;
  evidenceUrl?: string;
  confidenceScore?: number;
  riskFlags?: string[];
  metadata?: Record<string, unknown>;
};

export type BusinessServiceMatchInput = {
  organizationId?: string;
  opportunityId?: string;
  signalId?: string;
  serviceKey: string;
  matchScore?: number;
  reason?: string;
  evidence?: unknown[];
  metadata?: Record<string, unknown>;
};

function clean(value?: string | null) {
  const text = value?.trim();
  return text ? text : null;
}

function score(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function priorityFromScores(input: BusinessOpportunityInput): BusinessPriority {
  const weighted = (score(input.fitScore) * 0.3)
    + (score(input.needScore) * 0.25)
    + (score(input.urgencyScore) * 0.15)
    + (score(input.budgetLikelihoodScore) * 0.1)
    + (score(input.contactabilityScore) * 0.1)
    + (score(input.evidenceQualityScore) * 0.1)
    - (score(input.riskScore) * 0.2);
  if (weighted >= 75) return 'A';
  if (weighted >= 55) return 'B';
  if (weighted >= 35) return 'C';
  return 'D';
}

export function buildBusinessOrganization(input: BusinessOrganizationInput) {
  return {
    id: `org_${crypto.randomUUID()}`,
    name: input.name.trim(),
    domain: clean(input.domain)?.toLowerCase() || null,
    websiteUrl: clean(input.websiteUrl),
    industry: clean(input.industry),
    location: clean(input.location),
    sourceType: clean(input.sourceType) || 'operator',
    sourceUrl: clean(input.sourceUrl),
    status: 'new' as BusinessStatus,
    fitScore: 0,
    priorityScore: 0,
    riskScore: 0,
    confidenceScore: 0,
    metadata: input.metadata ?? {},
    safety: businessAutopilotMetadataWriteSafety(),
    blockedActions: [...BUSINESS_AUTOPILOT_BLOCKED_EXTERNAL_ACTIONS],
  };
}

export function buildBusinessSignal(input: BusinessSignalInput) {
  return {
    id: `signal_${crypto.randomUUID()}`,
    organizationId: input.organizationId || null,
    websiteId: input.websiteId || null,
    pageId: input.pageId || null,
    signalType: input.signalType.trim(),
    signalStrength: score(input.signalStrength),
    evidenceSummary: clean(input.evidenceSummary),
    evidenceUrl: clean(input.evidenceUrl),
    confidenceScore: score(input.confidenceScore),
    riskFlags: input.riskFlags ?? [],
    metadata: input.metadata ?? {},
    safety: businessAutopilotMetadataWriteSafety(),
  };
}

export function buildBusinessOpportunity(input: BusinessOpportunityInput) {
  const priority = priorityFromScores(input);
  return {
    id: `opp_${crypto.randomUUID()}`,
    organizationId: input.organizationId || null,
    opportunityType: clean(input.opportunityType) || 'general',
    status: 'new' as BusinessStatus,
    priority,
    fitScore: score(input.fitScore),
    needScore: score(input.needScore),
    urgencyScore: score(input.urgencyScore),
    budgetLikelihoodScore: score(input.budgetLikelihoodScore),
    contactabilityScore: score(input.contactabilityScore),
    evidenceQualityScore: score(input.evidenceQualityScore),
    riskScore: score(input.riskScore),
    confidenceScore: score(input.confidenceScore),
    recommendedService: clean(input.recommendedService),
    recommendedAngle: clean(input.recommendedAngle),
    nextStep: clean(input.nextStep),
    metadata: input.metadata ?? {},
    safety: businessAutopilotMetadataWriteSafety(),
    readSafety: businessAutopilotReadSafety(),
    blockedActions: [...BUSINESS_AUTOPILOT_BLOCKED_EXTERNAL_ACTIONS],
  };
}

export function buildBusinessServiceMatch(input: BusinessServiceMatchInput) {
  return {
    id: `svc_${crypto.randomUUID()}`,
    organizationId: input.organizationId || null,
    opportunityId: input.opportunityId || null,
    signalId: input.signalId || null,
    serviceKey: input.serviceKey.trim(),
    matchScore: score(input.matchScore),
    reason: clean(input.reason),
    evidence: input.evidence ?? [],
    metadata: input.metadata ?? {},
    safety: businessAutopilotMetadataWriteSafety(),
  };
}

export function buildBusinessActionDraft(input: BusinessActionDraftInput) {
  return {
    id: `draft_${crypto.randomUUID()}`,
    organizationId: input.organizationId || null,
    personId: input.personId || null,
    opportunityId: input.opportunityId || null,
    auditPackId: input.auditPackId || null,
    draftType: input.draftType,
    channel: clean(input.channel) || 'internal',
    subject: clean(input.subject),
    body: clean(input.body),
    payload: input.payload ?? {},
    riskFlags: input.riskFlags ?? [],
    complianceStatus: 'draft_only' as BusinessComplianceStatus,
    approvalStatus: 'needs_review' as BusinessApprovalStatus,
    status: 'draft' as BusinessStatus,
    metadata: input.metadata ?? {},
    safety: businessAutopilotMetadataWriteSafety(),
    blockedActions: [...BUSINESS_AUTOPILOT_BLOCKED_EXTERNAL_ACTIONS],
  };
}

export function buildBusinessApprovalRequest(input: BusinessApprovalRequestInput) {
  return {
    id: `approval_${crypto.randomUUID()}`,
    actionDraftId: input.actionDraftId || null,
    requestType: clean(input.requestType) || 'action_draft',
    status: 'needs_review' as BusinessApprovalStatus,
    reviewChecklist: input.reviewChecklist ?? [],
    riskFlags: input.riskFlags ?? [],
    approvalReason: clean(input.approvalReason),
    approvedBy: null,
    approvedAt: null,
    expiresAt: clean(input.expiresAt),
    metadata: input.metadata ?? {},
    safety: businessAutopilotMetadataWriteSafety(),
  };
}
