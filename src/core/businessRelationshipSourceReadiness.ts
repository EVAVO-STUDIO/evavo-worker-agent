export const BUSINESS_RELATIONSHIP_SOURCE_READINESS_CONTRACT = "business_relationship_source_readiness_v2" as const;

export type RelationshipSourceDomain =
  | "identity"
  | "gmail"
  | "operations"
  | "careers"
  | "support"
  | "document"
  | "calendar"
  | "memory";

export type RelationshipSourceState =
  | "verified"
  | "not_found"
  | "provider_unavailable"
  | "not_queried"
  | "stale";

export type RelationshipSourceReadinessItem = Readonly<{
  domain: RelationshipSourceDomain;
  state: RelationshipSourceState;
  required: boolean;
  absenceAcceptable?: boolean;
  observedAt?: string | null;
  sourceRefs?: readonly string[];
  detail?: string | null;
}>;

export type RelationshipSourceReadinessFinding = Readonly<{
  domain: RelationshipSourceDomain;
  state: RelationshipSourceState;
  required: boolean;
  absenceAcceptable: boolean;
  resolved: boolean;
  blocking: boolean;
  observedAt: string | null;
  sourceRefs: readonly string[];
  detail: string | null;
}>;

export type RelationshipSourceReadinessAssessment = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_SOURCE_READINESS_CONTRACT;
  assessedAt: string;
  ready: boolean;
  findings: readonly RelationshipSourceReadinessFinding[];
  blockingDomains: readonly RelationshipSourceDomain[];
  issues: readonly string[];
  evidenceRefs: readonly string[];
}>;

function iso(value: string, code: string): string {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) throw new Error(code);
  return parsed.toISOString();
}

function refs(values: readonly string[] | undefined): readonly string[] {
  return Object.freeze([...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))]);
}

function cleanDetail(value: string | null | undefined): string | null {
  const clean = value?.replace(/\s+/g, " ").trim() ?? "";
  return clean || null;
}

function issueFor(finding: RelationshipSourceReadinessFinding): string | null {
  if (!finding.blocking) return null;
  switch (finding.state) {
    case "not_queried": return `${finding.domain}: required source has not been queried.`;
    case "provider_unavailable": return `${finding.domain}: required provider is unavailable; current truth is unknown.`;
    case "stale": return `${finding.domain}: required source is stale and must be refreshed.`;
    case "not_found": return `${finding.domain}: authoritative query found no record, but absence is not an acceptable outcome for this decision.`;
    case "verified": return null;
  }
}

export function assessRelationshipSourceReadiness(input: Readonly<{
  now: string;
  sources: readonly RelationshipSourceReadinessItem[];
}>): RelationshipSourceReadinessAssessment {
  const assessedAt = iso(input.now, "RELATIONSHIP_SOURCE_READINESS_NOW_INVALID");
  const nowMs = Date.parse(assessedAt);
  const domains = new Set<RelationshipSourceDomain>();
  const findings = input.sources.map((item): RelationshipSourceReadinessFinding => {
    if (domains.has(item.domain)) throw new Error(`RELATIONSHIP_SOURCE_READINESS_DUPLICATE_DOMAIN:${item.domain}`);
    domains.add(item.domain);
    const sourceRefs = refs(item.sourceRefs);
    const observedAt = item.observedAt ? iso(item.observedAt, `RELATIONSHIP_SOURCE_READINESS_OBSERVED_AT_INVALID:${item.domain}`) : null;
    if (observedAt && Date.parse(observedAt) > nowMs + 60_000) {
      throw new Error(`RELATIONSHIP_SOURCE_READINESS_FUTURE_OBSERVATION:${item.domain}`);
    }
    if ((item.state === "verified" || item.state === "not_found") && (!observedAt || !sourceRefs.length)) {
      throw new Error(`RELATIONSHIP_SOURCE_READINESS_EVIDENCE_REQUIRED:${item.domain}`);
    }
    if (item.state === "stale" && !observedAt) {
      throw new Error(`RELATIONSHIP_SOURCE_READINESS_STALE_OBSERVED_AT_REQUIRED:${item.domain}`);
    }
    const absenceAcceptable = item.absenceAcceptable === true;
    const resolved = item.state === "verified" || (item.state === "not_found" && absenceAcceptable);
    const blocking = item.required && !resolved;
    return Object.freeze({
      domain: item.domain,
      state: item.state,
      required: item.required,
      absenceAcceptable,
      resolved,
      blocking,
      observedAt,
      sourceRefs,
      detail: cleanDetail(item.detail),
    });
  });
  const blocking = findings.filter((finding) => finding.blocking);
  const issues = blocking.map(issueFor).filter((value): value is string => Boolean(value));
  const evidenceRefs = [...new Set(findings.flatMap((finding) => finding.sourceRefs))];
  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_SOURCE_READINESS_CONTRACT,
    assessedAt,
    ready: blocking.length === 0,
    findings: Object.freeze(findings),
    blockingDomains: Object.freeze(blocking.map((finding) => finding.domain)),
    issues: Object.freeze(issues),
    evidenceRefs: Object.freeze(evidenceRefs),
  });
}
