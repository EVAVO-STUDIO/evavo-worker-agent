import type { CandidateRelationshipInput } from "./businessCandidateRelationship";
import type { CommunicationChannel } from "./businessRelationshipConductPolicy";
import type { RelationshipManagerCommunicationCycleInput } from "./businessRelationshipManagerRuntime";

export const BUSINESS_RELATIONSHIP_MANAGER_RUNTIME_INPUT_CONTRACT = "business_relationship_manager_runtime_input_v1" as const;

type JsonObject = Record<string, unknown>;

function object(value: unknown, field: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`RELATIONSHIP_MANAGER_INPUT_${field.toUpperCase()}_OBJECT_REQUIRED`);
  }
  return value as JsonObject;
}

function text(value: unknown, field: string, max = 4000): string {
  if (typeof value !== "string") throw new Error(`RELATIONSHIP_MANAGER_INPUT_${field.toUpperCase()}_REQUIRED`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new Error(`RELATIONSHIP_MANAGER_INPUT_${field.toUpperCase()}_INVALID`);
  return normalized;
}

function optionalText(value: unknown, field: string, max = 4000): string | undefined {
  if (value === undefined || value === null) return undefined;
  return text(value, field, max);
}

function optionalBool(value: unknown, field: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") throw new Error(`RELATIONSHIP_MANAGER_INPUT_${field.toUpperCase()}_BOOLEAN_REQUIRED`);
  return value;
}

function requiredBool(value: unknown, field: string): boolean {
  const result = optionalBool(value, field);
  if (result === undefined) throw new Error(`RELATIONSHIP_MANAGER_INPUT_${field.toUpperCase()}_BOOLEAN_REQUIRED`);
  return result;
}

function boundedNumber(value: unknown, field: string, min = 0, max = 100): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`RELATIONSHIP_MANAGER_INPUT_${field.toUpperCase()}_INVALID`);
  }
  return value;
}

function stringArray(value: unknown, field: string, maxItems = 500): readonly string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length > maxItems) throw new Error(`RELATIONSHIP_MANAGER_INPUT_${field.toUpperCase()}_ARRAY_INVALID`);
  return Object.freeze(value.map((item, index) => text(item, `${field}_${index}`, 2000)));
}

function communicationParty(value: unknown, field: string) {
  const input = object(value, field);
  const name = optionalText(input.name, `${field}_name`, 300);
  return Object.freeze({
    ...(name ? { name } : {}),
    address: text(input.address, `${field}_address`, 320),
  });
}

function gmailMessage(value: unknown, index: number) {
  const input = object(value, `gmail_message_${index}`);
  if (!Array.isArray(input.to) || input.to.length < 1 || input.to.length > 200) {
    throw new Error("RELATIONSHIP_MANAGER_INPUT_GMAIL_MESSAGE_TO_INVALID");
  }
  if (input.cc !== undefined && (!Array.isArray(input.cc) || input.cc.length > 200)) {
    throw new Error("RELATIONSHIP_MANAGER_INPUT_GMAIL_MESSAGE_CC_INVALID");
  }
  const subject = optionalText(input.subject, `gmail_message_${index}_subject`, 2000);
  const attachmentNames = stringArray(input.attachmentNames, `gmail_message_${index}_attachment_names`, 100);
  return Object.freeze({
    id: text(input.id, `gmail_message_${index}_id`, 500),
    threadId: text(input.threadId, `gmail_message_${index}_thread_id`, 500),
    sentAt: text(input.sentAt, `gmail_message_${index}_sent_at`, 100),
    from: communicationParty(input.from, `gmail_message_${index}_from`),
    to: Object.freeze(input.to.map((party, partyIndex) => communicationParty(party, `gmail_message_${index}_to_${partyIndex}`))),
    ...(input.cc ? { cc: Object.freeze((input.cc as unknown[]).map((party, partyIndex) => communicationParty(party, `gmail_message_${index}_cc_${partyIndex}`))) } : {}),
    ...(subject ? { subject } : {}),
    body: text(input.body, `gmail_message_${index}_body`, 32_768),
    ...(attachmentNames ? { attachmentNames } : {}),
  });
}

function identity(value: unknown): RelationshipManagerCommunicationCycleInput["identity"] {
  const input = object(value, "identity");
  const status = text(input.status, "identity_status", 40);
  if (!(["verified", "ambiguous", "unresolved"] as readonly string[]).includes(status)) {
    throw new Error("RELATIONSHIP_MANAGER_INPUT_IDENTITY_STATUS_INVALID");
  }
  const reasons = stringArray(input.reasons, "identity_reasons", 100) ?? Object.freeze([]);
  const competingPersonIds = stringArray(input.competingPersonIds, "identity_competing_person_ids", 100) ?? Object.freeze([]);
  let selected: RelationshipManagerCommunicationCycleInput["identity"]["selected"];

  if (input.selected !== undefined && input.selected !== null) {
    const person = object(input.selected, "identity_selected");
    if (!Array.isArray(person.addresses) || person.addresses.length < 1 || person.addresses.length > 100 || !Array.isArray(person.evidence) || person.evidence.length < 1 || person.evidence.length > 200) {
      throw new Error("RELATIONSHIP_MANAGER_INPUT_IDENTITY_SELECTED_INVALID");
    }
    const organizationIds = stringArray(person.organizationIds, "identity_organization_ids", 100);
    const relationshipIds = stringArray(person.relationshipIds, "identity_relationship_ids", 100);
    selected = Object.freeze({
      personId: text(person.personId, "identity_person_id", 500),
      name: text(person.name, "identity_name", 500),
      addresses: Object.freeze(person.addresses.map((address, index) => text(address, `identity_address_${index}`, 320))),
      ...(organizationIds ? { organizationIds } : {}),
      ...(relationshipIds ? { relationshipIds } : {}),
      evidence: Object.freeze(person.evidence.map((raw, index) => {
        const item = object(raw, `identity_evidence_${index}`);
        const source = text(item.source, `identity_evidence_${index}_source`, 40);
        const allowedSources = ["gmail", "contacts", "operations_core", "memory", "operator", "other"] as const;
        if (!(allowedSources as readonly string[]).includes(source)) {
          throw new Error("RELATIONSHIP_MANAGER_INPUT_IDENTITY_EVIDENCE_SOURCE_INVALID");
        }
        return Object.freeze({
          source: source as (typeof allowedSources)[number],
          ref: text(item.ref, `identity_evidence_${index}_ref`, 1000),
          confidence: boundedNumber(item.confidence, `identity_evidence_${index}_confidence`),
        });
      })),
    });
  }

  if (status === "verified" && !selected) throw new Error("RELATIONSHIP_MANAGER_INPUT_VERIFIED_IDENTITY_SELECTED_REQUIRED");
  return Object.freeze({
    contract: "business_relationship_identity_resolver_v1",
    status: status as "verified" | "ambiguous" | "unresolved",
    ...(selected ? { selected } : {}),
    confidence: boundedNumber(input.confidence, "identity_confidence"),
    exactAddressMatch: requiredBool(input.exactAddressMatch, "identity_exact_address_match"),
    reasons,
    competingPersonIds,
  });
}

function candidate(value: unknown): CandidateRelationshipInput {
  const input = object(value, "candidate");
  const personId = optionalText(input.personId, "candidate_person_id", 500);
  const suppressionActive = optionalBool(input.suppressionActive, "candidate_suppression_active");
  return Object.freeze({
    relationshipId: text(input.relationshipId, "candidate_relationship_id", 500),
    ...(personId ? { personId } : {}),
    explicitRoleOpen: requiredBool(input.explicitRoleOpen, "candidate_explicit_role_open"),
    activeRecruitmentProcess: requiredBool(input.activeRecruitmentProcess, "candidate_active_recruitment_process"),
    materialsSupplied: requiredBool(input.materialsSupplied, "candidate_materials_supplied"),
    materialsActuallyReviewed: requiredBool(input.materialsActuallyReviewed, "candidate_materials_actually_reviewed"),
    relevantSkillsEvidence: requiredBool(input.relevantSkillsEvidence, "candidate_relevant_skills_evidence"),
    futureRelevanceEvidence: requiredBool(input.futureRelevanceEvidence, "candidate_future_relevance_evidence"),
    personalizedEffort: requiredBool(input.personalizedEffort, "candidate_personalized_effort"),
    clearFitEvidence: requiredBool(input.clearFitEvidence, "candidate_clear_fit_evidence"),
    ...(suppressionActive !== undefined ? { suppressionActive } : {}),
  });
}

function channel(value: unknown): RelationshipManagerCommunicationCycleInput["channel"] {
  const input = object(value, "channel");
  const currentChannel = optionalText(input.currentChannel, "channel_current", 40);
  const allowedChannels = ["email", "direct_message", "phone_call", "video_call", "in_person"] as const;
  if (currentChannel && !(allowedChannels as readonly string[]).includes(currentChannel)) {
    throw new Error("RELATIONSHIP_MANAGER_INPUT_CHANNEL_CURRENT_INVALID");
  }
  const result: {
    currentChannel?: CommunicationChannel;
    recipientPrefersSynchronous?: boolean;
    explicitMeetingRequest?: boolean;
    needsRealTimeBackAndForth?: boolean;
    emotionallySensitive?: boolean;
    activeConflictOrRepair?: boolean;
    multiPartyDecision?: boolean;
    complexAmbiguity?: boolean;
    canResolveInWriting?: boolean;
    asynchronousDelayCreatesMaterialRisk?: boolean;
  } = {};
  if (currentChannel) result.currentChannel = currentChannel as CommunicationChannel;
  const booleanFields = [
    ["recipientPrefersSynchronous", "recipient_prefers_synchronous"],
    ["explicitMeetingRequest", "explicit_meeting_request"],
    ["needsRealTimeBackAndForth", "needs_real_time_back_and_forth"],
    ["emotionallySensitive", "emotionally_sensitive"],
    ["activeConflictOrRepair", "active_conflict_or_repair"],
    ["multiPartyDecision", "multi_party_decision"],
    ["complexAmbiguity", "complex_ambiguity"],
    ["canResolveInWriting", "can_resolve_in_writing"],
    ["asynchronousDelayCreatesMaterialRisk", "asynchronous_delay_creates_material_risk"],
  ] as const;
  for (const [property, field] of booleanFields) {
    const parsed = optionalBool(input[property], `channel_${field}`);
    if (parsed !== undefined) result[property] = parsed;
  }
  return Object.freeze(result);
}

export function parseRelationshipManagerCommunicationCycleInput(value: unknown): RelationshipManagerCommunicationCycleInput {
  const root = object(value, "root");
  const gmail = object(root.gmail, "gmail");
  if (!Array.isArray(gmail.messages) || gmail.messages.length < 1 || gmail.messages.length > 500) {
    throw new Error("RELATIONSHIP_MANAGER_INPUT_GMAIL_MESSAGES_INVALID");
  }
  const scenario = text(root.scenario, "scenario", 40);
  if (scenario !== "general" && scenario !== "graduate_or_candidate") throw new Error("RELATIONSHIP_MANAGER_INPUT_SCENARIO_INVALID");
  if (root.artifactResolutions !== undefined || root.calendarCommitments !== undefined || root.staffBrief !== undefined || root.contextResolutionPlan !== undefined || root.memoryContext !== undefined) {
    throw new Error("RELATIONSHIP_MANAGER_INPUT_PRECOMPOSED_TRUSTED_CONTEXT_NOT_ACCEPTED");
  }
  const parsedCandidate = root.candidate !== undefined && root.candidate !== null ? candidate(root.candidate) : undefined;
  if (scenario === "graduate_or_candidate" && !parsedCandidate) throw new Error("RELATIONSHIP_MANAGER_INPUT_CANDIDATE_REQUIRED");

  const relationshipId = optionalText(gmail.relationshipId, "gmail_relationship_id", 500);
  const personId = optionalText(gmail.personId, "gmail_person_id", 500);
  const organizationId = optionalText(gmail.organizationId, "gmail_organization_id", 500);
  const projectId = optionalText(gmail.projectId, "gmail_project_id", 500);
  const knownRelationshipSensitive = optionalBool(gmail.knownRelationshipSensitive, "gmail_known_relationship_sensitive");
  const senderSuppressed = optionalBool(gmail.senderSuppressed, "gmail_sender_suppressed");
  const additionalEvidenceIds = stringArray(root.additionalEvidenceIds, "additional_evidence_ids", 500);
  const attachmentsRequired = optionalBool(root.attachmentsRequired, "attachments_required");
  const calendarPromiseRequired = optionalBool(root.calendarPromiseRequired, "calendar_promise_required");

  return Object.freeze({
    cycleId: text(root.cycleId, "cycle_id", 500),
    observedAt: text(root.observedAt, "observed_at", 100),
    decisionAt: text(root.decisionAt, "decision_at", 100),
    scenario,
    objective: text(root.objective, "objective", 4000),
    gmail: Object.freeze({
      threadId: text(gmail.threadId, "gmail_thread_id", 500),
      messages: Object.freeze(gmail.messages.map(gmailMessage)),
      ...(relationshipId ? { relationshipId } : {}),
      ...(personId ? { personId } : {}),
      ...(organizationId ? { organizationId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(knownRelationshipSensitive !== undefined ? { knownRelationshipSensitive } : {}),
      ...(senderSuppressed !== undefined ? { senderSuppressed } : {}),
    }),
    identity: identity(root.identity),
    channel: channel(root.channel),
    ...(parsedCandidate ? { candidate: parsedCandidate } : {}),
    evidenceConfidence: boundedNumber(root.evidenceConfidence, "evidence_confidence"),
    ...(additionalEvidenceIds ? { additionalEvidenceIds } : {}),
    ...(attachmentsRequired !== undefined ? { attachmentsRequired } : {}),
    ...(calendarPromiseRequired !== undefined ? { calendarPromiseRequired } : {}),
  });
}
