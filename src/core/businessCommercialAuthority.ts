export const BUSINESS_COMMERCIAL_AUTHORITY_CONTRACT = "business_commercial_authority_v2" as const;

export type CommercialCommitmentKind = "price" | "discount" | "scope" | "deadline" | "payment_terms" | "liability" | "contract_term" | "refund" | "credit" | "other";
export type CommercialAuthorityScope = "relationship" | "project" | "global";

const NONDELEGABLE_KINDS = new Set<CommercialCommitmentKind>(["liability", "contract_term"]);

export type CommercialAuthorityGrant = Readonly<{
  kind: CommercialCommitmentKind;
  scope?: CommercialAuthorityScope;
  relationshipId?: string | null;
  projectId?: string | null;
  maximumAud?: number | null;
  minimumAud?: number | null;
  validFrom: string;
  validThrough?: string | null;
  evidenceIds: readonly string[];
  grantedBy: string;
}>;

export type CommercialCommitmentRequest = Readonly<{
  kind: CommercialCommitmentKind;
  relationshipId?: string | null;
  projectId?: string | null;
  amountAud?: number | null;
  statement: string;
  requestedAt: string;
}>;

export type CommercialAuthorityDecision = Readonly<{
  contract: typeof BUSINESS_COMMERCIAL_AUTHORITY_CONTRACT;
  authorised: boolean;
  matchingGrant: CommercialAuthorityGrant | null;
  humanReviewRequired: boolean;
  reasons: readonly string[];
}>;

function time(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`COMMERCIAL_AUTHORITY_${field}_INVALID`);
  return parsed;
}

function text(value: string, field: string): string {
  const cleaned = value.trim();
  if (!cleaned) throw new Error(`COMMERCIAL_AUTHORITY_${field}_REQUIRED`);
  return cleaned;
}

function cleanIds(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values.map((value) => value.trim()).filter(Boolean))]);
}

function finiteAmount(value: number | null | undefined, field: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Number.isFinite(value) || value < 0) throw new Error(`COMMERCIAL_AUTHORITY_${field}_INVALID`);
  return value;
}

function normalizedScope(grant: CommercialAuthorityGrant): CommercialAuthorityScope | null {
  if (grant.scope) return grant.scope;
  if (grant.projectId) return "project";
  if (grant.relationshipId) return "relationship";
  return null;
}

export function decideCommercialAuthority(
  request: CommercialCommitmentRequest,
  grants: readonly CommercialAuthorityGrant[],
): CommercialAuthorityDecision {
  const requestedAt = time(request.requestedAt, "REQUESTED_AT");
  text(request.statement, "STATEMENT");
  const requestAmount = finiteAmount(request.amountAud, "REQUEST_AMOUNT");

  if (NONDELEGABLE_KINDS.has(request.kind)) {
    return Object.freeze({
      contract: BUSINESS_COMMERCIAL_AUTHORITY_CONTRACT,
      authorised: false,
      matchingGrant: null,
      humanReviewRequired: true,
      reasons: Object.freeze([`${request.kind} commitments are nondelegable and require explicit human/legal review.`]),
    });
  }

  const candidates = grants.filter((grant) => {
    const evidenceIds = cleanIds(grant.evidenceIds);
    if (!evidenceIds.length) return false;
    if (!grant.grantedBy.trim()) return false;
    if (grant.kind !== request.kind) return false;

    const scope = normalizedScope(grant);
    if (!scope) return false;
    if (scope === "global" && (grant.relationshipId || grant.projectId)) return false;
    if (scope === "relationship") {
      if (!grant.relationshipId || grant.relationshipId !== request.relationshipId) return false;
      if (grant.projectId) return false;
    }
    if (scope === "project") {
      if (!grant.projectId || grant.projectId !== request.projectId) return false;
      if (grant.relationshipId && grant.relationshipId !== request.relationshipId) return false;
    }

    const from = time(grant.validFrom, "VALID_FROM");
    const through = grant.validThrough ? time(grant.validThrough, "VALID_THROUGH") : Number.POSITIVE_INFINITY;
    if (through < from) return false;
    if (requestedAt < from || requestedAt > through) return false;

    const maximum = finiteAmount(grant.maximumAud, "GRANT_MAXIMUM");
    const minimum = finiteAmount(grant.minimumAud, "GRANT_MINIMUM");
    if (maximum !== undefined && minimum !== undefined && minimum > maximum) return false;
    if ((maximum !== undefined || minimum !== undefined) && requestAmount === undefined) return false;
    if (requestAmount !== undefined) {
      if (maximum !== undefined && requestAmount > maximum) return false;
      if (minimum !== undefined && requestAmount < minimum) return false;
    }
    return true;
  });

  if (candidates.length !== 1) {
    return Object.freeze({
      contract: BUSINESS_COMMERCIAL_AUTHORITY_CONTRACT,
      authorised: false,
      matchingGrant: null,
      humanReviewRequired: true,
      reasons: Object.freeze([candidates.length > 1
        ? "Multiple authority grants match; resolve the authoritative grant before committing externally."
        : "No evidence-backed authority grant covers this commercial commitment." ]),
    });
  }

  const selected = candidates[0];
  return Object.freeze({
    contract: BUSINESS_COMMERCIAL_AUTHORITY_CONTRACT,
    authorised: true,
    matchingGrant: selected,
    humanReviewRequired: false,
    reasons: Object.freeze([`Authority is explicitly evidenced by ${cleanIds(selected.evidenceIds).join(", ")}.`]),
  });
}

export function prohibitedCommercialCommitmentInstruction(decision: CommercialAuthorityDecision, request: CommercialCommitmentRequest): string | null {
  return decision.authorised ? null : `Do not commit EVAVO to ${request.kind} terms: ${request.statement}`;
}
