import type { CommunicationWritingProvenanceBinding } from "./businessCommunicationSendEnvelope";
import type { StaffCommunicationHandoffV2Like } from "./businessStaffCommunicationHandoffV2";

export const BUSINESS_STAFF_WRITING_PROVENANCE_BINDING_CONTRACT = "business_staff_writing_provenance_binding_v1" as const;
export const EVAVO_STAFF_WRITING_ENVELOPE_V2_CONTRACT = "evavo-writing/staff-communication-writing-envelope-v2" as const;

export type StaffWritingEnvelopeV2Like = Readonly<{
  contract: typeof EVAVO_STAFF_WRITING_ENVELOPE_V2_CONTRACT;
  writingRequest: Readonly<{
    requestId: string;
    [key: string]: unknown;
  }>;
  provenance: Readonly<{
    relationshipId: string;
    handoffId: string;
    decisionPackageId: string;
    decisionOrigin: "direct" | "relationship_manager_cycle";
    relationshipCycleId?: string;
    staffContextGeneratedAt: string;
    sourceRefs: readonly string[];
  }>;
}>;

export type StaffWritingProvenanceBindingResult = Readonly<{
  contract: typeof BUSINESS_STAFF_WRITING_PROVENANCE_BINDING_CONTRACT;
  approvalBinding: CommunicationWritingProvenanceBinding;
  relationshipId: string;
  decisionPackageId: string;
  staffContextGeneratedAt: string;
  sourceRefs: readonly string[];
}>;

function required(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  const a = [...new Set(left.map((item) => item.trim()).filter(Boolean))].sort();
  const b = [...new Set(right.map((item) => item.trim()).filter(Boolean))].sort();
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/**
 * Converts Writing Studio's provenance-preserving staff envelope into the
 * exact approval binding accepted by the send envelope. This is deliberately
 * fail-closed: Worker will not approve a draft that came back from a different
 * handoff, decision package, relationship cycle or evidence context.
 */
export function bindStaffWritingProvenanceForApproval(input: Readonly<{
  handoff: StaffCommunicationHandoffV2Like;
  writingEnvelope: StaffWritingEnvelopeV2Like | unknown;
}>): StaffWritingProvenanceBindingResult {
  const envelope = input.writingEnvelope as Partial<StaffWritingEnvelopeV2Like> | null;
  if (!envelope || envelope.contract !== EVAVO_STAFF_WRITING_ENVELOPE_V2_CONTRACT) {
    throw new Error("STAFF_WRITING_PROVENANCE_ENVELOPE_CONTRACT_INVALID");
  }
  if (!envelope.writingRequest || !envelope.provenance) throw new Error("STAFF_WRITING_PROVENANCE_ENVELOPE_INCOMPLETE");

  const expected = input.handoff.staffContext;
  const actual = envelope.provenance;
  const embeddedHandoffId = required(input.handoff.handoff.handoffId, "STAFF_WRITING_PROVENANCE_HANDOFF_ID_REQUIRED");
  const writingRequestId = required(envelope.writingRequest.requestId, "STAFF_WRITING_PROVENANCE_REQUEST_ID_REQUIRED");

  if (required(actual.relationshipId, "STAFF_WRITING_PROVENANCE_RELATIONSHIP_REQUIRED") !== expected.relationshipId) {
    throw new Error("STAFF_WRITING_PROVENANCE_RELATIONSHIP_MISMATCH");
  }
  if (required(actual.handoffId, "STAFF_WRITING_PROVENANCE_HANDOFF_REQUIRED") !== embeddedHandoffId) {
    throw new Error("STAFF_WRITING_PROVENANCE_HANDOFF_MISMATCH");
  }
  if (required(actual.decisionPackageId, "STAFF_WRITING_PROVENANCE_DECISION_REQUIRED") !== expected.decisionPackageId) {
    throw new Error("STAFF_WRITING_PROVENANCE_DECISION_MISMATCH");
  }
  if (actual.decisionOrigin !== expected.decisionOrigin) throw new Error("STAFF_WRITING_PROVENANCE_ORIGIN_MISMATCH");
  if ((actual.relationshipCycleId?.trim() || undefined) !== expected.relationshipCycleId) {
    throw new Error("STAFF_WRITING_PROVENANCE_RELATIONSHIP_CYCLE_MISMATCH");
  }
  if (required(actual.staffContextGeneratedAt, "STAFF_WRITING_PROVENANCE_GENERATED_AT_REQUIRED") !== expected.generatedAt) {
    throw new Error("STAFF_WRITING_PROVENANCE_GENERATED_AT_MISMATCH");
  }
  if (!sameSet(actual.sourceRefs, expected.sourceRefs)) throw new Error("STAFF_WRITING_PROVENANCE_SOURCE_REFS_MISMATCH");

  const sourceRefs = Object.freeze([...new Set(actual.sourceRefs.map((item) => item.trim()).filter(Boolean))].sort());
  return Object.freeze({
    contract: BUSINESS_STAFF_WRITING_PROVENANCE_BINDING_CONTRACT,
    approvalBinding: Object.freeze({
      handoffId: embeddedHandoffId,
      writingRequestId,
      decisionOrigin: actual.decisionOrigin,
      ...(actual.relationshipCycleId ? { relationshipCycleId: actual.relationshipCycleId.trim() } : {}),
    }),
    relationshipId: expected.relationshipId,
    decisionPackageId: expected.decisionPackageId,
    staffContextGeneratedAt: expected.generatedAt,
    sourceRefs,
  });
}
