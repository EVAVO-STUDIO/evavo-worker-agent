import { businessAutopilotMetadataWriteSafety } from './businessAutopilotSafety';

const allowedScopeTypes = new Set([
  'organization',
  'domain',
  'person',
  'email',
  'channel',
  'campaign',
  'source',
]);

const allowedReasons = new Set([
  'manual_do_not_contact',
  'unsubscribe',
  'bounce',
  'complaint',
  'bad_fit',
  'competitor',
  'existing_client',
  'legal_risk',
  'brand_risk',
  'duplicate',
]);

function nullable(value: unknown, max: number) {
  const cleaned = typeof value === 'string' ? value.trim() : '';
  return cleaned ? cleaned.slice(0, max) : null;
}

function metadata(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function normalizeBusinessSuppressionInput(input: any) {
  const requestedScopeType = nullable(input?.scopeType, 64);
  const requestedReason = nullable(input?.reason, 128);
  const requestedScopeValue = nullable(input?.scopeValue, 512);

  const scopeType = requestedScopeType && allowedScopeTypes.has(requestedScopeType)
    ? requestedScopeType
    : 'organization';
  const reason = requestedReason && allowedReasons.has(requestedReason)
    ? requestedReason
    : 'manual_do_not_contact';

  return {
    id: nullable(input?.id, 128) || undefined,
    scopeType,
    scopeValue: requestedScopeValue || 'unknown',
    reason,
    source: 'operator',
    active: true,
    expiresAt: null,
    metadata: {
      ...metadata(input?.metadata),
      contract: 'business_suppression_integrity_v2',
      requestedScopeType,
      requestedReason,
      requestedActive: typeof input?.active === 'boolean' ? input.active : null,
      requestedExpiresAt: nullable(input?.expiresAt, 64),
      requestedSource: nullable(input?.source, 128),
      forcedActive: true,
      automaticExpiryAllowed: false,
      internalMetadataOnly: true,
      reviewOnly: true,
      executable: false,
      deliverable: false,
      authoritativeForExecution: false,
      externalExecutionAllowed: false,
    },
  };
}

export function markBusinessSuppressionRecord<T extends Record<string, unknown>>(record: T) {
  return {
    ...record,
    contract: 'business_suppression_integrity_v2',
    active: true,
    automaticExpiryAllowed: false,
    internalMetadataOnly: true,
    reviewOnly: true,
    executable: false,
    deliverable: false,
    authoritativeForExecution: false,
    externalExecutionAllowed: false,
    safety: businessAutopilotMetadataWriteSafety(),
  };
}
