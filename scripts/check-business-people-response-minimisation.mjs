#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

const routePath = "src/routes/businessAutopilotPeopleAdmin.ts";
const recordsPath = "src/core/businessAutopilotPeopleRecords.ts";
const docsPath = "docs/business-autopilot-people-routes.md";

const route = read(routePath);
const records = read(recordsPath);
const docs = read(docsPath);

for (const token of [
  "function minimiseBusinessPersonResponse",
  "email: null",
  "phone: null",
  "profileUrl: null",
  "sourceUrl: null",
  "metadata: {}",
  "contactDetailsRedacted: true",
  "metadataRedacted: true",
  "emailPresent",
  "phonePresent",
  "profileUrlPresent",
  "sourceUrlPresent",
  "internalReviewOnly: true",
  "executable: false",
  "deliverable: false",
  "authoritativeForExecution: false",
  "const redactedPeople = people.map(minimiseBusinessPersonResponse)",
  "const redactedPerson = minimiseBusinessPersonResponse(person)",
]) {
  if (!route.includes(token)) errors.push(`${routePath} missing response-minimisation posture: ${token}`);
}

for (const token of [
  "email: row.email",
  "phone: row.phone",
  "profileUrl: row.profile_url",
  "sourceUrl: row.source_url",
  "metadata: parse(row.metadata_json, {})",
  "email: nullable(input.email",
  "phone: nullable(input.phone",
]) {
  if (!records.includes(token)) errors.push(`${recordsPath} must preserve storage compatibility behind the response boundary: ${token}`);
}

for (const token of [
  "Worker HTTP responses apply data minimisation.",
  "Raw contact details and arbitrary metadata are not returned by the people routes.",
  "contactDetailsRedacted: true",
  "metadataRedacted: true",
  "Presence flags indicate only whether a value exists in storage.",
  "A confirmed write stores internal metadata only. Its response is also redacted",
]) {
  if (!docs.includes(token)) errors.push(`${docsPath} missing response-minimisation documentation: ${token}`);
}

for (const unsafe of [
  "return json({ mode: \"business_people\", ...businessPeopleReadPayload(people) })",
  "...businessPersonWritePayload(person)",
]) {
  if (route.includes(unsafe)) errors.push(`${routePath} contains raw contact response path: ${unsafe}`);
}

const packageJson = JSON.parse(read("package.json") || "{}");
const expectedCommand = "node scripts/check-business-people-response-minimisation.mjs";
const scripts = packageJson.scripts || {};
if (scripts["business:people-response-minimisation:check"] !== expectedCommand) {
  errors.push(`package.json must expose business:people-response-minimisation:check as ${expectedCommand}`);
}
if (!String(scripts["check:local"] || "").includes("npm run business:people-response-minimisation:check")) {
  errors.push("check:local must include business:people-response-minimisation:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "business-people-response-minimisation-v1",
  storageCompatibilityPreserved: true,
  rawEmailReturned: false,
  rawPhoneReturned: false,
  rawProfileUrlReturned: false,
  rawSourceUrlReturned: false,
  arbitraryMetadataReturned: false,
  presenceFlagsReturned: true,
  internalReviewOnly: true,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
