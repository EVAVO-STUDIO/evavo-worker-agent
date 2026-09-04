import type { Relationship360EvidenceItem } from "./businessRelationship360Context";

export const BUSINESS_RELATIONSHIP_CONTEXT_FRESHNESS_CONTRACT = "business_relationship_context_freshness_v2" as const;

export type ContextFreshnessDomain = Relationship360EvidenceItem["domain"];

export type ContextFreshnessRule = Readonly<{
  domain: ContextFreshnessDomain;
  maximumAgeMinutes: number;
  staleBlocksApproval: boolean;
}>;

export type ContextFreshnessFinding = Readonly<{
  evidenceId: string;
  domain: ContextFreshnessDomain;
  observedAt: string;
  ageMinutes: number;
  maximumAgeMinutes: number;
  stale: boolean;
  relevant: boolean;
  blocking: boolean;
  sourceRefs: readonly string[];
}>;

export type ContextFreshnessAssessment = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_CONTEXT_FRESHNESS_CONTRACT;
  assessedAt: string;
  ready: boolean;
  findings: readonly ContextFreshnessFinding[];
  blockingEvidenceIds: readonly string[];
  refreshDomains: readonly ContextFreshnessDomain[];
  requiredDomains: readonly ContextFreshnessDomain[] | null;
}>;

export const DEFAULT_CONTEXT_FRESHNESS_RULES: readonly ContextFreshnessRule[] = Object.freeze([
  { domain: "identity", maximumAgeMinutes: 30 * 24 * 60, staleBlocksApproval: true },
  { domain: "gmail", maximumAgeMinutes: 60, staleBlocksApproval: true },
  { domain: "operations", maximumAgeMinutes: 6 * 60, staleBlocksApproval: true },
  { domain: "support", maximumAgeMinutes: 60, staleBlocksApproval: true },
  { domain: "document", maximumAgeMinutes: 6 * 60, staleBlocksApproval: true },
  { domain: "calendar", maximumAgeMinutes: 15, staleBlocksApproval: true },
  { domain: "memory", maximumAgeMinutes: 30 * 24 * 60, staleBlocksApproval: false },
  { domain: "decision", maximumAgeMinutes: 180 * 24 * 60, staleBlocksApproval: false },
  { domain: "obligation", maximumAgeMinutes: 24 * 60, staleBlocksApproval: true },
  { domain: "other", maximumAgeMinutes: 24 * 60, staleBlocksApproval: false },
]);

function timestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`RELATIONSHIP_CONTEXT_FRESHNESS_${field.toUpperCase()}_INVALID`);
  return parsed;
}

export function assessRelationshipContextFreshness(input: Readonly<{
  now: string;
  evidence: readonly Relationship360EvidenceItem[];
  rules?: readonly ContextFreshnessRule[];
  requiredDomains?: readonly ContextFreshnessDomain[] | null;
}>): ContextFreshnessAssessment {
  const nowMs = timestamp(input.now, "now");
  const rules = input.rules ?? DEFAULT_CONTEXT_FRESHNESS_RULES;
  const byDomain = new Map(rules.map((rule) => [rule.domain, rule] as const));
  if (byDomain.size !== rules.length) throw new Error("RELATIONSHIP_CONTEXT_FRESHNESS_DUPLICATE_RULE_DOMAIN");
  for (const rule of rules) {
    if (!Number.isFinite(rule.maximumAgeMinutes) || rule.maximumAgeMinutes < 0) {
      throw new Error(`RELATIONSHIP_CONTEXT_FRESHNESS_RULE_AGE_INVALID:${rule.domain}`);
    }
  }
  const requiredDomains = input.requiredDomains === undefined || input.requiredDomains === null
    ? null
    : Object.freeze([...new Set(input.requiredDomains)]);
  const requiredSet = requiredDomains ? new Set(requiredDomains) : null;

  const findings = input.evidence.map((item): ContextFreshnessFinding => {
    const rule = byDomain.get(item.domain);
    if (!rule) throw new Error(`RELATIONSHIP_CONTEXT_FRESHNESS_RULE_MISSING:${item.domain}`);
    const observedMs = timestamp(item.observedAt, "observed_at");
    if (observedMs > nowMs + 60_000) throw new Error("RELATIONSHIP_CONTEXT_FRESHNESS_FUTURE_EVIDENCE");
    const ageMinutes = Math.max(0, Math.floor((nowMs - observedMs) / 60_000));
    const stale = ageMinutes > rule.maximumAgeMinutes;
    const relevant = requiredSet ? requiredSet.has(item.domain) : true;
    const blocking = stale && relevant && rule.staleBlocksApproval && item.status === "current";
    return Object.freeze({
      evidenceId: item.id,
      domain: item.domain,
      observedAt: new Date(observedMs).toISOString(),
      ageMinutes,
      maximumAgeMinutes: rule.maximumAgeMinutes,
      stale,
      relevant,
      blocking,
      sourceRefs: item.sourceRefs,
    });
  });
  const blocking = findings.filter((item) => item.blocking);
  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_CONTEXT_FRESHNESS_CONTRACT,
    assessedAt: new Date(nowMs).toISOString(),
    ready: blocking.length === 0,
    findings: Object.freeze(findings),
    blockingEvidenceIds: Object.freeze(blocking.map((item) => item.evidenceId)),
    refreshDomains: Object.freeze([...new Set(blocking.map((item) => item.domain))]),
    requiredDomains,
  });
}
