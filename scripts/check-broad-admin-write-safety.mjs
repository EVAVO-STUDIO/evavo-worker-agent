#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const wrapperPath = path.join(root, "src", "routes", "adminProtected.ts");
const indexPath = path.join(root, "src", "index.ts");
const implementationPath = path.join(root, "src", "routes", "admin.ts");
const packagePath = path.join(root, "package.json");

const read = (filePath) => fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
const wrapper = read(wrapperPath);
const index = read(indexPath);
const implementation = read(implementationPath);
const packageJson = JSON.parse(read(packagePath) || "{}");

if (!wrapper) errors.push("Missing protected broad admin wrapper");
if (!index) errors.push("Missing Worker dispatcher");
if (!implementation) errors.push("Missing broad admin implementation");

for (const token of [
  'import { isAdminRequestAuthorized } from "../core/adminAuthentication"',
  'import { handleAdmin as handleAdminImplementation } from "./admin"',
  "await isAdminRequestAuthorized(request, env)",
  'request.method === "OPTIONS"',
  'pathname === "/admin/leads" && request.method === "POST"',
  "const body = await request.clone().json()",
  "if (!confirmed(body))",
  'error: "confirm_required"',
  "internalMetadataOnly: true",
  "scheduled: false",
  "callsNetwork: false",
  "callsAI: false",
  "sendsEmail: false",
  "postsExternally: false",
  "submitsForms: false",
  "externalStateChange: false",
  "return handleAdminImplementation(request, env, pathname, ctx, json)",
]) {
  if (!wrapper.includes(token)) errors.push(`Protected broad admin wrapper is missing: ${token}`);
}

const authPosition = wrapper.indexOf("await isAdminRequestAuthorized(request, env)");
const optionsPosition = wrapper.indexOf('request.method === "OPTIONS"');
const bodyPosition = wrapper.indexOf("const body = await request.clone().json()");
const confirmPosition = wrapper.indexOf("if (!confirmed(body))");
const delegatePosition = wrapper.indexOf("return handleAdminImplementation(request, env, pathname, ctx, json)");
if (!(authPosition >= 0 && optionsPosition > authPosition && bodyPosition > optionsPosition && confirmPosition > bodyPosition && delegatePosition > confirmPosition)) {
  errors.push("Broad admin wrapper must authenticate before OPTIONS and confirm manual record insertion before delegation");
}

for (const token of [
  'import { handleAdmin } from "./routes/adminProtected"',
  "return await handleAdmin(req, env, pathname, ctx, jsonResponse)",
]) {
  if (!index.includes(token)) errors.push(`Worker dispatcher is missing protected broad admin routing token: ${token}`);
}
if (index.includes('from "./routes/admin"')) errors.push("Worker dispatcher must not import the broad admin implementation directly");

for (const unsafe of [
  "runOpportunityAutonomy(",
  "runSourceExpansion(",
  "runDraftOnce(",
  "runSendApproved(",
  "sendEmail(",
]) {
  if (wrapper.includes(unsafe) || implementation.includes(unsafe)) {
    errors.push(`Broad admin surface must not invoke external execution helper: ${unsafe}`);
  }
}

const expectedCommand = "node scripts/check-broad-admin-write-safety.mjs";
if (packageJson.scripts?.["admin:broad-write-safety:check"] !== expectedCommand) {
  errors.push(`package.json must expose admin:broad-write-safety:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run admin:broad-write-safety:check")) {
  errors.push("check:local must include admin:broad-write-safety:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "protected-broad-admin-write-safety",
  dispatcherUsesProtectedWrapper: true,
  directImplementationImportAllowed: false,
  manualRecordInsertionRequiresConfirmation: true,
  internalMetadataOnly: true,
  scheduledExecutionAllowed: false,
  externalNetworkAllowed: false,
  aiAllowed: false,
  sendingAllowed: false,
  externalStateChangeAllowed: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
