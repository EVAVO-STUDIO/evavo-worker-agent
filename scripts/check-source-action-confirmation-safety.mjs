#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const read = (relativePath) => {
  const absolute = path.join(root, relativePath);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf8") : "";
};

const index = read("src/index.ts");
const sources = read("src/routes/sourcesAdmin.ts");
const sourceBatch = read("src/routes/sourceBatchAdmin.ts");
const packageJson = JSON.parse(read("package.json") || "{}");

for (const [name, content] of [["Worker dispatcher", index], ["sources handler", sources], ["source batch handler", sourceBatch]]) {
  if (!content) errors.push(`Missing ${name}`);
}

for (const token of [
  "function sourceActionRequiresConfirmation(pathname: string, method: string): boolean",
  'method !== "POST"',
  'pathname === "/admin/sources"',
  'pathname === "/admin/seeds"',
  'pathname === "/admin/sources/run-tiny"',
  "test|expand-preview|expand-commit|cooldown|retire|activate",
  "async function sourceActionConfirmationFailure(request: Request, pathname: string)",
  "request.clone().json()",
  'url.searchParams.get("confirm") === "1"',
  "body?.confirm === true",
  'error: "confirm_required"',
  "Source writes and bounded source-network actions require explicit confirmation",
  "const sourceConfirmationFailure = await sourceActionConfirmationFailure(req, pathname)",
  "if (sourceConfirmationFailure) return sourceConfirmationFailure",
]) {
  if (!index.includes(token)) errors.push(`Source confirmation boundary is missing: ${token}`);
}

const authPosition = index.indexOf("if (protectedRoute && !(await isAdminRequestAuthorized(req, env)))");
const confirmationPosition = index.indexOf("const sourceConfirmationFailure = await sourceActionConfirmationFailure(req, pathname)");
const opportunityRoutingPosition = index.indexOf("switch (resolveOpportunityRouteHandlerId(pathname))");
const operationsRoutingPosition = index.indexOf("switch (resolveOperationsRouteHandlerId(pathname))");
if (authPosition < 0 || confirmationPosition < 0 || opportunityRoutingPosition < 0 || operationsRoutingPosition < 0) {
  errors.push("Could not locate authentication, source confirmation, and routing boundaries");
} else if (!(authPosition < confirmationPosition && confirmationPosition < opportunityRoutingPosition && confirmationPosition < operationsRoutingPosition)) {
  errors.push("Source confirmation must run after authentication and before all protected route dispatch");
}

for (const token of [
  'body?.confirm !== true && body?.confirm !== 1 && body?.confirm !== "1"',
  'error: "confirm_required"',
]) {
  if (!sources.includes(token)) errors.push(`Sources handler must retain confirmed expansion commit guard: ${token}`);
}

for (const token of [
  'body?.confirm !== true && body?.confirm !== 1 && body?.confirm !== "1"',
  'error: "confirm_required"',
]) {
  if (!sourceBatch.includes(token)) errors.push(`Source batch handler must retain confirmation guard: ${token}`);
}

for (const forbidden of [
  'request.method === "POST") return await handleSourcesAdmin',
  "sourceActionConfirmationFailure(req, pathname).catch",
  "confirm_required_override",
]) {
  if (index.includes(forbidden)) errors.push(`Worker dispatcher contains forbidden source confirmation bypass: ${forbidden}`);
}

const expectedCommand = "node scripts/check-source-action-confirmation-safety.mjs";
if (packageJson.scripts?.["sources:confirmation-safety:check"] !== expectedCommand) {
  errors.push(`package.json must expose sources:confirmation-safety:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run sources:confirmation-safety:check")) {
  errors.push("check:local must include sources:confirmation-safety:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "source-action-confirmation-boundary",
  protectedActions: [
    "source-add",
    "source-test",
    "source-expand-preview",
    "source-expand-commit",
    "source-cooldown",
    "source-retire",
    "source-activate",
    "source-run-tiny",
  ],
  authenticationBeforeConfirmation: true,
  confirmationBeforeRouting: true,
  requestBodyPreservedWithClone: true,
  handlerLevelConfirmationRetainedForCommitAndBatch: true,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
