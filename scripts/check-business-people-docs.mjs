#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing Business people contract file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function requireTokens(label, source, tokens) {
  for (const token of tokens) {
    if (!source.includes(token)) errors.push(`${label} is missing: ${token}`);
  }
}

function forbidTokens(label, source, tokens) {
  for (const token of tokens) {
    if (source.includes(token)) errors.push(`${label} contains stale unsafe token: ${token}`);
  }
}

const routePath = "src/routes/businessAutopilotPeopleAdmin.ts";
const recordsPath = "src/core/businessAutopilotPeopleRecords.ts";
const routeDocPath = "docs/business-autopilot-people-routes.md";
const dataModelPath = "docs/business-autopilot-data-model.md";
const validationPath = "docs/business-autopilot-validation.md";
const testPath = "tests/businessPeopleWriteBoundary.test.ts";

const route = read(routePath);
const records = read(recordsPath);
const routeDoc = read(routeDocPath);
const dataModel = read(dataModelPath);
const validation = read(validationPath);
const tests = read(testPath);
const packageJson = JSON.parse(read("package.json") || "{}");

requireTokens("Business people route documentation", routeDoc, [
  "Business Autopilot people routes",
  "business_people",
  "business_person_save",
  "GET /admin/business/people?limit=25",
  "POST /admin/business/people",
  "Content-Type: application/json",
  '"confirm": true',
  '"person": {',
  "business_metadata_read_query_v1",
  "business_metadata_write_boundary_v1",
  "bounded_admin_json_request_v1",
  "maximum request body: 32,768 bytes",
  "queryConfirmationAllowed: false",
  "confirmationCoercionAllowed: false",
  "required non-empty bounded name",
  "public HTTP or HTTPS profile and source URLs",
  "no credential-shaped keys in nested metadata",
  "An omitted `limit` remains 25 rather than being coerced to one record.",
  "do not enrich contacts, scrape profiles, send email, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems",
  "rawErrorExposed: false",
]);
forbidTokens("Business people route documentation", routeDoc, [
  "POST /admin/business/people?confirm=1",
  "query confirmation is accepted",
  "numeric confirmation is accepted",
]);

requireTokens("Business data model", dataModel, [
  "business_people",
  "allowed_use",
  "contact_status",
  "People/contact context ends at manual review",
  "allowed-use review",
  "contactability review",
  "Internal write routes must require explicit confirmation",
  "There is no active pipeline from either relationship into delivery.",
]);
forbidTokens("Business data model", dataModel, [
  "POST /admin/business/people?confirm=1",
]);

requireTokens("Business validation document", validation, [
  "Business people records",
  "Business people admin routes",
  "business_people",
  "business_person_save",
  "/admin/business/people?limit=5",
  "confirm routes require explicit confirmation",
  "confirm routes call no network or AI",
]);

requireTokens("Business people route", route, [
  'import { parseBusinessMetadataReadQuery } from "../core/businessMetadataReadBoundary"',
  'from "../core/businessMetadataWriteBoundary"',
  'import { BUSINESS_PEOPLE_PATH } from "../core/businessRoutePaths"',
  'import { validatePublicResearchUrl } from "../core/publicResearchFetch"',
  "type BusinessMetadataWriteBoundaryOptions",
  "const PERSON_WRITE_BOUNDARY = Object.freeze({",
  'entityKey: "person"',
  "allowedEntityFields: PERSON_WRITE_KEYS",
  'requiredTextFields: new Set(["name"])',
  'objectFields: new Set(["metadata"])',
  "confidenceScore: { min: 0, max: 100 }",
  "maxBytes: 32_768",
  "const PEOPLE_READ_QUERY_OPTIONS = Object.freeze({",
  "contactStatus: { maxLength: 64 }",
  "function validatePerson",
  "validatePublicResearchUrl(text.value)",
  'pathname !== BUSINESS_PEOPLE_PATH',
  "const query = parseBusinessMetadataReadQuery(url, PEOPLE_READ_QUERY_OPTIONS)",
  "query.text.contactStatus",
  "queryContract: query.contract",
  "const parsed = await readBusinessMetadataWriteRequest(",
  "PERSON_WRITE_BOUNDARY",
  "const personInput = validatePerson(parsed.entity)",
  "requestReceipt: parsed.requestReceipt",
  "exactBooleanConfirmation: true",
  "confirmationCoercionAllowed: false",
  "queryConfirmationAllowed: false",
  "rawErrorExposed: false",
  "contactDetailsRedacted: true",
  "metadataRedacted: true",
  "return json(migrationError(error), { status: 503 })",
]);
forbidTokens("Business people route", route, [
  'from "../core/boundedJsonRequest"',
  "readBoundedJsonObject",
  "isExplicitJsonConfirmation",
  "boundedJsonFailurePayload",
  'const ROUTE_PATH = "/admin/business/people"',
  "TOP_LEVEL_WRITE_KEYS",
  "GET_QUERY_KEYS",
  "function containsSensitiveInputKey",
  "function parseLimit",
  "function parseContactStatus",
  'url.searchParams.getAll("limit")',
  'url.searchParams.getAll("contactStatus")',
  "request.json()",
  "request.clone().json()",
  "function confirmed(",
  'searchParams.get("confirm")',
  "body?.confirm === 1",
  'body?.confirm === "1"',
  "body.person || body",
  "const value = Number(url.searchParams.get(key))",
  "Unknown person",
  "bodySha256: parsed.bodySha256",
]);

const authPosition = route.indexOf("await isAdminRequestAuthorized(request, env)");
const optionsPosition = route.indexOf('request.method === "OPTIONS"');
const readQueryPosition = route.indexOf(
  "const query = parseBusinessMetadataReadQuery(url, PEOPLE_READ_QUERY_OPTIONS)",
);
const readPersistencePosition = route.indexOf("const people = await listBusinessPeople(");
const sharedWriteBoundaryPosition = route.indexOf(
  "const parsed = await readBusinessMetadataWriteRequest(",
);
const validationPosition = route.indexOf(
  "const personInput = validatePerson(parsed.entity)",
);
const persistencePosition = route.indexOf(
  "const person = await saveBusinessPerson(env, personInput.value)",
);
if (!(
  authPosition >= 0 &&
  optionsPosition > authPosition &&
  readQueryPosition > optionsPosition &&
  readPersistencePosition > readQueryPosition &&
  sharedWriteBoundaryPosition > optionsPosition &&
  validationPosition > sharedWriteBoundaryPosition &&
  persistencePosition > validationPosition
)) {
  errors.push(
    "Business people reads and writes must authenticate, apply shared boundaries, validate semantic fields, and access D1 last.",
  );
}

requireTokens("Business people storage compatibility", records, [
  "export type BusinessPersonInput",
  "export async function listBusinessPeople",
  "export async function saveBusinessPerson",
  "email: nullable(input.email",
  "phone: nullable(input.phone",
  "profileUrl: nullable(input.profileUrl",
  "sourceUrl: nullable(input.sourceUrl",
  "metadata: input.metadata || {}",
  "scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT",
]);

requireTokens("Business people behavioral contract", tests, [
  'test("Business people routes authenticate before reads or body processing"',
  'test("Business people reads keep the documented default and reject ambiguous queries"',
  'test("query and coerced confirmation cannot authorize Business people writes"',
  'test("Business people writes use bounded JSON and exact reviewed fields"',
  'test("valid Business people writes persist once and return only reduced contact posture"',
  'test("Business people database failures are finite and never expose raw input or errors"',
  'assert.equal(boundValues().at(-1), 25)',
  'assert.equal(readResult.queryContract, "business_metadata_read_query_v1")',
  'assert.equal(result.boundaryContract, "business_metadata_write_boundary_v1")',
  '"business_metadata_write_boundary_v1",',
  'assert.equal(text.includes(rawEmail), false)',
  'assert.equal(text.includes("bodySha256"), false)',
  'assert.equal(result.rawErrorExposed, false)',
]);

const scripts = packageJson.scripts || {};
const expectedCommand = "node scripts/check-business-people-docs.mjs";
if (scripts["business:people:docs:check"] !== expectedCommand) {
  errors.push(
    `package.json must expose business:people:docs:check as ${expectedCommand}`,
  );
}
const localGate = String(scripts["check:local"] || "");
for (const command of [
  "npm run business:people:docs:check",
  "npm run business:people-response-minimisation:check",
  "npm run test:core",
]) {
  if (!localGate.includes(command)) errors.push(`check:local is missing: ${command}`);
}

if (errors.length) {
  console.error("Business people route contract failed:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Business people route contract passed.");
console.log("- reads use the shared bounded query parser and preserve the documented default");
console.log("- writes use the shared metadata boundary plus public URL and identifier validation");
console.log("- query and coerced confirmation fail before D1 access");
console.log("- credential-shaped nested metadata is rejected and contact responses remain reduced");
console.log("- storage failures expose finite 503 diagnostics without raw input or database errors");
console.log("- no AI, network research, outreach, browser action, provider mutation or external execution is enabled");
