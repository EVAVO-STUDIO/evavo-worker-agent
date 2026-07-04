export type BusinessSignalLike = {
  signalType?: string | null;
  signalStrength?: number | null;
  evidenceSummary?: string | null;
  confidenceScore?: number | null;
};

export type BusinessServiceMatchSuggestion = {
  serviceKey: string;
  label: string;
  matchScore: number;
  reason: string;
  evidence: Array<Record<string, unknown>>;
};

const serviceDefinitions = [
  {
    serviceKey: 'website_rebuild',
    label: 'Website rebuild / redesign',
    signals: ['outdated_website', 'weak_mobile_ux', 'slow_frontend', 'poor_visual_design', 'thin_service_pages', 'broken_links'],
    reason: 'The evidence points to website quality, trust, performance, or conversion issues that would fit an EVAVO rebuild or redesign engagement.',
  },
  {
    serviceKey: 'ux_ui',
    label: 'UX/UI audit and product design',
    signals: ['weak_mobile_ux', 'weak_cta', 'confusing_navigation', 'conversion_gap', 'accessibility_gap', 'poor_information_architecture'],
    reason: 'The evidence points to user journey, interface clarity, accessibility, or conversion-path friction that would fit UX/UI work.',
  },
  {
    serviceKey: 'analytics_seo',
    label: 'Analytics, SEO and measurement foundations',
    signals: ['missing_analytics', 'seo_gap', 'missing_schema', 'weak_metadata', 'stale_content', 'low_search_visibility'],
    reason: 'The evidence points to discoverability or measurement gaps that would fit analytics, SEO and reporting setup.',
  },
  {
    serviceKey: 'ai_chatbot',
    label: 'AI chatbot / guided assistant',
    signals: ['manual_lead_handling', 'high_information_load', 'complex_services', 'support_friction', 'qualification_gap'],
    reason: 'The evidence suggests an opportunity for guided qualification, support triage, or a smarter customer-facing assistant.',
  },
  {
    serviceKey: 'automation',
    label: 'Automation and workflow improvement',
    signals: ['manual_process', 'slow_followup', 'repetitive_admin', 'qualification_gap', 'operations_bottleneck'],
    reason: 'The evidence suggests a repeatable workflow or operational handoff that could be streamlined with automation.',
  },
  {
    serviceKey: 'three_d_interactive',
    label: '3D / interactive digital experience',
    signals: ['boring_product_presentation', 'high_value_visual_product', 'showroom_gap', 'interactive_experience_opportunity'],
    reason: 'The evidence points to products or services that may benefit from a more immersive, interactive or 3D digital presentation.',
  },
  {
    serviceKey: 'gamification',
    label: 'Gamification, funnels and engagement systems',
    signals: ['low_engagement', 'weak_funnel', 'weak_customer_journey', 'hotspot_opportunity', 'education_or_training_opportunity'],
    reason: 'The evidence points to engagement, funnel, hotspot or learning-path opportunities that fit EVAVO gamification and journey work.',
  },
  {
    serviceKey: 'ecommerce',
    label: 'Ecommerce optimisation',
    signals: ['ecommerce_gap', 'weak_product_pages', 'checkout_friction', 'low_trust_checkout', 'catalogue_usability_gap'],
    reason: 'The evidence points to product discovery, checkout, trust, or ecommerce usability issues.',
  },
  {
    serviceKey: 'performance_maintenance',
    label: 'Performance, maintenance and technical care',
    signals: ['slow_frontend', 'broken_links', 'security_or_maintenance_gap', 'stale_technology', 'technical_debt'],
    reason: 'The evidence suggests the site needs technical care, performance work or ongoing maintenance.',
  },
  {
    serviceKey: 'content_strategy',
    label: 'Content strategy and conversion copy',
    signals: ['unclear_offer', 'thin_service_pages', 'weak_proof', 'trust_gap', 'stale_content', 'weak_positioning'],
    reason: 'The evidence points to offer clarity, trust, proof or messaging gaps that would benefit from content and positioning work.',
  },
] as const;

function cleanSignal(value?: string | null) {
  return (value || '').trim().toLowerCase();
}

function score(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function listEvavoServiceDefinitions() {
  return serviceDefinitions.map((definition) => ({ ...definition, signals: [...definition.signals] }));
}

export function matchEvavoServicesFromSignals(signals: BusinessSignalLike[], limit = 5): BusinessServiceMatchSuggestion[] {
  const normalizedSignals = signals.map((signal) => ({
    ...signal,
    signalType: cleanSignal(signal.signalType),
    signalStrength: score(signal.signalStrength),
    confidenceScore: score(signal.confidenceScore),
  }));

  const suggestions = serviceDefinitions.map((definition) => {
    const matched = normalizedSignals.filter((signal) => definition.signals.includes(signal.signalType as any));
    const weightedScore = matched.reduce((sum, signal) => {
      const strength = score(signal.signalStrength || 40);
      const confidence = score(signal.confidenceScore || 50);
      return sum + ((strength * 0.7) + (confidence * 0.3));
    }, 0);
    const matchScore = matched.length ? Math.min(100, Math.round(weightedScore / Math.max(1, matched.length))) : 0;
    return {
      serviceKey: definition.serviceKey,
      label: definition.label,
      matchScore,
      reason: definition.reason,
      evidence: matched.map((signal) => ({
        signalType: signal.signalType,
        signalStrength: signal.signalStrength,
        confidenceScore: signal.confidenceScore,
        evidenceSummary: signal.evidenceSummary || null,
      })),
    };
  });

  return suggestions
    .filter((suggestion) => suggestion.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, Math.max(1, Math.min(10, Math.round(limit))));
}

export function primaryServiceFromSignals(signals: BusinessSignalLike[]) {
  return matchEvavoServicesFromSignals(signals, 1)[0] || null;
}
