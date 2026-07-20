#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const readmePath = path.join(root, "README.md");
const packagePath = path.join(root, "package.json");
const errors = [];

const readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, "utf8") : "";
const packageJson = fs.existsSync(packagePath) ? JSON.parse(fs.readFileSync(packagePath, "utf8")) : {};

if (!readme) errors.push("Missing README.md");

for (const token of [
  "# EVAVO Growth Research Worker",
  "It does **not** provide outbound execution.",
  "Scheduled work is internal-only",
  "Scheduled work cannot fetch public sources, expand source candidates, discover opportunities, generate drafts or perform external actions.",
  "Public-source research is manual-only, authenticated, explicitly confirmed, bounded and review-only.",
  "Allowed network activity is read-only public research through explicitly classified, authenticated, confirmation-gated and bounded manual source or opportunity handlers.",
  "run from the scheduled entrypoint",
  "an internal-only Worker schedule",
  "bounded manual public-research capacity",
  "Keep every scheduled external and outbound action disabled.",
]) {
  if (!readme.includes(token)) errors.push(`README operating posture is missing: ${token}`);
}

for (const forbidden of [
  "Scheduled work is limited to bounded research",
  "scheduled bounded research",
  "scheduled public-source research",
  "automated outbound execution",
  "email sending is enabled",
  "draft generation is enabled",
  "external state mutation is enabled",
]) {
  if (readme.toLowerCase().includes(forbidden.toLowerCase())) {
    errors.push(`README contains stale or unsafe posture claim: ${forbidden}`);
  }
}

const expectedCommand = "node scripts/check-readme-operating-posture.mjs";
if (packageJson.scripts?.["docs:operating-posture:check"] !== expectedCommand) {
  errors.push(`package.json must expose docs:operating-posture:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run docs:operating-posture:check")) {
  errors.push("check:local must include docs:operating-posture:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "readme-operating-posture",
  scheduledExternalResearchDocumentedAsDisabled: true,
  manualResearchAuthenticationDocumented: true,
  manualResearchConfirmationDocumented: true,
  manualResearchBoundedDocumented: true,
  manualResearchReviewOnlyDocumented: true,
  outboundExecutionDocumentedAsDisabled: true,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
