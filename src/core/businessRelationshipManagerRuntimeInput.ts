import type { RelationshipManagerCommunicationCycleInput } from "./businessRelationshipManagerRuntime";

export const BUSINESS_RELATIONSHIP_MANAGER_RUNTIME_INPUT_CONTRACT = "business_relationship_manager_runtime_input_v1" as const;

type JsonObject = Record<string, unknown>;

function object(value: unknown, field: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`RELATIONSHIP_MANAGER_INPUT_${field.toUpperCase()}_OBJECT_REQUIRED`);
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

function bool(value: unknown, field: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") throw new Error(`RELATIONSHIP_MANAGER_INPUT_${field.toUpperCase()}_BOOLEAN_REQUIRED`);
  return value;
}

function number(value: unknown, field: string, min = 0, max = 100): number {
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

function message(value: unknown, index: number) {
  const item = object(value, `gmail_message_${index}`);
  const party = (input: unknown, field: string) => {
    const p = object(input, field);
    return Object.freeze({
      ...(optionalText(p.name, `${field}_name`, 300) ? { name: optionalText(p.name, `${field}_name`, 300)! } : {}),
      address: text(p.address, `${field}_address`, 320),
    });
  };
  if (!Array.isArray(item.to) || item.to.length > 200) throw new Error("RELATIONSHIP_MANAGER_INPUT_GMAIL_MESSAGE_TO_INVALID");
  if (item.cc !== undefined && (!Array.isArray(item.cc) || item.cc.length > 200)) throw new Error("RELATIONSHIP_MANAGER_INPUT_GMAIL_MESSAGE_CC_INVALID");
  return Object.freeze({
    id: text(item.id, `gmail_message_${index}_id`, 500),
    threadId: text(item.threadId, `gmail_message_${index}_thread_id`, 500),
    sentAt: text(item.sentAt, `gmail_message_${index}_sent_at`, 100),
    from: party(item.from, `gmail_message_${index}_from`),
    to: Object.freeze(item.to.map((p, partyIndex) => party(p, `gmail_message_${index}_to_${partyIndex}`))),
    ...(item.cc ? { cc: Object.freeze((item.cc as unknown[]).map((p, partyIndex) => party(p, `gmail_message_${index}_cc_${partyIndex}`))) } : {}),
    ...(optionalText(item.subject, `gmail_message_${index}_subject`, 2000) ? { subject: optionalText(item.subject, `gmail_message_${index}_subject`, 2000)! } : {}),
    body: text(item.body, `gmail_message_${index}_body`, 32_768),
    ...(stringArray(item.attachmentNames, `gmail_message_${index}_attachment_names`, 100) ? { attachmentNames: stringArray(item.attachmentNames, `gmail_message_${index}_attachment_names`, 100)! } : {}),
  });
}

function identity(value: unknown): RelationshipManagerCommunicationCycleInput["identity"] {
  const input = object(value, "identity");
  const status = text(input.status, "identity_status", 40);
  if (!(["verified", "ambiguous", "unresolved"] as const).includes(status as "verified" | "ambiguous" | "unresolved")) {
    throw new Error("RELATIONSHIP_MANAGER_INPUT_IDENTITY_STATUS_INVALID");
  }
  const reasons = stringArray(input.reasons, "identity_reasons", 100) ?? Object.freeze([]);
  const competingPersonIds = stringArray(input.competingPersonIds, "identity_competing_person_ids", 100) ?? Object.freeze([]);
  let selected: RelationshipManagerCommunicationCycleInput["identity"]["selected"];
  if (input.selected !== undefined && input.selected !== null) {
    const person = object(input.selected, "identity_selected");
    if (!Array.isArray(person.addresses) || !Array.isArray(person.evidence)) throw new Error("RELATIONSHIP_MANAGER_INPUT_IDENTITY_SELECTED_INVALID");
    selected = Object.freeze({
      personId: text(person.personId, "identity_person_id", 500),
      name: text(person.name, "identity_name", 500),
      addresses: Object.freeze(person.addresses.map((address, index) => text(address, `identity_address_${index}`, 320))),
      ...(stringArray(person.organizationIds, "identity_organization_ids", 100) ? { organizationIds: stringArray(person.organizationIds, "identity_organization_ids", 100)! } : {}),
      ...(stringArray(person.relationshipIds, "identity_relationship_ids", 100) ? { relationshipIds: stringArray(person.relationshipIds, "identity_relationship_ids", 100)! } : {}),
      evidence: Object.freeze(person.evidence.map((raw, index) => {
        const item = object(raw, `identity_evidence_${index}`);
        const source = text(item.source, `identity_evidence_${index}_source`, 40);
        if (!(["gmail", "contacts", "operations_core", "memory", "operator", "other"] as const).includes(source as never)) {
          throw new Error("RELATIONSHIP_MANAGER_INPUT_IDENTITY_EVIDENCE_SOURCE_INVALID");
        }
        return Object.freeze({
          source: source as "gmail" | "contacts" | "operations_core" | "memory" | "operator" | "other",
          ref: text(item.ref, `identity_evidence_${index}_ref`, 1000),
          confidence: number(item.confidence, `identity_evidence_${index}_confidence`),
        });
      })),
    });
  }
  return Object.freeze({
    contract: "business_relationship_identity_resolver_v1",
    status: status as "verified" | "ambiguous" | "unresolved",
    ...(selected ? { selected } : {}),
    confidence: number(input.confidence, "identity_confidence"),
    exactAddressMatch: Boolean(input.exactAddressMatch),
    reasons,
    competingPersonIds,
  });
}

export function parseRelationshipManagerCommunicationCycleInput(value: unknown): RelationshipManagerCommunicationCycleInput {
  const root = object(value, "root");
  const gmail = object(root.gmail, "gmail");
  if (!Array.isArray(gmail.messages) || gmail.messages.length < 1 || gmail.messages.length > 500) {
    throw new Error("RELATIONSHIP_MANAGER_INPUT_GMAIL_MESSAGES_INVALID");
  }
  const scenario = text(root.scenario, "scenario", 40);
  if (scenario !== "general" && scenario !== "graduate_or_candidate") throw new Error("RELATIONSHIP_MANAGER_INPUT_SCENARIO_INVALID");
  const channel = object(root.channel, "channel");

  return Object.freeze({
    cycleId: text(root.cycleId, "cycle_id", 500),
    observedAt: text(root.observedAt, "observed_at", 100),
    decisionAt: text(root.decisionAt, "decision_at", 100),
    scenario,
    objective: text(root.objective, "objective", 4000),
    gmail: Object.freeze({
      threadId: text(gmail.threadId, "gmail_thread_id", 500),
      messages: Object.freeze(gmail.messages.map(message)),
      ...(optionalText(gmail.relationshipId, "gmail_relationship_id", 500) ? { relationshipId: optionalText(gmail.relationshipId, "gmail_relationship_id", 500)! } : {}),
      ...(optionalText(gmail.personId, "gmail_person_id", 500) ? { personId: optionalText(gmail.personId, "gmail_person_id", 500)! } : {}),
      ...(optionalText(gmail.organizationId, "gmail_organization_id", 500) ? { organizationId: optionalText(gmail.organizationId, "gmail_organization_id", 500)! } : {}),
      ...(optionalText(gmail.projectId, "gmail_project_id", 500) ? { projectId: optionalText(gmail.projectId, "gmail_project_id", 500)! } : {}),
      ...(bool(gmail.knownRelationshipSensitive, "gmail_known_relationship_sensitive") !== undefined ? { knownRelationshipSensitive: bool(gmail.knownRelationshipSensitive, "gmail_known_relationship_sensitive")! } : {}),
      ...(bool(gmail.senderSuppressed, "gmail_sender_suppressed") !== undefined ? { senderSuppressed: bool(gmail.senderSuppressed, "gmail_sender_suppressed")! } : {}),
    }),
    identity: identity(root.identity),
    channel: Object.freeze({
      currentChannel: text(channel.currentChannel, "channel_current", 40) as RelationshipManagerCommunicationCycleInput["channel"]["currentChannel"],
      ...(bool(channel.canResolveInWriting, "channel_can_resolve_in_writing") !== undefined ? { canResolveInWriting: bool(channel.canResolveInWriting, "channel_can_resolve_in_writing")! } : {}),
      ...(bool(channel.explicitMeetingRequest, "channel_explicit_meeting_request") !== undefined ? { explicitMeetingRequest: bool(channel.explicitMeetingRequest, "channel_explicit_meeting_request")! } : {}),
      ...(bool(channel.needsRealTimeBackAndForth, "channel_needs_real_time_back_and_forth") !== undefined ? { needsRealTimeBackAndForth: bool(channel.needsRealTimeBackAndForth, "channel_needs_real_time_back_and_forth")! } : {}),
    }),
    evidenceConfidence: number(root.evidenceConfidence, "evidence_confidence"),
    ...(stringArray(root.additionalEvidenceIds, "additional_evidence_ids", 500) ? { additionalEvidenceIds: stringArray(root.additionalEvidenceIds, "additional_evidence_ids", 500)! } : {}),
    ...(bool(root.attachmentsRequired, "attachments_required") !== undefined ? { attachmentsRequired: bool(root.attachmentsRequired, "attachments_required")! } : {}),
    ...(bool(root.calendarPromiseRequired, "calendar_promise_required") !== undefined ? { calendarPromiseRequired: bool(root.calendarPromiseRequired, "calendar_promise_required")! } : {}),
  });
}
