import { businessAutopilotMetadataWriteSafety } from './businessAutopilotSafety';

function clean(value: unknown, fallback: string, max = 512) {
  const text = typeof value === 'string' ? value.trim() : '';
  return (text || fallback).slice(0, max);
}

function nullable(value: unknown, max = 512) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, max) : null;
}

function metadata(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function normalizeBusinessContentIdeaInput(input: any) {
  return {
    id: nullable(input?.id, 128) || undefined,
    title: clean(input?.title, 'Untitled internal content idea', 256),
    contentType: 'internal_idea',
    summary: nullable(input?.summary, 2000),
    sourceSignalIds: Array.isArray(input?.sourceSignalIds) ? input.sourceSignalIds.slice(0, 100) : [],
    targetSegment: nullable(input?.targetSegment, 256),
    recommendedChannel: 'internal_review',
    priorityScore: Number.isFinite(Number(input?.priorityScore)) ? Number(input.priorityScore) : 0,
    status: 'needs_review',
    metadata: {
      ...metadata(input?.metadata),
      contract: 'business_internal_content_idea_v2',
      requestedContentType: nullable(input?.contentType, 64),
      requestedRecommendedChannel: nullable(input?.recommendedChannel, 128),
      requestedStatus: nullable(input?.status, 64),
      internalMetadataOnly: true,
      reviewOnly: true,
      executable: false,
      deliverable: false,
      publishable: false,
      authoritativeForExecution: false,
      externalExecutionAllowed: false,
    },
  };
}

export function normalizeBusinessFollowupInput(input: any) {
  return {
    id: nullable(input?.id, 128) || undefined,
    organizationId: nullable(input?.organizationId, 128),
    personId: nullable(input?.personId, 128),
    opportunityId: nullable(input?.opportunityId, 128),
    actionDraftId: null,
    followupType: 'manual_internal_review',
    dueAt: nullable(input?.dueAt, 64),
    status: 'open',
    notes: nullable(input?.notes, 2000),
    metadata: {
      ...metadata(input?.metadata),
      contract: 'business_internal_followup_v2',
      requestedFollowupType: nullable(input?.followupType, 128),
      requestedStatus: nullable(input?.status, 64),
      requestedActionDraftId: nullable(input?.actionDraftId, 128),
      internalMetadataOnly: true,
      reviewOnly: true,
      executable: false,
      deliverable: false,
      authoritativeForExecution: false,
      externalExecutionAllowed: false,
    },
  };
}

export function markBusinessInternalPlanningRecord<T extends Record<string, unknown>>(record: T) {
  return {
    ...record,
    internalMetadataOnly: true,
    reviewOnly: true,
    executable: false,
    deliverable: false,
    authoritativeForExecution: false,
    externalExecutionAllowed: false,
    safety: businessAutopilotMetadataWriteSafety(),
  };
}
