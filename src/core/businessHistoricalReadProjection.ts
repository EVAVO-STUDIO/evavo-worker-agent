const historicalContentRedaction = "[historical content redacted]";

function textPresent(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function objectPresent(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && Object.keys(value as Record<string, unknown>).length > 0);
}

function historicalPosture() {
  return {
    historicalOnly: true,
    reviewOnly: true,
    executable: false,
    deliverable: false,
    authoritativeForExecution: false,
    statusAuthoritative: false,
    externalExecutionAllowed: false,
  } as const;
}

export function projectHistoricalBusinessDraft(record: Record<string, unknown>) {
  const subjectPresent = textPresent(record.subject);
  const bodyPresent = textPresent(record.body);
  const payloadPresent = objectPresent(record.payload);

  return {
    id: record.id ?? null,
    organizationId: record.organizationId ?? null,
    personId: record.personId ?? null,
    opportunityId: record.opportunityId ?? null,
    auditPackId: record.auditPackId ?? null,
    draftType: record.draftType ?? null,
    channel: record.channel ?? null,
    subject: subjectPresent ? historicalContentRedaction : null,
    body: bodyPresent ? historicalContentRedaction : null,
    payload: payloadPresent ? { redacted: true } : {},
    riskFlags: Array.isArray(record.riskFlags) ? record.riskFlags : [],
    complianceStatus: record.complianceStatus ?? null,
    approvalStatus: record.approvalStatus ?? null,
    status: record.status ?? null,
    metadata: record.metadata && typeof record.metadata === "object" ? record.metadata : {},
    createdAt: record.createdAt ?? null,
    updatedAt: record.updatedAt ?? null,
    historicalContentRedacted: subjectPresent || bodyPresent || payloadPresent,
    legacySubjectPresent: subjectPresent,
    legacyBodyPresent: bodyPresent,
    legacyPayloadPresent: payloadPresent,
    ...historicalPosture(),
  };
}

export function projectHistoricalBusinessApproval(record: Record<string, unknown>) {
  const checklistPresent = Array.isArray(record.reviewChecklist) && record.reviewChecklist.length > 0;
  const reasonPresent = textPresent(record.approvalReason);
  const identityPresent = textPresent(record.approvedBy) || textPresent(record.approvedAt);
  const metadataPresent = objectPresent(record.metadata);

  return {
    id: record.id ?? null,
    actionDraftId: record.actionDraftId ?? null,
    requestType: record.requestType ?? null,
    status: record.status ?? null,
    reviewChecklist: checklistPresent ? [historicalContentRedaction] : [],
    riskFlags: Array.isArray(record.riskFlags) ? record.riskFlags : [],
    approvalReason: reasonPresent ? historicalContentRedaction : null,
    expiresAt: record.expiresAt ?? null,
    metadata: metadataPresent ? { redacted: true } : {},
    createdAt: record.createdAt ?? null,
    updatedAt: record.updatedAt ?? null,
    approvedBy: null,
    approvedAt: null,
    historicalContentRedacted: checklistPresent || reasonPresent || metadataPresent,
    historicalIdentityRedacted: identityPresent,
    legacyReviewChecklistPresent: checklistPresent,
    legacyApprovalReasonPresent: reasonPresent,
    legacyMetadataPresent: metadataPresent,
    ...historicalPosture(),
  };
}
