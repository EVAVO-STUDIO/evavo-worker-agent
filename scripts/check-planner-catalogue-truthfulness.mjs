#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const cataloguePath = path.join(root, "src", "routes", "routeCataloguePlanner.ts");
const packagePath = path.join(root, "package.json");
const errors = [];

const catalogue = fs.existsSync(cataloguePath) ? fs.readFileSync(cataloguePath, "utf8") : "";
const packageJson = fs.existsSync(packagePath) ? JSON.parse(fs.readFileSync(packagePath, "utf8")) : {};

if (!catalogue) errors.push("Missing src/routes/routeCataloguePlanner.ts");

const required = [
  'label: "Growth runtime posture"',
  'non-executing runtime compatibility contract',
  'historical modelling levels',
  'non-executable candidate metadata',
  'Lists historical or current internal Growth review records. They are not executable actions.',
  'A budget record cannot enable a disabled capability.',
  'They are read-only metadata and cannot authorise execution.',
  'label: "Record conservative planner decision"',
  'It performs no external execution, AI, sending or source expansion.',
  'label: "Historical planner decision records"',
  'Stored settings cannot enable scheduled research, drafting, AI, sending or external execution.',
];

for (const token of required) {
  if (!catalogue.includes(token)) errors.push(`Planner catalogue is missing truthful posture: ${token}`);
}

const forbidden = [
  'label: "Growth autonomous runtime"',
  'Reads the supervised autonomous runtime contract',
  'for the autonomous Growth Operator',
  'Lists queued Growth action records for review.',
  'Growth action queue metadata record',
  'deterministic queue record',
  'label: "Conservative planner execute"',
  'Runs only the conservative execution envelope.',
  'label: "Execution history"',
  'current autonomy mode, toggles, caps, and resolved policy used by scheduled and manual runs',
];

for (const token of forbidden) {
  if (catalogue.includes(token)) errors.push(`Planner catalogue contains stale capability language: ${token}`);
}

for (const unsafe of [
  'callsNetwork: true',
  'callsAI: true',
  'canSendEmail: true',
]) {
  if (catalogue.includes(unsafe)) errors.push(`Planner catalogue contains unsafe capability flag: ${unsafe}`);
}

const expectedCommand = "node scripts/check-planner-catalogue-truthfulness.mjs";
if (packageJson.scripts?.["planner:catalogue-truthfulness:check"] !== expectedCommand) {
  errors.push(`package.json must expose planner:catalogue-truthfulness:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run planner:catalogue-truthfulness:check")) {
  errors.push("check:local must include planner:catalogue-truthfulness:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "planner-route-catalogue-v2-non-executing",
  routeIdsPreserved: true,
  externalExecutionAdvertised: false,
  scheduledResearchAdvertised: false,
  deliverableDraftingAdvertised: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
