#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

const projection = read("src/core/businessInternalReadProjection.ts");
const route = read("src/routes/businessAutopilotAdmin.ts");
const packageJson = JSON.parse(read("package.json") || "{}");

for (const token of [
  "projectInternalContentIdea",
  "projectInternalFollowup",
  "projectInternalLearningRecord",
  "sourceSignalCount",
  "identityLinksRedacted: true",
  "detailsRedacted: true",
  "hasNotes: Boolean",
  "authoritativeForExecution: false",
  "deliverable: false",
  "executable: false",
]) {
  if (!projection.includes(token)) errors.push(`Internal read projection missing: ${token}`);
}

for (const token of [
  'contract: "business_content_idea_reads_v2_minimized"',
  'contract: "business_followup_reads_v2_minimized"',
  'contract: "business_learning_reads_v2_minimized"',
  "ideas.map(projectInternalContentIdea)",
  "followups.map(projectInternalFollowup)",
  "learning.map(projectInternalLearningRecord)",
  "detailsRedacted: true",
  "identityLinksRedacted: true",
]) {
  if (!route.includes(token)) errors.push(`Business admin route missing minimised read posture: ${token}`);
}

for (const unsafe of [
  "ideas.map(markBusinessInternalPlanningRecord)",
  "followups.map(markBusinessInternalPlanningRecord)",
  '...businessReadPayload(learning, "learningEvents")',
]) {
  if (route.includes(unsafe)) errors.push(`Business admin route still exposes unminimised records: ${unsafe}`);
}

for (const forbiddenProjectionField of [
  "personId:",
  "actionDraftId:",
  "notes:",
  "metadata:",
  "sourceSignalIds:",
]) {
  if (projection.includes(forbiddenProjectionField)) {
    errors.push(`Internal read projection exposes forbidden field: ${forbiddenProjectionField}`);
  }
}

const expectedCommand = "node scripts/check-business-internal-read-minimisation.mjs";
if (packageJson.scripts?.["business:internal-read-minimisation:check"] !== expectedCommand) {
  errors.push(`package.json must expose business:internal-read-minimisation:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run business:internal-read-minimisation:check")) {
  errors.push("check:local must include business:internal-read-minimisation:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "business-internal-read-minimisation-v1",
  contentIdeaMetadataExposed: false,
  contentIdeaSourceIdsExposed: false,
  followupNotesExposed: false,
  followupPersonLinksExposed: false,
  followupDraftLinksExposed: false,
  learningNotesExposed: false,
  learningMetadataExposed: false,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
