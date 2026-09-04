import type { CommunicationDecisionPackage } from "./businessCommunicationDecisionPackage";
import type { CommunicationEvidenceBundle, CommunicationEvidenceItem } from "./businessCommunicationEvidenceBundle";
import type { ReplyBrief } from "./businessCommunicationReplyBrief";
import type { BusinessObligation } from "./businessObligationLedger";

export const BUSINESS_STAFF_COMMUNICATION_HANDOFF_V1_CONTRACT = "business_staff_communication_handoff_v1" as const;

export type StaffHandoffParticipant = Readonly<{
  label: string;
  role: "sender" | "to" | "cc" | "bcc" | "mentioned";
  relationship: "client" | "prospect" | "partner" | "supplier" | "candidate" | "employee" | "other";
  identityVerified: boolean;
  addressVerified: boolean;
  address?: string;
  organizationLabel?: string;
}>;

export type StaffHandoffAttachmentExpectation = Readonly<{
  label: string;
  required: boolean;
  authoritativeDocumentId?: string;
  evidenceIds: readonly string[];
}>;

export type StaffCommunicationHandoffV1Built = Readonly<{
  schema: "evavo-writing/staff-communication-handoff";
  version: 1;
  protocol: "evavo-staff-communication-handoff-v1";
  handoffId: string;
  createdAt: string;
  sourceOwner: "evavo-worker-agent";
  relationshipId?: string;
  organizationId?: string;
  personId?: string;
  threadId?: string;
  communicationKind: "reply" | "new_message" | "follow_up" | "acknowledgement";
  participants: readonly StaffHandoffParticipant[];
  threadSummary: string;
  previousResponseSummary?: string;
  relationshipSummary?: string;
  decision: Readonly<{
    disposition: "reply" | "acknowledge" | "follow_up" | "do_not_reply" | "escalate" | "defer";
    objective: string;
    desiredOutcome?: string;
    reasoningSummary: string;
    decisionConfidence: number;
    emotionalSensitivity: "low" | "medium" | "high";
    reputationalSensitivity: "low" | "medium" | "high";
    urgency: "normal" | "time_sensitive" | "urgent";
    urgencyReason?: string;
  }>;
  obligations: readonly Readonly<{
    id: string;
    owner: "evavo" | "counterparty" | "shared" | "unknown";
    statement: string;
    dueAt?: string;
    status: "open" | "satisfied" | "superseded" | "uncertain";
    evidenceIds: readonly string[];
  }>[];
  attachmentExpectations: readonly StaffHandoffAttachmentExpectation[];
  evidence: readonly Readonly<{
    id: string;
    sourceSystem: "gmail" | "calendar" | "operations_core" | "docs_suite" | "support_agent" | "worker_agent" | "operator" | "other";
    label: string;
    statement: string;
    observedAt: string;
    confidence: number;
    classification: "public" | "internal" | "confidential" | "restricted";
    authoritativeFor: readonly ("thread_content" | "recipient_identity" | "relationship_context" | "project_state" | "commercial_state" | "document_state" | "calendar_availability" | "support_state" | "public_research" | "operator_instruction" | "other")[];
    approvedForWriting: boolean;
    conflicting: boolean;
  }>[];
  brief: Readonly<{
    openingApproach?: string;
    mustAnswer: readonly string[];
    mustInclude: readonly string[];
    mustAvoid: readonly string[];
    prohibitedClaims: readonly string[];
    prohibitedCommitments: readonly string[];
    unresolvedQuestions: readonly string[];
    toneGuidance: readonly string[];
    closingApproach?: string;
    maximumWords?: number;
  }>;
  policy: Readonly<{
    riskTier: 0 | 1 | 2 | 3;
    assumptionsAllowed: boolean;
    humanReviewRequired: true;
    externalEffectsAllowed: false;
    providerWritesAllowed: false;
    recipientVerificationRequired: boolean;
    attachmentVerificationRequired: boolean;
  }>;
}>;

const AUTHORITY_MAP: Readonly<Record<string, StaffCommunicationHandoffV1Built["evidence"][number]["authoritativeFor"][number]>> = Object.freeze({
  thread: "thread_content",
  thread_content: "thread_content",
  identity: "recipient_identity",
  recipient_identity: "recipient_identity",
  relationship: "relationship_context",
  relationship_context: "relationship_context",
  project_state: "project_state",
  commercial_state: "commercial_state",
  document_state: "document_state",
  calendar: "calendar_availability",
  calendar_availability: "calendar_availability",
  support_state: "support_state",
  public_research: "public_research",
  operator_instruction: "operator_instruction",
});

function iso(value: string, field: string): string {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) throw new Error(`STAFF_HANDOFF_V1_${field.toUpperCase()}_INVALID`);
  return parsed.toISOString();
}

function clean(value: string, field: string, max = 8000): string {
  const result = value.trim();
  if (!result || result.length > max) throw new Error(`STAFF_HANDOFF_V1_${field.toUpperCase()}_INVALID`);
  return result;
}

function evidenceAuthority(item: CommunicationEvidenceItem): readonly StaffCommunicationHandoffV1Built["evidence"][number]["authoritativeFor"][number][] {
  const mapped: Array<StaffCommunicationHandoffV1Built["evidence"][number]["authoritativeFor"][number]> = item.authoritativeFor.map((authority) => AUTHORITY_MAP[authority] ?? "other");
  type Authority = StaffCommunicationHandoffV1Built["evidence"][number]["authoritativeFor"][number];
  return Object.freeze([...new Set<Authority>(mapped.length ? mapped : ["other"])]);
}

function targetWords(target: ReplyBrief["targetLength"]): number {
  if (target === "one_line") return 35;
  if (target === "short") return 180;
  if (target === "normal") return 450;
  return 1200;
}

function decisionDisposition(value: CommunicationDecisionPackage["disposition"]): StaffCommunicationHandoffV1Built["decision"]["disposition"] {
  if (value === "review_then_reply") return "reply";
  return value;
}

export function buildStaffCommunicationHandoffV1(input: Readonly<{
  handoffId: string;
  createdAt: string;
  communicationKind: StaffCommunicationHandoffV1Built["communicationKind"];
  participants: readonly StaffHandoffParticipant[];
  threadSummary: string;
  previousResponseSummary?: string | null;
  relationshipSummary?: string | null;
  relationshipId?: string | null;
  organizationId?: string | null;
  personId?: string | null;
  threadId?: string | null;
  decision: CommunicationDecisionPackage;
  evidenceBundle: CommunicationEvidenceBundle;
  replyBrief: ReplyBrief;
  obligations?: readonly BusinessObligation[];
  attachmentExpectations?: readonly StaffHandoffAttachmentExpectation[];
  desiredOutcome?: string | null;
  emotionalSensitivity?: "low" | "medium" | "high";
  reputationalSensitivity?: "low" | "medium" | "high";
  urgency?: "normal" | "time_sensitive" | "urgent";
  urgencyReason?: string | null;
  riskTier?: 0 | 1 | 2 | 3;
}>): StaffCommunicationHandoffV1Built {
  if (!input.decision.approvalGradeReady) throw new Error("STAFF_HANDOFF_V1_DECISION_NOT_READY");
  if (input.decision.disposition === "escalate" || input.decision.disposition === "do_not_reply") {
    throw new Error(`STAFF_HANDOFF_V1_DISPOSITION_NOT_DRAFTABLE:${input.decision.disposition}`);
  }
  if (!input.replyBrief.shouldDraft) throw new Error("STAFF_HANDOFF_V1_REPLY_BRIEF_NOT_DRAFTABLE");
  if (!input.participants.length) throw new Error("STAFF_HANDOFF_V1_PARTICIPANT_REQUIRED");
  if (input.evidenceBundle.missingCriticalContext.length) throw new Error("STAFF_HANDOFF_V1_CRITICAL_EVIDENCE_MISSING");

  const evidence = input.evidenceBundle.items.map((item) => Object.freeze({
    id: clean(item.id, "evidence_id", 240),
    sourceSystem: item.source,
    label: clean(item.kind || item.source, "evidence_label", 500),
    statement: clean(item.summary, "evidence_statement"),
    observedAt: iso(item.observedAt, "evidence_observed_at"),
    confidence: item.confidence,
    classification: item.classification ?? "internal",
    authoritativeFor: evidenceAuthority(item),
    approvedForWriting: item.approvedForWriting === true,
    conflicting: item.conflicting === true,
  }));
  if (!evidence.some((item) => item.approvedForWriting && !item.conflicting)) throw new Error("STAFF_HANDOFF_V1_APPROVED_EVIDENCE_REQUIRED");

  const evidenceIds = new Set(evidence.map((item) => item.id));
  const obligations = (input.obligations ?? []).map((item) => {
    const refs = [...new Set(item.sourceEvidenceIds.filter((id) => evidenceIds.has(id)))];
    if (!refs.length) throw new Error(`STAFF_HANDOFF_V1_OBLIGATION_EVIDENCE_UNKNOWN:${item.id}`);
    const status = item.status === "cancelled" ? "superseded" : item.status;
    return Object.freeze({
      id: item.id,
      owner: item.owner,
      statement: item.statement,
      ...(item.dueAt ? { dueAt: iso(item.dueAt, "obligation_due_at") } : {}),
      status,
      evidenceIds: Object.freeze(refs),
    });
  });

  const attachments = (input.attachmentExpectations ?? []).map((item) => {
    const refs = [...new Set(item.evidenceIds.filter((id) => evidenceIds.has(id)))];
    if (item.evidenceIds.length && !refs.length) throw new Error(`STAFF_HANDOFF_V1_ATTACHMENT_EVIDENCE_UNKNOWN:${item.label}`);
    return Object.freeze({ ...item, evidenceIds: Object.freeze(refs) });
  });

  const urgency = input.urgency ?? "normal";
  if (urgency !== "normal" && !input.urgencyReason?.trim()) throw new Error("STAFF_HANDOFF_V1_URGENCY_REASON_REQUIRED");

  const participants = input.participants.map((participant) => Object.freeze({ ...participant }));
  const recipientVerificationRequired = participants.some((participant) => ["to", "cc", "bcc"].includes(participant.role));
  if (recipientVerificationRequired && participants.some((participant) => ["to", "cc", "bcc"].includes(participant.role) && (!participant.identityVerified || !participant.addressVerified))) {
    throw new Error("STAFF_HANDOFF_V1_RECIPIENT_NOT_VERIFIED");
  }

  return Object.freeze({
    schema: "evavo-writing/staff-communication-handoff",
    version: 1,
    protocol: "evavo-staff-communication-handoff-v1",
    handoffId: clean(input.handoffId, "handoff_id", 240),
    createdAt: iso(input.createdAt, "created_at"),
    sourceOwner: "evavo-worker-agent",
    ...(input.relationshipId?.trim() ? { relationshipId: input.relationshipId.trim() } : {}),
    ...(input.organizationId?.trim() ? { organizationId: input.organizationId.trim() } : {}),
    ...(input.personId?.trim() ? { personId: input.personId.trim() } : {}),
    ...(input.threadId?.trim() ? { threadId: input.threadId.trim() } : {}),
    communicationKind: input.communicationKind,
    participants: Object.freeze(participants),
    threadSummary: clean(input.threadSummary, "thread_summary"),
    ...(input.previousResponseSummary?.trim() ? { previousResponseSummary: input.previousResponseSummary.trim() } : {}),
    ...(input.relationshipSummary?.trim() ? { relationshipSummary: input.relationshipSummary.trim() } : {}),
    decision: Object.freeze({
      disposition: decisionDisposition(input.decision.disposition),
      objective: clean(input.decision.objective, "decision_objective"),
      ...(input.desiredOutcome?.trim() ? { desiredOutcome: input.desiredOutcome.trim() } : {}),
      reasoningSummary: clean(input.decision.reasons.join(" ") || "Evidence-backed communication decision.", "decision_reasoning"),
      decisionConfidence: input.decision.evidenceConfidence,
      emotionalSensitivity: input.emotionalSensitivity ?? "low",
      reputationalSensitivity: input.reputationalSensitivity ?? "low",
      urgency,
      ...(input.urgencyReason?.trim() ? { urgencyReason: input.urgencyReason.trim() } : {}),
    }),
    obligations: Object.freeze(obligations),
    attachmentExpectations: Object.freeze(attachments),
    evidence: Object.freeze(evidence),
    brief: Object.freeze({
      ...(input.replyBrief.openingApproach ? { openingApproach: input.replyBrief.openingApproach } : {}),
      mustAnswer: Object.freeze([...input.replyBrief.responsePoints]),
      mustInclude: Object.freeze([...input.decision.liveResponseTargets]),
      mustAvoid: Object.freeze([...input.replyBrief.commitmentsToAvoid]),
      prohibitedClaims: Object.freeze([...input.decision.prohibitedImplications]),
      prohibitedCommitments: Object.freeze([...input.replyBrief.commitmentsToAvoid]),
      unresolvedQuestions: Object.freeze([...input.replyBrief.factsToVerify]),
      toneGuidance: Object.freeze([...input.replyBrief.toneRules]),
      ...(input.replyBrief.closingApproach ? { closingApproach: input.replyBrief.closingApproach } : {}),
      maximumWords: targetWords(input.replyBrief.targetLength),
    }),
    policy: Object.freeze({
      riskTier: input.riskTier ?? 1,
      assumptionsAllowed: false,
      humanReviewRequired: true,
      externalEffectsAllowed: false,
      providerWritesAllowed: false,
      recipientVerificationRequired,
      attachmentVerificationRequired: attachments.some((item) => item.required),
    }),
  });
}
