export const BUSINESS_COMMERCIAL_AUTHORITY_CONTRACT = "business_commercial_authority_v1" as const;

export type CommercialCommitmentKind = "price" | "discount" | "scope" | "deadline" | "payment_terms" | "liability" | "contract_term" | "refund" | "credit" | "other";

export type CommercialAuthorityGrant = Readonly<{
  kind: CommercialCommitmentKind;
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
  reasons: readonly string[];
}>;

function time(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`COMMERCIAL_AUTHORITY_${field}_INVALID`);
  return parsed;
}

export function decideCommercialAuthority(
  request: CommercialCommitmentRequest,
  grants: readonly CommercialAuthorityGrant[],
): CommercialAuthorityDecision {
  const requestedAt = time(request.requestedAt, "REQUESTED_AT");
  const candidates = grants.filter((grant) => {
    if (!grant.evidenceIds.length) return false;
    if (grant.kind !== request.kind) return false;
    if (grant.relationshipId && grant.relationshipId !== request.relationshipId) return false;
    if (grant.projectId && grant.projectId !== request.projectId) return false;
    const from = time(grant.validFrom, "VALID_FROM");
    const through = grant.validThrough ? time(grant.validThrough, "VALID_THROUGH") : Number.POSITIVE_INFINITY;
    if (requestedAt < from || requestedAt > through) return false;
    if (typeof request.amountAud === "number") {
      if (typeof grant.maximumAud === "number" && request.amountAud > grant.maximumAud) return false;
      if (typeof grant.minimumAud === "number" && request.amountAud < grant.minimumAud) return false;
    }
    return true;
  });

  if (candidates.length !== 1) {
    return Object.freeze({
      contract: BUSINESS_COMMERCIAL_AUTHORITY_CONTRACT,
      authorised: false,
      matchingGrant: null,
      reasons: Object.freeze([candidates.length > 1
        ? "Multiple authority grants match; resolve the authoritative grant before committing externally."
        : "No evidence-backed authority grant covers this commercial commitment." ]),
    });
  }

  return Object.freeze({
    contract: BUSINESS_COMMERCIAL_AUTHORITY_CONTRACT,
    authorised: true,
    matchingGrant: candidates[0],
    reasons: Object.freeze([`Authority is explicitly evidenced by ${candidates[0].evidenceIds.join(", ")}.`]),
  });
}

export function prohibitedCommercialCommitmentInstruction(decision: CommercialAuthorityDecision, request: CommercialCommitmentRequest): string | null {
  return decision.authorised ? null : `Do not commit EVAVO to ${request.kind} terms: ${request.statement}`;
}
