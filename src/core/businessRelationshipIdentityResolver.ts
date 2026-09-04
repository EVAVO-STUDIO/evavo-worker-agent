export const BUSINESS_RELATIONSHIP_IDENTITY_RESOLVER_CONTRACT = "business_relationship_identity_resolver_v2" as const;

export type IdentityEvidence = Readonly<{
  source: "gmail" | "contacts" | "operations_core" | "memory" | "operator" | "other";
  ref: string;
  confidence: number;
}>;

export type IdentityCandidate = Readonly<{
  personId: string;
  name: string;
  addresses: readonly string[];
  organizationIds?: readonly string[];
  relationshipIds?: readonly string[];
  evidence: readonly IdentityEvidence[];
}>;

export type IdentityResolution = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_IDENTITY_RESOLVER_CONTRACT;
  status: "verified" | "ambiguous" | "unresolved";
  selected?: IdentityCandidate;
  confidence: number;
  exactAddressMatch: boolean;
  reasons: readonly string[];
  competingPersonIds: readonly string[];
}>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EVIDENCE_SOURCES = new Set<IdentityEvidence["source"]>(["gmail", "contacts", "operations_core", "memory", "operator", "other"]);

function address(value: string): string {
  const clean = value.trim().toLowerCase();
  if (!EMAIL.test(clean) || clean.length > 320) throw new Error("IDENTITY_CANDIDATE_ADDRESS_INVALID");
  return clean;
}

function idList(values: readonly string[] | undefined): readonly string[] {
  return Object.freeze([...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))]);
}

function evidenceList(values: readonly IdentityEvidence[]): readonly IdentityEvidence[] {
  const seen = new Set<string>();
  const out: IdentityEvidence[] = [];
  for (const item of values) {
    if (!EVIDENCE_SOURCES.has(item.source)) throw new Error("IDENTITY_EVIDENCE_SOURCE_INVALID");
    const ref = item.ref.trim();
    if (!ref) continue;
    if (!Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 100) {
      throw new Error("IDENTITY_EVIDENCE_CONFIDENCE_INVALID");
    }
    const key = `${item.source}:${ref}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(Object.freeze({ source: item.source, ref, confidence: item.confidence }));
  }
  return Object.freeze(out);
}

function normalizeCandidate(candidate: IdentityCandidate): IdentityCandidate {
  const personId = candidate.personId.trim();
  if (!personId) throw new Error("IDENTITY_PERSON_ID_REQUIRED");
  const name = candidate.name.replace(/\s+/g, " ").trim();
  if (!name) throw new Error("IDENTITY_NAME_REQUIRED");
  const addresses = Object.freeze([...new Set(candidate.addresses.map(address))]);
  return Object.freeze({
    personId,
    name,
    addresses,
    organizationIds: idList(candidate.organizationIds),
    relationshipIds: idList(candidate.relationshipIds),
    evidence: evidenceList(candidate.evidence),
  });
}

function evidenceConfidence(candidate: IdentityCandidate): number {
  if (!candidate.evidence.length) return 0;
  return Math.round(candidate.evidence.reduce((sum, item) => sum + item.confidence, 0) / candidate.evidence.length);
}

function candidateIsEvidenceBacked(candidate: IdentityCandidate): boolean {
  return candidate.evidence.length > 0 && evidenceConfidence(candidate) > 0;
}

export function resolveRelationshipIdentity(input: Readonly<{
  observedAddress?: string | null;
  observedName?: string | null;
  expectedPersonId?: string | null;
  candidates: readonly IdentityCandidate[];
}>): IdentityResolution {
  const reasons: string[] = [];
  const observedAddress = input.observedAddress?.trim() ? input.observedAddress.trim().toLowerCase() : null;
  if (observedAddress && (!EMAIL.test(observedAddress) || observedAddress.length > 320)) throw new Error("IDENTITY_OBSERVED_ADDRESS_INVALID");
  const expectedPersonId = input.expectedPersonId?.trim() || null;
  const candidates = input.candidates.map(normalizeCandidate);
  const personIds = new Set<string>();
  for (const candidate of candidates) {
    if (personIds.has(candidate.personId)) throw new Error(`IDENTITY_DUPLICATE_PERSON_ID:${candidate.personId}`);
    personIds.add(candidate.personId);
  }

  const exact = observedAddress
    ? candidates.filter((candidate) => candidate.addresses.includes(observedAddress))
    : [];

  if (exact.length === 1) {
    const selected = exact[0]!;
    if (expectedPersonId && selected.personId !== expectedPersonId) {
      return Object.freeze({
        contract: BUSINESS_RELATIONSHIP_IDENTITY_RESOLVER_CONTRACT,
        status: "ambiguous",
        confidence: 0,
        exactAddressMatch: true,
        reasons: Object.freeze(["The exact email address resolves to a different person than the expected relationship identity."]),
        competingPersonIds: Object.freeze([selected.personId, expectedPersonId]),
      });
    }
    if (!candidateIsEvidenceBacked(selected)) {
      return Object.freeze({
        contract: BUSINESS_RELATIONSHIP_IDENTITY_RESOLVER_CONTRACT,
        status: "unresolved",
        confidence: 0,
        exactAddressMatch: true,
        reasons: Object.freeze(["The observed email address matches one candidate, but that identity mapping has no concrete provenance and cannot be trusted for external routing."]),
        competingPersonIds: Object.freeze([selected.personId]),
      });
    }
    const confidence = Math.max(90, evidenceConfidence(selected));
    reasons.push("Observed email address exactly matches one evidence-backed identity.");
    return Object.freeze({
      contract: BUSINESS_RELATIONSHIP_IDENTITY_RESOLVER_CONTRACT,
      status: "verified",
      selected,
      confidence,
      exactAddressMatch: true,
      reasons: Object.freeze(reasons),
      competingPersonIds: Object.freeze([]),
    });
  }

  if (exact.length > 1) {
    return Object.freeze({
      contract: BUSINESS_RELATIONSHIP_IDENTITY_RESOLVER_CONTRACT,
      status: "ambiguous",
      confidence: 0,
      exactAddressMatch: true,
      reasons: Object.freeze(["The observed email address is associated with multiple person identities; do not guess which relationship is intended."]),
      competingPersonIds: Object.freeze(exact.map((candidate) => candidate.personId)),
    });
  }

  const normalizedName = input.observedName?.replace(/\s+/g, " ").trim().toLowerCase() ?? null;
  const nameMatches = normalizedName
    ? candidates.filter((candidate) => candidate.name.toLowerCase() === normalizedName)
    : [];

  if (nameMatches.length === 1 && candidateIsEvidenceBacked(nameMatches[0]!) && evidenceConfidence(nameMatches[0]!) >= 90 && !observedAddress) {
    const selected = nameMatches[0]!;
    reasons.push("A single high-confidence evidence-backed identity matches the supplied name, but no address was supplied.");
    return Object.freeze({
      contract: BUSINESS_RELATIONSHIP_IDENTITY_RESOLVER_CONTRACT,
      status: "verified",
      selected,
      confidence: evidenceConfidence(selected),
      exactAddressMatch: false,
      reasons: Object.freeze(reasons),
      competingPersonIds: Object.freeze([]),
    });
  }

  if (nameMatches.length > 1) {
    return Object.freeze({
      contract: BUSINESS_RELATIONSHIP_IDENTITY_RESOLVER_CONTRACT,
      status: "ambiguous",
      confidence: 0,
      exactAddressMatch: false,
      reasons: Object.freeze(["Multiple people share the observed name; address or another authoritative identifier is required."]),
      competingPersonIds: Object.freeze(nameMatches.map((candidate) => candidate.personId)),
    });
  }

  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_IDENTITY_RESOLVER_CONTRACT,
    status: "unresolved",
    confidence: 0,
    exactAddressMatch: false,
    reasons: Object.freeze(["No authoritative evidence-backed identity match was found. External communication must not assume a person identity." ]),
    competingPersonIds: Object.freeze([]),
  });
}
