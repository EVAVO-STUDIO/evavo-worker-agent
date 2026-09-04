export const BUSINESS_ARTIFACT_RESOLVER_CONTRACT = "business_artifact_resolver_v2" as const;

export type ArtifactCandidate = Readonly<{
  artifactId: string;
  filename: string;
  purpose: string;
  canonicalOwner: "docs_suite" | "operations_core" | "gmail" | "drive" | "operator" | "other";
  version?: string | null;
  contentHash?: string | null;
  current: boolean;
  createdAt?: string | null;
  sourceEvidenceIds: readonly string[];
}>;

export type ArtifactResolution = Readonly<{
  contract: typeof BUSINESS_ARTIFACT_RESOLVER_CONTRACT;
  status: "verified" | "ambiguous" | "unresolved";
  selected?: ArtifactCandidate;
  reasons: readonly string[];
  competingArtifactIds: readonly string[];
}>;

function clean(value: string): string {
  return value.trim().toLowerCase();
}

function required(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`ARTIFACT_${field.toUpperCase()}_REQUIRED`);
  return trimmed;
}

function sourceEvidence(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values.map((value) => value.trim()).filter(Boolean))]);
}

function normalizeSha256(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const unprefixed = trimmed.startsWith("sha256:") ? trimmed.slice("sha256:".length) : trimmed;
  if (!/^[a-f0-9]{64}$/.test(unprefixed)) throw new Error("ARTIFACT_CONTENT_HASH_INVALID");
  return unprefixed;
}

function normalizeCandidate(candidate: ArtifactCandidate): ArtifactCandidate {
  const artifactId = required(candidate.artifactId, "artifact_id");
  const filename = required(candidate.filename, "filename");
  const purpose = required(candidate.purpose, "purpose");
  const evidence = sourceEvidence(candidate.sourceEvidenceIds);
  let createdAt = candidate.createdAt?.trim() || null;
  if (createdAt) {
    const parsed = new Date(createdAt);
    if (Number.isNaN(parsed.getTime())) throw new Error("ARTIFACT_CREATED_AT_INVALID");
    createdAt = parsed.toISOString();
  }
  return Object.freeze({
    ...candidate,
    artifactId,
    filename,
    purpose,
    version: candidate.version?.trim() || null,
    contentHash: candidate.contentHash?.trim() || null,
    createdAt,
    sourceEvidenceIds: evidence,
  });
}

export function resolveBusinessArtifact(input: Readonly<{
  requestedPurpose: string;
  requestedFilename?: string | null;
  expectedArtifactId?: string | null;
  requireCurrent?: boolean;
  candidates: readonly ArtifactCandidate[];
}>): ArtifactResolution {
  const purpose = clean(input.requestedPurpose);
  if (!purpose) throw new Error("ARTIFACT_PURPOSE_REQUIRED");
  const expectedArtifactId = input.expectedArtifactId?.trim() || null;
  const requestedFilename = input.requestedFilename?.trim() || null;
  const candidates = input.candidates.map(normalizeCandidate);
  const ids = new Set<string>();
  for (const candidate of candidates) {
    if (ids.has(candidate.artifactId)) throw new Error(`ARTIFACT_DUPLICATE_ID:${candidate.artifactId}`);
    ids.add(candidate.artifactId);
  }

  const eligible = candidates.filter((candidate) => {
    if (!candidate.sourceEvidenceIds.length) return false;
    if ((input.requireCurrent ?? true) && !candidate.current) return false;
    if (expectedArtifactId && candidate.artifactId !== expectedArtifactId) return false;
    if (requestedFilename && clean(candidate.filename) !== clean(requestedFilename)) return false;
    return clean(candidate.purpose) === purpose;
  });

  if (eligible.length === 1) {
    return Object.freeze({
      contract: BUSINESS_ARTIFACT_RESOLVER_CONTRACT,
      status: "verified",
      selected: eligible[0],
      reasons: Object.freeze(["Exactly one evidence-backed current artifact matches the requested purpose and constraints."]),
      competingArtifactIds: Object.freeze([]),
    });
  }

  if (eligible.length > 1) {
    return Object.freeze({
      contract: BUSINESS_ARTIFACT_RESOLVER_CONTRACT,
      status: "ambiguous",
      reasons: Object.freeze(["Multiple current artifacts match the requested purpose; exact artifact identity or version must be resolved before attachment."]),
      competingArtifactIds: Object.freeze(eligible.map((candidate) => candidate.artifactId)),
    });
  }

  const staleMatches = candidates.filter((candidate) => clean(candidate.purpose) === purpose && candidate.sourceEvidenceIds.length && !candidate.current);
  const reasons = staleMatches.length
    ? ["Only non-current artifact versions match the requested purpose; do not attach a stale version without explicit selection."]
    : ["No evidence-backed artifact matches the requested purpose and constraints."];

  return Object.freeze({
    contract: BUSINESS_ARTIFACT_RESOLVER_CONTRACT,
    status: "unresolved",
    reasons: Object.freeze(reasons),
    competingArtifactIds: Object.freeze(staleMatches.map((candidate) => candidate.artifactId)),
  });
}

export function assertArtifactReadyForSend(resolution: ArtifactResolution): ArtifactCandidate {
  if (resolution.status !== "verified" || !resolution.selected) throw new Error("ARTIFACT_NOT_VERIFIED_FOR_SEND");
  if (!resolution.selected.current) throw new Error("ARTIFACT_NOT_CURRENT");
  const evidence = sourceEvidence(resolution.selected.sourceEvidenceIds);
  if (!evidence.length) throw new Error("ARTIFACT_SOURCE_EVIDENCE_REQUIRED");
  if (!resolution.selected.contentHash) throw new Error("ARTIFACT_CONTENT_HASH_REQUIRED");
  const contentHash = normalizeSha256(resolution.selected.contentHash);
  return Object.freeze({ ...resolution.selected, sourceEvidenceIds: evidence, contentHash });
}
