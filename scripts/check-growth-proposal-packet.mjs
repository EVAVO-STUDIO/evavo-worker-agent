import fs from "node:fs";
import path from "node:path";

const CHECK_NAME = "check-growth-proposal-packet";
const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const errors = [];

function requireTokens(label, content, tokens) {
  for (const token of tokens) {
    if (!content.includes(token)) errors.push(`${label} is missing: ${token}`);
  }
}

function forbidTokens(label, content, tokens) {
  for (const token of tokens) {
    if (content.includes(token)) errors.push(`${label} contains forbidden token: ${token}`);
  }
}

const source = read("src/core/growthProposalPacket.ts");
const fixtureText = read("fixtures/growth-worker-proposal-v1.json");
const documentation = read("docs/growth-proposal-packet.md");
const dispatcher = read("src/index.ts");
let fixture;
try {
  fixture = JSON.parse(fixtureText);
} catch {
  errors.push("Canonical proposal fixture is not valid JSON.");
  fixture = {};
}

const packetKeys = [
  "contractVersion",
  "sourceSystem",
  "sourceRouteFamily",
  "sourceRecordId",
  "sourceFingerprint",
  "organisationId",
  "workspaceId",
  "candidateKind",
  "candidateTitle",
  "candidateSummary",
  "evidenceItems",
  "confidence",
  "proposedAction",
  "doNothingRationale",
  "riskNotes",
  "idempotencyKey",
  "createdAt",
  "proposalMode",
  "externalExecutionRequested",
  "canonicalPromotionRequested",
];
const evidenceKeys = [
  "evidenceKind",
  "title",
  "summary",
  "sourceUrl",
  "sourceLabel",
  "capturedAt",
  "confidence",
];

requireTokens("Growth proposal packet builder", source, [
  "GROWTH_PROPOSAL_CONTRACT_VERSION = \"growth_worker_proposal_v1\"",
  "GROWTH_PROPOSAL_SOURCE_SYSTEM = \"evavo-worker-agent\"",
  "GROWTH_PROPOSAL_MODE = \"proposal_only\"",
  "GROWTH_PROPOSAL_ROUTE_FAMILIES",
  "GROWTH_PROPOSAL_KINDS",
  "GROWTH_PROPOSAL_EVIDENCE_KINDS",
  "packetBytes: 48_000",
  "evidenceItems: 12",
  "candidateSummary: 2_000",
  "evidenceSummary: 1_500",
  "sourceUrl: 2_048",
  "maximumAgeMs: 30 * 24 * 60 * 60 * 1_000",
  "maximumFutureSkewMs: 5 * 60 * 1_000",
  "const SAFE_IDENTIFIER_PATTERN = /^[a-z0-9](?:[a-z0-9:._-]{14,158}[a-z0-9])$/i",
  "text.includes(\"..\")",
  "SAFE_ACTION_PREFIXES",
  "EXTERNAL_ACTION_PATTERNS",
  "GROWTH_PROPOSAL_EXTERNAL_ACTION_INVALID",
  "GROWTH_PROPOSAL_PACKET_TOO_LARGE",
  "GROWTH_PROPOSAL_EVIDENCE_COUNT_INVALID",
  "GROWTH_PROPOSAL_EVIDENCE_SOURCE_REQUIRED",
  "GROWTH_PROPOSAL_URL_INVALID",
  "export function buildGrowthProposalPacket",
  "contractVersion: GROWTH_PROPOSAL_CONTRACT_VERSION",
  "sourceSystem: GROWTH_PROPOSAL_SOURCE_SYSTEM",
  "proposalMode: GROWTH_PROPOSAL_MODE",
  "externalExecutionRequested: false as const",
  "canonicalPromotionRequested: false as const",
  "new TextEncoder().encode(JSON.stringify(packet)).byteLength",
  "export function serialiseGrowthProposalPacket",
  "JSON.stringify(packet, null, 2)",
]);

requireTokens("Growth proposal packet documentation", documentation, [
  "Growth Worker proposal packet",
  "growth_worker_proposal_v1",
  "src/core/growthProposalPacket.ts",
  "fixtures/growth-worker-proposal-v1.json",
  "proposalMode: proposal_only",
  "externalExecutionRequested: false",
  "canonicalPromotionRequested: false",
  "The producer is pure.",
  "Packet size is capped at 48,000 UTF-8 bytes.",
  "slash, traversal-like `..` segments and trailing punctuation are rejected",
  "Send, post, publish, submit, provider-write, delete, export, campaign-launch and charging language fails closed.",
  "server-to-server, signed with a dedicated bridge credential, replay-protected, proposal-only, idempotent and audited",
]);

const actualPacketKeys = Object.keys(fixture).sort();
const expectedPacketKeys = [...packetKeys].sort();
if (actualPacketKeys.length !== expectedPacketKeys.length || actualPacketKeys.some((key, index) => key !== expectedPacketKeys[index])) {
  errors.push("Canonical proposal fixture has the wrong top-level field set.");
}
if (!Array.isArray(fixture.evidenceItems) || fixture.evidenceItems.length < 1 || fixture.evidenceItems.length > 12) {
  errors.push("Canonical proposal fixture evidence count is invalid.");
} else {
  for (const [index, evidence] of fixture.evidenceItems.entries()) {
    const actualEvidenceKeys = Object.keys(evidence).sort();
    const expectedEvidenceKeys = [...evidenceKeys].sort();
    if (actualEvidenceKeys.length !== expectedEvidenceKeys.length || actualEvidenceKeys.some((key, keyIndex) => key !== expectedEvidenceKeys[keyIndex])) {
      errors.push(`Canonical proposal fixture evidence ${index} has the wrong field set.`);
    }
  }
}

for (const [label, actual, expected] of [
  ["contract version", fixture.contractVersion, "growth_worker_proposal_v1"],
  ["source system", fixture.sourceSystem, "evavo-worker-agent"],
  ["proposal mode", fixture.proposalMode, "proposal_only"],
  ["external execution", fixture.externalExecutionRequested, false],
  ["canonical promotion", fixture.canonicalPromotionRequested, false],
]) {
  if (actual !== expected) errors.push(`Canonical proposal fixture ${label} is invalid.`);
}

const identifierPattern = /^[a-z0-9](?:[a-z0-9:._-]{14,158}[a-z0-9])$/i;
for (const [field, value] of [
  ["sourceFingerprint", fixture.sourceFingerprint],
  ["idempotencyKey", fixture.idempotencyKey],
]) {
  if (typeof value !== "string" || !identifierPattern.test(value) || value.includes("..") || value.includes("/")) {
    errors.push(`Canonical proposal fixture ${field} is not an opaque identifier.`);
  }
}
if (typeof fixture.confidence !== "number" || !Number.isFinite(fixture.confidence) || fixture.confidence < 0 || fixture.confidence > 1) {
  errors.push("Canonical proposal fixture confidence is invalid.");
}
if (typeof fixture.proposedAction !== "string" || !fixture.proposedAction.startsWith("Prepare ")) {
  errors.push("Canonical proposal fixture action is not preparatory.");
}
for (const pattern of [
  /\bsend\b/i,
  /\bpost\b/i,
  /\bpublish\b/i,
  /\bsubmit\b/i,
  /\bdelete\b/i,
  /\bexport\b/i,
  /\bwrite\s*back\b/i,
  /\bupdate\s+(?:hubspot|salesforce|pipedrive|zoho|provider)\b/i,
]) {
  if (pattern.test(String(fixture.proposedAction))) errors.push(`Canonical proposal fixture contains unsafe action language: ${pattern}`);
}
if (new TextEncoder().encode(JSON.stringify(fixture)).byteLength > 48_000) {
  errors.push("Canonical proposal fixture exceeds the packet byte limit.");
}
if (`${JSON.stringify(fixture, null, 2)}\n` !== fixtureText) {
  errors.push("Canonical proposal fixture is not canonical two-space JSON with a trailing newline.");
}

let lastIndex = -1;
for (const key of packetKeys) {
  const index = source.indexOf(`${key}:`, lastIndex + 1);
  if (index === -1 || index <= lastIndex) {
    errors.push(`Growth proposal builder does not emit ${key} in canonical field order.`);
    break;
  }
  lastIndex = index;
}

forbidTokens("Growth proposal packet builder", source, [
  "fetch(",
  "process.env",
  "ADMIN_TOKEN",
  "D1Database",
  "env.DB",
  "scheduled(",
  "ctx.waitUntil",
  "canSendEmail: true",
  "externalExecutionRequested: true",
  "canonicalPromotionRequested: true",
]);
forbidTokens("Worker dispatcher", dispatcher, [
  "buildGrowthProposalPacket",
  "serialiseGrowthProposalPacket",
  "growth-worker-proposal-v1.json",
]);

if (errors.length) {
  console.error(`${CHECK_NAME} failed:\n`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Growth proposal packet producer check passed.");
console.log("- Worker builder emits exact growth_worker_proposal_v1 canonical field order and mirrored fixture JSON");
console.log("- packet, evidence, tenant, identifier, URL, timestamp, confidence and action limits fail closed");
console.log("- proposal-only, no-execution and no-promotion flags are fixed by the producer");
console.log("- builder performs no network, D1, scheduled, credential or dispatcher operation");
console.log("- future transport remains a separate signed, replay-protected, server-to-server contract");
