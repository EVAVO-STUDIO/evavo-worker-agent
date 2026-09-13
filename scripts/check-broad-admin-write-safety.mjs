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
  'boundedJsonFailurePayload,',
  'isExplicitJsonConfirmation,',
  'readBoundedJsonObject,',
  'import { handleAdmin as handleAdminImplementation } from "./admin"',
  'function manualMetadataWriteRequiresConfirmation(pathname: string, method: string): boolean',
  'pathname === "/admin/leads" || pathname === "/admin/seeds"',
  "await isAdminRequestAuthorized(request, env)",
  'request.method === "OPTIONS"',
  "if (manualMetadataWriteRequiresConfirmation(pathname, request.method))",
  "const parsed = await readBoundedJsonObject(request.clone(), {",
  "maxBytes: 65_536",
  "maxDepth: 6",
  "maxNodes: 600",
  "maxArrayLength: 100",
  "maxStringLength: 2_048",
  "maxKeyLength: 96",
  "if (!parsed.ok) return json(boundedJsonFailurePayload(parsed), { status: parsed.status })",
  "if (!isExplicitJsonConfirmation(parsed.value))",
  'error: "confirm_required"',
  "confirmationCoercionAllowed: false",
  "requestReceipt:",
  "bodySha256: parsed.bodySha256",
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

for (const unsafe of [
  "const body = await request.clone().json()",
  "if (!confirmed(body))",
  'body?.confirm === "1"',
  "body?.confirm === 1",
]) {
  if (wrapper.includes(unsafe)) errors.push(`Protected broad admin wrapper contains stale unsafe confirmation path: ${unsafe}`);
}

const authPosition = wrapper.indexOf("await isAdminRequestAuthorized(request, env)");
const optionsPosition = wrapper.indexOf('request.method === "OPTIONS"');
const predicatePosition = wrapper.indexOf("manualMetadataWriteRequiresConfirmation(pathname, request.method)");
const boundedBodyPosition = wrapper.indexOf("readBoundedJsonObject(request.clone(), {");
const boundedFailurePosition = wrapper.indexOf("boundedJsonFailurePayload(parsed)");
const confirmPosition = wrapper.indexOf("isExplicitJsonConfirmation(parsed.value)");
const delegatePosition = wrapper.indexOf("return handleAdminImplementation(request, env, pathname, ctx, json)");
if (!(
  authPosition >= 0 &&
  optionsPosition > authPosition &&
  predicatePosition > optionsPosition &&
  boundedBodyPosition > predicatePosition &&
  boundedFailurePosition > boundedBodyPosition &&
  confirmPosition > boundedFailurePosition &&
  delegatePosition > confirmPosition
)) {
  errors.push("Broad admin wrapper must authenticate before OPTIONS, then perform bounded parsing and exact confirmation before delegation");
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
  contract: "protected-broad-admin-write-safety-v2-bounded-json-confirmation",
  dispatcherUsesProtectedWrapper: true,
  directImplementationImportAllowed: false,
  manualRecordInsertionRequiresConfirmation: true,
  boundedJsonRequiredBeforeDelegation: true,
  exactBooleanConfirmationRequired: true,
  confirmationCoercionAllowed: false,
  internalMetadataOnly: true,
  scheduledExecutionAllowed: false,
  externalNetworkAllowed: false,
  aiAllowed: false,
  sendingAllowed: false,
  externalStateChangeAllowed: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
