export const BUSINESS_RELATIONSHIP_CHANGE_DIGEST_CONTRACT = "business_relationship_change_digest_v1" as const;

export type RelationshipChange = Readonly<{
  id: string;
  occurredAt: string;
  domain: "identity" | "communication" | "obligation" | "project" | "commercial" | "support" | "document" | "decision" | "calendar" | "other";
  changeType: "created" | "updated" | "resolved" | "superseded" | "cancelled" | "risk_increased" | "risk_reduced" | "authority_changed";
  summary: string;
  material: boolean;
  sourceRefs: readonly string[];
}>;

export type RelationshipChangeDigest = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_CHANGE_DIGEST_CONTRACT;
  relationshipId: string;
  since: string;
  through: string;
  materialChanges: readonly RelationshipChange[];
  nonMaterialChanges: readonly RelationshipChange[];
  latestMaterialChangeAt: string | null;
  summary: string;
  evidenceRefs: readonly string[];
}>;

function iso(value: string, field: string): string {
  const d = new Date(value);
  if (!value || Number.isNaN(d.getTime())) throw new Error(`RELATIONSHIP_CHANGE_${field.toUpperCase()}_INVALID`);
  return d.toISOString();
}

export function buildRelationshipChangeDigest(input: Readonly<{
  relationshipId: string;
  since: string;
  through: string;
  changes: readonly RelationshipChange[];
}>): RelationshipChangeDigest {
  if (!input.relationshipId.trim()) throw new Error("RELATIONSHIP_CHANGE_RELATIONSHIP_REQUIRED");
  const since = iso(input.since, "since");
  const through = iso(input.through, "through");
  if (since >= through) throw new Error("RELATIONSHIP_CHANGE_WINDOW_INVALID");

  const inWindow = input.changes
    .map((change) => ({ ...change, occurredAt: iso(change.occurredAt, "occurred_at") }))
    .filter((change) => change.occurredAt > since && change.occurredAt <= through)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  const materialChanges = inWindow.filter((change) => change.material);
  const nonMaterialChanges = inWindow.filter((change) => !change.material);
  const latestMaterialChangeAt = materialChanges.at(-1)?.occurredAt ?? null;
  const evidenceRefs = [...new Set(inWindow.flatMap((change) => change.sourceRefs))];
  const summary = materialChanges.length
    ? materialChanges.map((change) => `${change.domain}: ${change.summary}`).join(" | ")
    : "No material relationship changes occurred in the requested window.";

  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_CHANGE_DIGEST_CONTRACT,
    relationshipId: input.relationshipId,
    since,
    through,
    materialChanges: Object.freeze(materialChanges),
    nonMaterialChanges: Object.freeze(nonMaterialChanges),
    latestMaterialChangeAt,
    summary,
    evidenceRefs: Object.freeze(evidenceRefs),
  });
}
