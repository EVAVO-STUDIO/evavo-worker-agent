export type GrowthDiscoveryStatus =
  | 'planned'
  | 'discovered'
  | 'rejected'
  | 'queued_for_policy_check'
  | 'queued_for_research'
  | 'researched'
  | 'scored'
  | 'needs_operator_review';

export type GrowthAgentDecisionType =
  | 'research_more'
  | 'score_candidate'
  | 'reject_candidate'
  | 'monitor_later'
  | 'prepare_approval_pack'
  | 'request_operator_review';

export type GrowthDiscoverySafety = {
  readOnly: boolean;
  internalMetadataOnly: boolean;
  externalStateChange: boolean;
  callsAI: boolean;
  callsNetwork: boolean;
  canSendEmail: boolean;
  canPostSocial: boolean;
  canSubmitForms: boolean;
  canExecuteBrowserActions: boolean;
  canSubmitThirdPartyForms: boolean;
};

export type GrowthResearchRunInput = {
  objective: string;
  industryFocus?: string;
  geoFocus?: string;
  serviceFocus?: string;
  candidateLimit?: number;
  crawlBudget?: Record<string, unknown>;
  scoringRubric?: Record<string, unknown>;
  notes?: string;
};

export type GrowthSourceCandidateInput = {
  researchRunId?: string;
  domain: string;
  url: string;
  canonicalUrl?: string;
  sourceType?: string;
  discoveryMethod?: string;
  discoveryQuery?: string;
  industryHint?: string;
  geoHint?: string;
  serviceMatchHint?: string;
};

export type GrowthAgentDecisionInput = {
  candidateId?: string;
  researchRunId?: string;
  decisionType: GrowthAgentDecisionType;
  reason: string;
  evidence: unknown[];
  nextInternalStep?: string;
  confidence?: number;
};

export const GROWTH_DISCOVERY_BLOCKED_ACTIONS = [
  'send_email',
  'post_social',
  'submit_form',
  'log_in',
  'click_purchase',
  'book_meeting',
  'buy_ads',
  'mutate_external_system',
  'execute_page_instruction',
] as const;

export const GROWTH_DISCOVERY_ALLOWED_DECISIONS: GrowthAgentDecisionType[] = [
  'research_more',
  'score_candidate',
  'reject_candidate',
  'monitor_later',
  'prepare_approval_pack',
  'request_operator_review',
];

export function growthDiscoverySafety(): GrowthDiscoverySafety {
  return {
    readOnly: true,
    internalMetadataOnly: true,
    externalStateChange: false,
    callsAI: false,
    callsNetwork: false,
    canSendEmail: false,
    canPostSocial: false,
    canSubmitForms: false,
    canExecuteBrowserActions: false,
    canSubmitThirdPartyForms: false,
  };
}

export function assertGrowthDiscoverySafety(safety: GrowthDiscoverySafety): boolean {
  return safety.readOnly === true
    && safety.internalMetadataOnly === true
    && safety.externalStateChange === false
    && safety.callsAI === false
    && safety.callsNetwork === false
    && safety.canSendEmail === false
    && safety.canPostSocial === false
    && safety.canSubmitForms === false
    && safety.canExecuteBrowserActions === false
    && safety.canSubmitThirdPartyForms === false;
}

export function buildGrowthResearchRun(input: GrowthResearchRunInput) {
  return {
    id: `research_${crypto.randomUUID()}`,
    status: 'planned' as const,
    mode: 'zero_source_discovery',
    objective: input.objective.trim(),
    industryFocus: input.industryFocus?.trim() || null,
    geoFocus: input.geoFocus?.trim() || null,
    serviceFocus: input.serviceFocus?.trim() || null,
    candidateLimit: input.candidateLimit ?? 25,
    crawlBudget: input.crawlBudget ?? {},
    blockedActions: [...GROWTH_DISCOVERY_BLOCKED_ACTIONS],
    scoringRubric: input.scoringRubric ?? {},
    safety: growthDiscoverySafety(),
    notes: input.notes?.trim() || null,
  };
}

export function buildGrowthSourceCandidate(input: GrowthSourceCandidateInput) {
  return {
    id: `source_${crypto.randomUUID()}`,
    researchRunId: input.researchRunId || null,
    status: 'planned' as GrowthDiscoveryStatus,
    domain: input.domain.trim().toLowerCase(),
    url: input.url.trim(),
    canonicalUrl: input.canonicalUrl?.trim() || null,
    sourceType: input.sourceType?.trim() || 'unknown',
    discoveryMethod: input.discoveryMethod?.trim() || 'planned',
    discoveryQuery: input.discoveryQuery?.trim() || null,
    industryHint: input.industryHint?.trim() || null,
    geoHint: input.geoHint?.trim() || null,
    serviceMatchHint: input.serviceMatchHint?.trim() || null,
    robotsStatus: 'unknown',
    crawlAllowed: false,
    fitScore: 0,
    needScore: 0,
    confidenceScore: 0,
    riskFlags: [],
    evidenceSummary: null,
    safety: growthDiscoverySafety(),
  };
}

export function buildGrowthAgentDecision(input: GrowthAgentDecisionInput) {
  if (!GROWTH_DISCOVERY_ALLOWED_DECISIONS.includes(input.decisionType)) {
    throw new Error(`Unsupported Growth discovery decision: ${input.decisionType}`);
  }

  return {
    id: `decision_${crypto.randomUUID()}`,
    candidateId: input.candidateId || null,
    researchRunId: input.researchRunId || null,
    decisionType: input.decisionType,
    reason: input.reason.trim(),
    evidence: input.evidence,
    blockedActions: [...GROWTH_DISCOVERY_BLOCKED_ACTIONS],
    nextInternalStep: input.nextInternalStep?.trim() || null,
    confidence: input.confidence ?? 0,
    safety: growthDiscoverySafety(),
  };
}
