export type InternalContentIdeaRead = {
  id: string;
  title: string | null;
  contentType: string | null;
  summary: string | null;
  sourceSignalCount: number;
  targetSegment: string | null;
  recommendedChannel: string | null;
  priorityScore: number;
  status: string | null;
  reviewOnly: true;
  executable: false;
  deliverable: false;
  authoritativeForExecution: false;
  detailsRedacted: true;
  createdAt: string | null;
  updatedAt: string | null;
};

export type InternalFollowupRead = {
  id: string;
  organizationId: string | null;
  opportunityId: string | null;
  followupType: string | null;
  dueAt: string | null;
  status: string | null;
  hasNotes: boolean;
  reviewOnly: true;
  executable: false;
  deliverable: false;
  authoritativeForExecution: false;
  identityLinksRedacted: true;
  detailsRedacted: true;
  createdAt: string | null;
  updatedAt: string | null;
};

export type InternalLearningRead = {
  id: string;
  entityType: string | null;
  entityId: string | null;
  eventType: string | null;
  outcome: string | null;
  scoreDelta: number;
  hasNotes: boolean;
  reviewOnly: true;
  executable: false;
  deliverable: false;
  authoritativeForExecution: false;
  detailsRedacted: true;
  createdAt: string | null;
};

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, max) : null;
}

function id(value: unknown): string {
  return text(value, 128) || "unknown";
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function countArray(value: unknown): number {
  return Array.isArray(value) ? Math.min(value.length, 1000) : 0;
}

export function projectInternalContentIdea(record: any): InternalContentIdeaRead {
  return {
    id: id(record?.id),
    title: text(record?.title, 256),
    contentType: text(record?.contentType, 64),
    summary: text(record?.summary, 512),
    sourceSignalCount: countArray(record?.sourceSignalIds),
    targetSegment: text(record?.targetSegment, 128),
    recommendedChannel: text(record?.recommendedChannel, 64),
    priorityScore: number(record?.priorityScore),
    status: text(record?.status, 64),
    reviewOnly: true,
    executable: false,
    deliverable: false,
    authoritativeForExecution: false,
    detailsRedacted: true,
    createdAt: text(record?.createdAt, 64),
    updatedAt: text(record?.updatedAt, 64),
  };
}

export function projectInternalFollowup(record: any): InternalFollowupRead {
  return {
    id: id(record?.id),
    organizationId: text(record?.organizationId, 128),
    opportunityId: text(record?.opportunityId, 128),
    followupType: text(record?.followupType, 128),
    dueAt: text(record?.dueAt, 64),
    status: text(record?.status, 64),
    hasNotes: Boolean(text(record?.notes, 1)),
    reviewOnly: true,
    executable: false,
    deliverable: false,
    authoritativeForExecution: false,
    identityLinksRedacted: true,
    detailsRedacted: true,
    createdAt: text(record?.createdAt, 64),
    updatedAt: text(record?.updatedAt, 64),
  };
}

export function projectInternalLearningRecord(record: any): InternalLearningRead {
  return {
    id: id(record?.id),
    entityType: text(record?.entityType, 64),
    entityId: text(record?.entityId, 128),
    eventType: text(record?.eventType, 128),
    outcome: text(record?.outcome, 256),
    scoreDelta: number(record?.scoreDelta),
    hasNotes: Boolean(text(record?.notes, 1)),
    reviewOnly: true,
    executable: false,
    deliverable: false,
    authoritativeForExecution: false,
    detailsRedacted: true,
    createdAt: text(record?.createdAt, 64),
  };
}
