#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function requireTokens(label, source, tokens) {
  for (const token of tokens) {
    if (!source.includes(token)) errors.push(`${label} missing ${token}`);
  }
}

function forbidTokens(label, source, tokens) {
  for (const token of tokens) {
    if (source.includes(token)) errors.push(`${label} contains forbidden token ${token}`);
  }
}

const helper = read("src/core/boundedJsonRequest.ts");
const tests = read("tests/boundedJsonRequest.test.ts");
const boundaryDoc = read("docs/bounded-admin-json-boundary.md");
const workflow = read(".github/workflows/worker-contract.yml");
const safetyGate = read("scripts/check-safety-gate-completeness.mjs");
const packageJson = JSON.parse(read("package.json") || "{}");

requireTokens("bounded JSON helper", helper, [
  'BOUNDED_JSON_REQUEST_CONTRACT = "bounded_admin_json_request_v1"',
  "DEFAULT_ADMIN_JSON_MAX_BYTES = 65_536",
  '"json_content_type_required"',
  '"invalid_content_length"',
  '"request_body_too_large"',
  '"invalid_utf8_json"',
  '"invalid_json"',
  '"json_object_required"',
  '"json_structure_too_deep"',
  '"json_structure_too_large"',
  '"json_array_too_large"',
  '"json_string_too_long"',
  '"json_key_too_long"',
  '"forbidden_json_key"',
  '"__proto__"',
  '"prototype"',
  '"constructor"',
  "request.body.getReader()",
  "new TextDecoder(\"utf-8\", { fatal: true })",
  'crypto.subtle.digest("SHA-256", bytes)',
  "isExplicitJsonConfirmation",
  '(value as JsonObject).confirm === true',
  "boundedJsonFailurePayload",
  "maxDepth",
  "maxNodes",
  "maxArrayLength",
  "maxStringLength",
  "maxKeyLength",
]);

forbidTokens("bounded JSON helper", helper, [
  "request.json()",
  "request.text()",
  "eval(",
  "Function(",
]);

const boundedRoutes = [
  "src/index.ts",
  "src/routes/opportunityRunDueAdmin.ts",
  "src/routes/sourceExpansionAdmin.ts",
  "src/routes/sourceExpansionPublicDirectoryScanAdmin.ts",
  "src/routes/sourceExpansionQueryHintResolverAdmin.ts",
  "src/routes/sourceBatchAdmin.ts",
  "src/routes/opportunityDiscoveryAdmin.ts",
  "src/routes/sourcesAdmin.ts",
];

for (const relativePath of boundedRoutes) {
  const source = read(relativePath);
  requireTokens(relativePath, source, [
    "boundedJsonFailurePayload",
    "isExplicitJsonConfirmation",
    "readBoundedJsonObject",
    "requiredPayload: { confirm: true }",
    "confirmationCoercionAllowed: false",
  ]);
  forbidTokens(relativePath, source, [
    "request.json()",
    "request.clone().json()",
    'searchParams.get("confirm")',
    "body?.confirm === 1",
    'body?.confirm === "1"',
    'body?.confirm === "true"',
    "parsed.value.confirm === 1",
    'parsed.value.confirm === "1"',
  ]);
}

const index = read("src/index.ts");
requireTokens("central source confirmation", index, [
  "readBoundedJsonObject(request.clone())",
  "sourceActionRequiresConfirmation",
  "sourceActionConfirmationFailure",
]);

const requestReceiptRoutes = [
  "src/routes/opportunityRunDueAdmin.ts",
  "src/routes/sourceExpansionAdmin.ts",
  "src/routes/sourceExpansionPublicDirectoryScanAdmin.ts",
  "src/routes/sourceExpansionQueryHintResolverAdmin.ts",
  "src/routes/sourceBatchAdmin.ts",
  "src/routes/opportunityDiscoveryAdmin.ts",
  "src/routes/sourcesAdmin.ts",
];
for (const relativePath of requestReceiptRoutes) {
  requireTokens(relativePath, read(relativePath), [
    "requestReceipt",
    "bodySha256",
    "bytes",
  ]);
}

requireTokens("bounded JSON behavioral tests", tests, [
  'from "../src/core/boundedJsonRequest.ts"',
  'test("bounded JSON accepts a compact object and returns a body fingerprint"',
  'test("confirmation is exact and does not accept compatibility coercions"',
  'test("bounded JSON requires a JSON media type"',
  'test("bounded JSON rejects oversized declared and streamed bodies"',
  'test("bounded JSON rejects malformed encodings and non-object roots"',
  'test("bounded JSON rejects dangerous keys and excessive structure"',
  '"json_content_type_required"',
  '"request_body_too_large"',
  '"invalid_utf8_json"',
  '"json_object_required"',
  '"forbidden_json_key"',
  '"json_structure_too_deep"',
  '"json_string_too_long"',
]);

requireTokens("bounded JSON boundary document", boundaryDoc, [
  "# Bounded admin JSON boundary",
  "bounded_admin_json_request_v1",
  "65,536 bytes",
  "HTTP 413",
  "HTTP 415",
  "exact JSON boolean `true`",
  "Query-string confirmation is not accepted.",
  "The full request body is never logged or returned.",
]);

const expectedCommand = "node scripts/check-bounded-json-request-safety.mjs";
if (packageJson.scripts?.["research:bounded-json-safety:check"] !== expectedCommand) {
  errors.push(`package.json must expose research:bounded-json-safety:check as ${expectedCommand}`);
}
if (packageJson.scripts?.["test:core"] !== "node --test") {
  errors.push("package.json must expose test:core as node --test");
}
const checkLocal = String(packageJson.scripts?.["check:local"] || "");
for (const command of ["npm run research:bounded-json-safety:check", "npm run test:core"]) {
  if (!checkLocal.includes(command)) errors.push(`check:local must include ${command}`);
}

requireTokens("safety gate completeness", safetyGate, [
  '"research:bounded-json-safety:check": "node scripts/check-bounded-json-request-safety.mjs"',
  '"scripts/check-bounded-json-request-safety.mjs"',
  "boundedJsonRequestSafetyRequired: true",
]);

requireTokens("Worker contract workflow", workflow, [
  "Verify bounded admin JSON requests",
  "npm run research:bounded-json-safety:check",
  "Run deterministic core tests",
  "npm run test:core",
]);
if (workflow.includes("wrangler deploy")) errors.push("Bounded JSON validation workflow must not deploy the Worker");

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "bounded-admin-json-request-safety-v1",
  defaultMaxBytes: 65536,
  jsonMediaTypeRequired: true,
  contentLengthPreflightRequired: true,
  streamedObservedByteLimitRequired: true,
  strictUtf8Required: true,
  objectRootRequired: true,
  structuralLimitsRequired: true,
  prototypePollutionKeysRejected: true,
  exactBooleanConfirmationRequired: true,
  queryStringConfirmationAllowed: false,
  confirmationCoercionAllowed: false,
  requestFingerprintRequired: true,
  rawRequestBodyLoggedOrReturned: false,
  behavioralTestsRequired: true,
  focusedCiGateRequired: true,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
