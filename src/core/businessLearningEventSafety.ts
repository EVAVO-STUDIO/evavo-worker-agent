import { businessAutopilotMetadataWriteSafety } from './businessAutopilotSafety';

const allowedEntityTypes = new Set([
  'organization',
  'opportunity',
  'signal',
  'service_match',
  'audit_pack',
  'source',
  'system',
]);

const allowedOutcomes = new Set([
  'accepted',
  'rejected',
  'needs_more_evidence',
  'bad_fit',
  'stale',
  'duplicate',
  'blocked',
  'manual_review',
]);

function text(value: unknown, fallback: string, max: number) {
  const cleaned = typeof value === 'string' ? value.trim() : '';
  return (cleaned || fallback).slice(0, max);
}

function nullable(value: unknown, max: number) {
  const cleaned = typeof value === 'string' ? value.trim() : '';
  return cleaned ? cleaned.slice(0, max) : null;
}

function metadata(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function boundedScoreDelta(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(-10, Math.min(10, Math.round(parsed * 100) / 100));
}

export function normalizeBusinessLearningEventInput(input: any) {
  const requestedEntityType = nullable(input?.entityType, 64);
  const requestedOutcome = nullable(input?.outcome, 128);
  const entityType = requestedEntityType && allowedEntityTypes.has(requestedEntityType)
    ? requestedEntityType
    : 'system';
  const outcome = requestedOutcome && allowedOutcomes.has(requestedOutcome)
    ? requestedOutcome
    : 'manual_review';

  return {
    id: nullable(input?.id, 128) || undefined,
    entityType,
    entityId: text(input?.entityId, 'unknown', 128),
    eventType: 'operator_feedback',
    outcome,
    scoreDelta: boundedScoreDelta(input?.scoreDelta),
    notes: nullable(input?.notes, 2000),
    metadata: {
      ...metadata(input?.metadata),
      contract: 'business_internal_learning_event_v2',
      requestedEntityType,
      requestedEventType: nullable(input?.eventType, 128),
      requestedOutcome,
      requestedScoreDelta: Number.isFinite(Number(input?.scoreDelta)) ? Number(input.scoreDelta) : null,
      scoreDeltaMinimum: -10,
      scoreDeltaMaximum: 10,
      internalMetadataOnly: true,
      reviewOnly: true,
      executable: false,
      deliverable: false,
      authoritativeForExecution: false,
      externalExecutionAllowed: false,
    },
  };
}

export function markBusinessLearningEventRecord<T extends Record<string, unknown>>(record: T) {
  return {
    ...record,
    contract: 'business_internal_learning_event_v2',
    internalMetadataOnly: true,
    reviewOnly: true,
    executable: false,
    deliverable: false,
    authoritativeForExecution: false,
    externalExecutionAllowed: false,
    safety: businessAutopilotMetadataWriteSafety(),
  };
}
