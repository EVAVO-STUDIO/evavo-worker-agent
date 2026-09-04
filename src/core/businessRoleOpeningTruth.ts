export const BUSINESS_ROLE_OPENING_TRUTH_CONTRACT = "business_role_opening_truth_v1" as const;

export type RoleOpeningEvidence = Readonly<{
  id: string;
  source: "operations_core" | "operator" | "other";
  observedAt: string;
  roleId?: string | null;
  roleLabel?: string | null;
  state: "open" | "closed" | "paused" | "unknown";
  authoritative: boolean;
  sourceRef: string;
}>;

export type RoleOpeningTruth = Readonly<{
  contract: typeof BUSINESS_ROLE_OPENING_TRUTH_CONTRACT;
  status: "confirmed_open" | "confirmed_not_open" | "no_confirmed_open_role" | "conflicting";
  maySayRoleExists: boolean;
  maySayNotHiring: boolean;
  safeExternalWording: string;
  evidenceIds: readonly string[];
  reasons: readonly string[];
}>;

export function resolveRoleOpeningTruth(input: Readonly<{
  evidence: readonly RoleOpeningEvidence[];
  targetRoleId?: string | null;
}>): RoleOpeningTruth {
  const target = input.targetRoleId?.trim() || null;
  const relevant = input.evidence.filter((item) => !target || item.roleId === target);
  const authoritative = relevant.filter((item) => item.authoritative);
  const evidenceIds = [...new Set(authoritative.map((item) => item.id))];
  const open = authoritative.filter((item) => item.state === "open");
  const closed = authoritative.filter((item) => item.state === "closed" || item.state === "paused");
  const reasons: string[] = [];

  if (open.length && closed.length) {
    reasons.push("Authoritative evidence conflicts about whether the role is open.");
    return Object.freeze({
      contract: BUSINESS_ROLE_OPENING_TRUTH_CONTRACT,
      status: "conflicting",
      maySayRoleExists: false,
      maySayNotHiring: false,
      safeExternalWording: "I don't have a confirmed current role I can accurately point you to yet.",
      evidenceIds: Object.freeze(evidenceIds),
      reasons: Object.freeze(reasons),
    });
  }

  if (open.length) {
    reasons.push("A current open role is supported by authoritative role-state evidence.");
    return Object.freeze({
      contract: BUSINESS_ROLE_OPENING_TRUTH_CONTRACT,
      status: "confirmed_open",
      maySayRoleExists: true,
      maySayNotHiring: false,
      safeExternalWording: "There is a current role I can point you to.",
      evidenceIds: Object.freeze(evidenceIds),
      reasons: Object.freeze(reasons),
    });
  }

  if (authoritative.length && authoritative.every((item) => item.state === "closed" || item.state === "paused")) {
    reasons.push("The specifically checked role is not currently open according to authoritative role-state evidence.");
    return Object.freeze({
      contract: BUSINESS_ROLE_OPENING_TRUTH_CONTRACT,
      status: "confirmed_not_open",
      maySayRoleExists: false,
      maySayNotHiring: false,
      safeExternalWording: target
        ? "That role isn't currently open."
        : "I don't have a confirmed current opening I can point you to.",
      evidenceIds: Object.freeze(evidenceIds),
      reasons: Object.freeze(reasons),
    });
  }

  reasons.push("No authoritative evidence confirms a current open role; absence of a confirmed opening is not evidence that EVAVO is not hiring at all.");
  return Object.freeze({
    contract: BUSINESS_ROLE_OPENING_TRUTH_CONTRACT,
    status: "no_confirmed_open_role",
    maySayRoleExists: false,
    maySayNotHiring: false,
    safeExternalWording: "I don't have a confirmed current opening I can accurately point you to.",
    evidenceIds: Object.freeze(evidenceIds),
    reasons: Object.freeze(reasons),
  });
}
