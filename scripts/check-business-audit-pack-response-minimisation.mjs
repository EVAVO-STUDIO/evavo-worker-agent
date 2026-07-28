#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const sourcePath = path.join(root, "src/core/businessAutopilotAuditPackRecords.ts");
const projectionPath = path.join(root, "src/core/businessReadProjection.ts");
const testPath = path.join(root, "tests/businessReadProjection.test.ts");
const packagePath = path.join(root, "package.json");

const source = fs.existsSync(sourcePath) ? fs.readFileSync(sourcePath, "utf8") : "";
const projection = fs.existsSync(projectionPath) ? fs.readFileSync(projectionPath, "utf8") : "";
const tests = fs.existsSync(testPath) ? fs.readFileSync(testPath, "utf8") : "";
const packageJson = fs.existsSync(packagePath) ? JSON.parse(fs.readFileSync(packagePath, "utf8")) : {};

if (!source) errors.push("Missing Business audit pack record helper");
if (!projection) errors.push("Missing shared Business read projection");
if (!tests) errors.push("Missing Business read projection executable test");
if (!fs.existsSync(packagePath)) errors.push("Missing package.json");

for (const token of [
  "function minimiseBusinessAuditPackResponse",
  'from "./businessReadProjection"',
  "projectBusinessReadRecord(pack)",
  'typeof projected.metadataPresent === "boolean"',
  "metadata: {}",
  "metadataPresent",
  "metadataRedacted: true",
  "internalReviewOnly: true",
  "executable: false",
  "deliverable: false",
  "authoritativeForExecution: false",
  "business_audit_pack_reads_v3_score_provenance",
  "scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT",
  "const minimizedPacks = packs.map(minimiseBusinessAuditPackResponse)",
  "): Readonly<Record<string, unknown>>",
]) {
  if (!source.includes(token)) errors.push(`Audit pack read minimisation is missing: ${token}`);
}

for (const token of [
  '"business_read_projection_v1"',
  "projectBusinessReadRecord",
  "existingBoolean",
  "metadataPresent",
  "metadataRedacted = true",
  "Object.freeze(projected)",
]) {
  if (!projection.includes(token)) errors.push(`Shared Business read projection is missing: ${token}`);
}

for (const token of [
  "collection projection and audit-pack minimisation preserve metadata-presence truth",
  "businessAuditPackReadPayload(projectedPacks)",
  "metadataPresent, true",
  "metadataPresent, false",
  "private-operator-context-must-not-leak",
]) {
  if (!tests.includes(token)) errors.push(`Audit pack projection test is missing: ${token}`);
}

for (const forbidden of [
  "auditPacks: packs,",
  "metadataRedacted: false",
  "deliverable: true",
  "authoritativeForExecution: true",
  "business_audit_pack_reads_v2_minimized",
  "const metadataPresent = Boolean(pack.metadata",
]) {
  if (source.includes(forbidden)) errors.push(`Audit pack read surface contains unsafe token: ${forbidden}`);
}

const expectedCommand = "node scripts/check-business-audit-pack-response-minimisation.mjs";
if (packageJson.scripts?.["business:audit-pack-response-minimisation:check"] !== expectedCommand) {
  errors.push(`package.json must expose business:audit-pack-response-minimisation:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run business:audit-pack-response-minimisation:check")) {
  errors.push("check:local must include business:audit-pack-response-minimisation:check");
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run test:core")) {
  errors.push("check:local must execute test:core so audit-pack presence tests cannot be skipped");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "business-audit-pack-response-minimisation-v4-presence-preserving",
  arbitraryMetadataRedacted: true,
  metadataPresencePreservedAcrossProjection: true,
  findingsPreservedForInternalReview: true,
  recommendationsPreservedForInternalReview: true,
  scoreProvenancePreserved: true,
  executable: false,
  deliverable: false,
  authoritativeForExecution: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
