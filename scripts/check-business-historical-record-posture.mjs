#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

const files = {
  routePlan: "docs/business-autopilot-draft-review-route-plan.md",
  dataModel: "docs/business-autopilot-data-model.md",
  packageJson: "package.json",
};

const read = (relativePath) => {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
};

const routePlan = read(files.routePlan);
const dataModel = read(files.dataModel);
const packageJson = JSON.parse(read(files.packageJson) || "{}");

for (const token of [
  "Business Autopilot historical review-record plan",
  "It is not an active roadmap for drafting or delivery.",
  "internalMetadataOnly: true",
  "reviewOnly: true",
  "externalExecutionAllowed: false",
  "historicalOnly: true",
  "executable: false",
  "deliverable: false",
  "authoritativeForExecution: false",
  "A stored `approvalStatus`, `requestType` or review checklist never enables another action.",
  "No future implementation is authorised by this document.",
]) {
  if (!routePlan.includes(token)) errors.push(`Historical review route plan is missing: ${token}`);
}

for (const token of [
  "The first implementation is metadata-only.",
  "They do not grant permission",
  "reviewOnly: true",
  "The candidate route does not crawl, fetch, send, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems.",
  "Drafts do not send or execute.",
  "current routes remain metadata-only and do not execute external delivery",
]) {
  if (!dataModel.includes(token)) errors.push(`Business Autopilot data model is missing safety context: ${token}`);
}

for (const forbidden of [
  "This plan documents the intended route glue",
  "## Intended next glue",
  "The safe route implementation should use:",
  "The approval record should use:",
  "When false, it should still save the draft",
]) {
  if (routePlan.includes(forbidden)) errors.push(`Historical review route plan contains active roadmap language: ${forbidden}`);
}

const expectedCommand = "node scripts/check-business-historical-record-posture.mjs";
if (packageJson.scripts?.["business:historical-record-posture:check"] !== expectedCommand) {
  errors.push(`package.json must expose business:historical-record-posture:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run business:historical-record-posture:check")) {
  errors.push("check:local must include business:historical-record-posture:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "business-autopilot-historical-record-posture",
  historicalReviewRecordsNonExecutable: true,
  confirmationDoesNotAuthorizeDelivery: true,
  compatibilityFieldsNonAuthoritative: true,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
