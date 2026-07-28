export const BUSINESS_READ_PROJECTION_CONTRACT =
  "business_read_projection_v1" as const;

type BusinessReadRecord = Record<string, unknown>;

export type BusinessReadProjectionOptions = Readonly<{
  redactContactDetails?: boolean;
}>;

const CONTACT_FIELDS = Object.freeze([
  "email",
  "phone",
  "profileUrl",
  "sourceUrl",
] as const);

function hasOwn(record: BusinessReadRecord, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, field);
}

function existingBoolean(
  record: BusinessReadRecord,
  field: string,
): boolean | undefined {
  return typeof record[field] === "boolean"
    ? record[field] as boolean
    : undefined;
}

function populatedText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function populatedObject(value: unknown): boolean {
  return Boolean(
    value
      && typeof value === "object"
      && !Array.isArray(value)
      && Object.keys(value as object).length > 0,
  );
}

export function projectBusinessReadRecord<T extends BusinessReadRecord>(
  record: T,
  options: BusinessReadProjectionOptions = {},
): Readonly<T & BusinessReadRecord> {
  const projected: BusinessReadRecord = {};
  const redactContactDetails = options.redactContactDetails === true;

  for (const [field, value] of Object.entries(record)) {
    if (field === "metadata" || field === "requestedBy") continue;
    if (
      redactContactDetails
      && CONTACT_FIELDS.includes(field as (typeof CONTACT_FIELDS)[number])
    ) {
      continue;
    }
    projected[field] = value;
  }

  if (hasOwn(record, "metadata")) {
    projected.metadataPresent = existingBoolean(record, "metadataPresent")
      ?? populatedObject(record.metadata);
    projected.metadataRedacted = true;
  }

  if (hasOwn(record, "requestedBy")) {
    projected.requestedByPresent = existingBoolean(record, "requestedByPresent")
      ?? populatedText(record.requestedBy);
    projected.requesterIdentityRedacted = true;
  }

  if (redactContactDetails) {
    for (const field of CONTACT_FIELDS) {
      const presenceField = `${field}Present`;
      projected[field] = null;
      projected[presenceField] = existingBoolean(record, presenceField)
        ?? populatedText(record[field]);
    }
    projected.contactDetailsRedacted = true;
  }

  return Object.freeze(projected) as Readonly<T & BusinessReadRecord>;
}

export function projectBusinessReadCollection<T extends BusinessReadRecord>(
  records: readonly T[],
  options: BusinessReadProjectionOptions = {},
): Array<Readonly<T & BusinessReadRecord>> {
  return records.map((record) => projectBusinessReadRecord(record, options));
}
