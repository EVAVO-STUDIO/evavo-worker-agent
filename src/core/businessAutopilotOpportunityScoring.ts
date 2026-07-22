import { BusinessSignalLike, primaryServiceFromSignals } from './businessAutopilotServiceMatcher';

export type BusinessOpportunityScoreInput = {
  organizationName?: string | null;
  industry?: string | null;
  location?: string | null;
  hasWebsite?: boolean;
  hasContactPath?: boolean;
  signals?: BusinessSignalLike[];
  riskFlags?: string[];
};

export type BusinessOpportunityScore = {
  priority: 'A' | 'B' | 'C' | 'D';
  fitScore: number;
  needScore: number;
  urgencyScore: number;
  budgetLikelihoodScore: number;
  contactabilityScore: number;
  evidenceQualityScore: number;
  riskScore: number;
  confidenceScore: number;
  recommendedService: string | null;
  recommendedAngle: string | null;
  nextStep: string;
  reasoning: string[];
};

const highFitIndustries = [
  'professional services',
  'property',
  'construction',
  'architecture',
  'interior design',
  'health',
  'education',
  'tourism',
  'hospitality',
  'creative',
  'technology',
  'ecommerce',
  'retail',
  'manufacturing',
  'training',
];

const urgencySignals = new Set([
  'weak_mobile_ux',
  'missing_analytics',
  'weak_cta',
  'conversion_gap',
  'broken_links',
  'slow_frontend',
  'stale_content',
  'hiring_signal',
  'funding_signal',
]);

const needSignals = new Set([
  'outdated_website',
  'weak_mobile_ux',
  'weak_cta',
  'seo_gap',
  'missing_schema',
  'missing_analytics',
  'weak_proof',
  'trust_gap',
  'unclear_offer',
  'manual_process',
  'manual_lead_handling',
  'weak_funnel',
  'weak_customer_journey',
]);

function score(value: unknown, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

function includesAny(text: string, values: string[]) {
  const normalized = text.toLowerCase();
  return values.some((value) => normalized.includes(value));
}

function priorityFromTotal(total: number, riskScore: number): 'A' | 'B' | 'C' | 'D' {
  const adjusted = total - (riskScore * 0.25);
  if (adjusted >= 75) return 'A';
  if (adjusted >= 55) return 'B';
  if (adjusted >= 35) return 'C';
  return 'D';
}

export function scoreBusinessOpportunity(input: BusinessOpportunityScoreInput): BusinessOpportunityScore {
  const signals = input.signals || [];
  const signalTypes = signals.map((signal) => (signal.signalType || '').toLowerCase());
  const signalStrengthAverage = signals.length
    ? signals.reduce((sum, signal) => sum + score(signal.signalStrength, 40), 0) / signals.length
    : 0;
  const confidenceAverage = signals.length
    ? signals.reduce((sum, signal) => sum + score(signal.confidenceScore, 50), 0) / signals.length
    : 0;

  const industry = input.industry || '';
  const fitScore = Math.min(100, Math.round(
    35
    + (includesAny(industry, highFitIndustries) ? 30 : 0)
    + (signals.length >= 3 ? 15 : signals.length * 4)
    + (input.hasWebsite ? 10 : 0)
    + (input.location ? 5 : 0)
  ));

  const needCount = signalTypes.filter((type) => needSignals.has(type)).length;
  const urgencyCount = signalTypes.filter((type) => urgencySignals.has(type)).length;
  const needScore = Math.min(100, Math.round((needCount * 18) + (signalStrengthAverage * 0.45)));
  const urgencyScore = Math.min(100, Math.round((urgencyCount * 14) + (signalStrengthAverage * 0.25)));
  const budgetLikelihoodScore = Math.min(100, Math.round(
    35
    + (includesAny(industry, ['property', 'construction', 'architecture', 'professional services', 'technology', 'ecommerce']) ? 20 : 0)
    + (signals.length >= 4 ? 15 : 0)
    + (input.hasWebsite ? 10 : 0)
  ));
  const contactabilityScore = input.hasContactPath ? 80 : input.hasWebsite ? 45 : 20;
  const evidenceQualityScore = Math.min(100, Math.round((signals.length * 12) + (confidenceAverage * 0.55)));
  const riskScore = Math.min(100, Math.round((input.riskFlags?.length || 0) * 20));
  const confidenceScore = Math.min(100, Math.round((fitScore * 0.2) + (needScore * 0.25) + (evidenceQualityScore * 0.35) + (contactabilityScore * 0.2)));

  const total = (fitScore * 0.25)
    + (needScore * 0.25)
    + (urgencyScore * 0.15)
    + (budgetLikelihoodScore * 0.1)
    + (contactabilityScore * 0.1)
    + (evidenceQualityScore * 0.15);
  const priority = priorityFromTotal(total, riskScore);
  const primaryService = primaryServiceFromSignals(signals);
  const recommendedService = primaryService?.serviceKey || null;
  const recommendedAngle = primaryService
    ? `${primaryService.label}: ${primaryService.reason}`
    : 'Review manually and collect stronger website evidence before assigning a service recommendation.';

  const nextStep = priority === 'A'
    ? 'Prepare an evidence-backed audit pack for internal operator review and record a manual disposition.'
    : priority === 'B'
      ? 'Collect more evidence, then decide whether an internal audit pack is justified.'
      : priority === 'C'
        ? 'Monitor or deprioritise until stronger need or evidence signals appear.'
        : 'Reject or archive unless the operator records a strategic reason to retain it.';

  const reasoning = [
    `Fit score ${fitScore} based on industry, website presence, location and signal density.`,
    `Need score ${needScore} from ${needCount} matched need signal(s).`,
    `Urgency score ${urgencyScore} from ${urgencyCount} urgency signal(s).`,
    `Evidence quality score ${evidenceQualityScore} from ${signals.length} signal(s).`,
    `Risk score ${riskScore} from ${input.riskFlags?.length || 0} risk flag(s).`,
    'The recommended next step is internal review metadata only and does not authorise drafting, outreach or external action.',
  ];

  return {
    priority,
    fitScore,
    needScore,
    urgencyScore,
    budgetLikelihoodScore,
    contactabilityScore,
    evidenceQualityScore,
    riskScore,
    confidenceScore,
    recommendedService,
    recommendedAngle,
    nextStep,
    reasoning,
  };
}
