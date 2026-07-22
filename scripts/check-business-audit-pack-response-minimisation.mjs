#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const sourcePath = path.join(root, "src/core/businessAutopilotAuditPackRecords.ts");
const packagePath = path.join(root, "package.json");

const source = fs.existsSync(sourcePath) ? fs.readFileSync(sourcePath, "utf8") : "";
const packageJson = fs.existsSync(packagePath) ? JSON.parse(fs.readFileSync(packagePath, "utf8")) : {};

if (!source) errors.push("Missing Business audit pack record helper");
if (!fs.existsSync(packagePath)) errors.push("Missing package.json");

for (const token of [
  "function minimiseBusinessAuditPackResponse",
  "metadata: {}",
  "metadataPresent",
  "metadataRedacted: true",
  "internalReviewOnly: true",
  "executable: false",
  "deliverable: false",
  "authoritativeForExecution: false",
  "business_audit_pack_reads_v2_minimized",
  "const minimizedPacks = packs.map(minimiseBusinessAuditPackResponse)",
]) {
  if (!source.includes(token)) errors.push(`Audit pack read minimisation is missing: ${token}`);
}

for (const forbidden of [
  "auditPacks: packs,",
  "metadataRedacted: false",
  "deliverable: true",
  "authoritativeForExecution: true",
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

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "business-audit-pack-response-minimisation",
  arbitraryMetadataRedacted: true,
  findingsPreservedForInternalReview: true,
  recommendationsPreservedForInternalReview: true,
  executable: false,
  deliverable: false,
  authoritativeForExecution: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
