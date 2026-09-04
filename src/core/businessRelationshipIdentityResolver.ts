export const BUSINESS_RELATIONSHIP_IDENTITY_RESOLVER_CONTRACT = "business_relationship_identity_resolver_v1" as const;

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

function address(value: string): string {
  return value.trim().toLowerCase();
}

function evidenceConfidence(candidate: IdentityCandidate): number {
  if (!candidate.evidence.length) return 0;
  return Math.round(candidate.evidence.reduce((sum, item) => sum + Math.max(0, Math.min(100, item.confidence)), 0) / candidate.evidence.length);
}

export function resolveRelationshipIdentity(input: Readonly<{
  observedAddress?: string | null;
  observedName?: string | null;
  expectedPersonId?: string | null;
  candidates: readonly IdentityCandidate[];
}>): IdentityResolution {
  const reasons: string[] = [];
  const observedAddress = input.observedAddress ? address(input.observedAddress) : null;
  if (observedAddress && !EMAIL.test(observedAddress)) throw new Error("IDENTITY_OBSERVED_ADDRESS_INVALID");

  const exact = observedAddress
    ? input.candidates.filter((candidate) => candidate.addresses.map(address).includes(observedAddress))
    : [];

  if (exact.length === 1) {
    const selected = exact[0]!;
    if (input.expectedPersonId && selected.personId !== input.expectedPersonId) {
      return Object.freeze({
        contract: BUSINESS_RELATIONSHIP_IDENTITY_RESOLVER_CONTRACT,
        status: "ambiguous",
        confidence: 0,
        exactAddressMatch: true,
        reasons: Object.freeze(["The exact email address resolves to a different person than the expected relationship identity."]),
        competingPersonIds: Object.freeze([selected.personId, input.expectedPersonId]),
      });
    }
    const confidence = Math.max(90, evidenceConfidence(selected));
    reasons.push("Observed email address exactly matches one known identity.");
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

  const normalizedName = input.observedName?.trim().toLowerCase() ?? null;
  const nameMatches = normalizedName
    ? input.candidates.filter((candidate) => candidate.name.trim().toLowerCase() === normalizedName)
    : [];

  if (nameMatches.length === 1 && evidenceConfidence(nameMatches[0]!) >= 90 && !observedAddress) {
    const selected = nameMatches[0]!;
    reasons.push("A single high-confidence identity matches the supplied name, but no address was supplied.");
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
    reasons: Object.freeze(["No authoritative identity match was found. External communication must not assume a person identity." ]),
    competingPersonIds: Object.freeze([]),
  });
}
