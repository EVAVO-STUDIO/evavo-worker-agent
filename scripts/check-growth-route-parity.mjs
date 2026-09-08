import fs from "node:fs";
import path from "node:path";

const CHECK_NAME = "check-growth-route-parity";
const root = process.cwd();
const fixturePath = "fixtures/growth-worker-route-parity-v1.json";
const parserPath = "src/core/growthWorkerRouteParity.ts";
const workflowPath = ".github/workflows/worker-contract.yml";
const errors = [];

const EXPECTED_KEYS = Object.freeze([
  "contractVersion",
  "websiteRepository",
  "workerRepository",
  "path",
  "proposalVersion",
  "requestVersion",
  "bridgeVersion",
  "inventoryVersion",
  "nextApiAdapterVersion",
  "pageHandlerVersion",
  "pageState",
  "bridgeEnabled",
  "deliveryEnabled",
  "blockers",
]);

const EXPECTED_BLOCKERS_BY_PAGE_STATE = Object.freeze({
  absent: Object.freeze([
    "next_website_ingestion_endpoint_not_implemented",
    "cross_repo_contract_tests_not_implemented",
  ]),
  present: Object.freeze([
    "worker_proposal_delivery_not_implemented",
    "cross_repo_contract_tests_not_implemented",
  ]),
});

function readRequired(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing required route-parity file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function requireToken(label, source, token) {
  if (!source.includes(token)) errors.push(`${label} is missing: ${token}`);
}

function requirePattern(label, source, pattern, description) {
  if (!pattern.test(source)) errors.push(`${label} is missing semantic requirement: ${description}`);
}

function forbidPattern(label, source, pattern, description) {
  if (pattern.test(source)) errors.push(`${label} contains forbidden semantic posture: ${description}`);
}

function exactKeys(record, expected, label) {
  const actual = Object.keys(record).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    errors.push(`${label} must contain the exact reviewed field set.`);
  }
}

function parseFixture(raw, label) {
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    errors.push(`${label} is not valid JSON.`);
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${label} must be an object.`);
    return null;
  }
  exactKeys(value, EXPECTED_KEYS, label);
  if (`${JSON.stringify(value, null, 2)}\n` !== raw) {
    errors.push(`${label} must use canonical two-space JSON with one trailing newline.`);
  }
  return value;
}

function exactString(record, key, expected, label) {
  if (record[key] !== expected) errors.push(`${label}.${key} must equal ${expected}.`);
}

function exactBoolean(record, key, expected, label) {
  if (record[key] !== expected) errors.push(`${label}.${key} must equal ${expected}.`);
}

function validateFixture(record, label) {
  exactString(record, "contractVersion", "growth_worker_route_parity_v1", label);
  exactString(record, "websiteRepository", "EVAVO-STUDIO/next-website", label);
  exactString(record, "workerRepository", "EVAVO-STUDIO/evavo-worker-agent", label);
  exactString(record, "path", "/api/private/growth/worker-proposals", label);
  exactString(record, "proposalVersion", "growth_worker_proposal_v1", label);
  exactString(record, "requestVersion", "growth_worker_request_v1", label);
  exactString(record, "bridgeVersion", "growth_worker_bridge_v2", label);
  exactString(record, "inventoryVersion", "growth_worker_route_inventory_v2", label);
  exactString(record, "nextApiAdapterVersion", "growth_worker_next_api_adapter_v1", label);
  exactString(record, "pageHandlerVersion", "growth_worker_proposal_page_handler_v1", label);
  if (record.pageState !== "absent" && record.pageState !== "present") {
    errors.push(`${label}.pageState must be absent or present.`);
  }
  exactBoolean(record, "bridgeEnabled", false, label);
  exactBoolean(record, "deliveryEnabled", false, label);
  const expectedBlockers = EXPECTED_BLOCKERS_BY_PAGE_STATE[record.pageState];
  if (
    !expectedBlockers ||
    !Array.isArray(record.blockers) ||
    record.blockers.length !== expectedBlockers.length ||
    record.blockers.some((value, index) => value !== expectedBlockers[index])
  ) {
    errors.push(`${label}.blockers must match the exact blocker set for pageState=${record.pageState}.`);
  }
}

const packageSource = readRequired("package.json");
let packageJson = {};
try {
  packageJson = packageSource ? JSON.parse(packageSource) : {};
} catch {
  errors.push("package.json is not valid JSON.");
}
const scripts = packageJson.scripts || {};
if (scripts["growth:route-parity:check"] !== "node scripts/check-growth-route-parity.mjs") {
  errors.push("package.json must expose growth:route-parity:check as the deterministic route-parity guard.");
}
if (!String(scripts["check:local"] || "").includes("npm run growth:route-parity:check")) {
  errors.push("check:local must execute growth:route-parity:check.");
}

const fixtureRaw = readRequired(fixturePath);
const fixture = parseFixture(fixtureRaw, "Worker route parity fixture");
if (fixture) validateFixture(fixture, "Worker route parity fixture");

const parserSource = readRequired(parserPath);
for (const token of [
  "GROWTH_WORKER_ROUTE_PARITY_CONTRACT_VERSION",
  "GROWTH_WORKER_ROUTE_ABSENT_BLOCKERS",
  "GROWTH_WORKER_ROUTE_PRESENT_BLOCKERS",
  "worker_proposal_delivery_not_implemented",
  "growthWorkerRouteBlockersForPageState",
  "parseGrowthWorkerRouteParityContract",
  "parseGrowthWorkerRouteParityJson",
  "assertGrowthWorkerRouteParityPageState",
  "GROWTH_WORKER_ROUTE_PARITY_BLOCKERS_INVALID",
  "GROWTH_WORKER_ROUTE_PARITY_PAGE_STATE_MISMATCH",
]) requireToken("Worker Growth route state parser", parserSource, token);

const workflow = readRequired(workflowPath);
requirePattern("Worker contract workflow", workflow, /^\s*workflow_dispatch:\s*$/m, "manual workflow_dispatch admission");
requirePattern("Worker contract workflow", workflow, /^\s*expected_sha:\s*$/m, "exact expected_sha input");
requirePattern("Worker contract workflow", workflow, /^\s*request_source:\s*$/m, "governed request_source input");
requirePattern("Worker contract workflow", workflow, /^\s*permissions:\s*\n\s+contents:\s*read\s*$/m, "read-only contents permission");
requirePattern("Worker contract workflow", workflow, /^\s*ref:\s*\$\{\{\s*inputs\.expected_sha\s*\}\}\s*$/m, "exact-SHA checkout");
requirePattern("Worker contract workflow", workflow, /^\s*persist-credentials:\s*false\s*$/m, "checkout credential removal");
requirePattern("Worker contract workflow", workflow, /^\s*node-version:\s*["']24\.18\.0["']\s*$/m, "exact Node 24.18.0 authority");
requireToken("Worker contract workflow", workflow, "npm ci --no-audit --no-fund");
requireToken("Worker contract workflow", workflow, "npm run growth:route-parity:check");
requireToken("Worker contract workflow", workflow, "npm run test:core");
requireToken("Worker contract workflow", workflow, "npm run check:local");

forbidPattern("Worker contract workflow", workflow, /^\s*push:\s*$/m, "automatic push trigger");
forbidPattern("Worker contract workflow", workflow, /^\s*pull_request:\s*$/m, "automatic pull_request trigger");
forbidPattern("Worker contract workflow", workflow, /^\s*schedule:\s*$/m, "automatic schedule trigger");
forbidPattern("Worker contract workflow", workflow, /^\s*cron:\s*/m, "cron trigger");
forbidPattern("Worker contract workflow", workflow, /^\s*contents:\s*write\s*$/m, "contents write permission");
forbidPattern("Worker contract workflow", workflow, /\bwrangler\s+deploy\b|\bvercel\s+deploy\b/u, "deployment command");

const workflowParityStep = workflow.indexOf("npm run growth:route-parity:check");
const workflowTestsStep = workflow.indexOf("npm run test:core");
const workflowCompleteStep = workflow.indexOf("npm run check:local");
if (!(
  workflowParityStep >= 0 &&
  workflowParityStep < workflowTestsStep &&
  workflowTestsStep < workflowCompleteStep
)) {
  errors.push("Worker workflow must run route parity before deterministic tests and the complete local gate.");
}

for (const forbidden of [
  "bridgeEnabled: true",
  "externalExecutionEnabled: true",
  "canonicalGrowthPromotionEnabled: true",
  "clientBrowserAccess: true",
  "adminTokenBrowserExposure: true",
]) {
  if (parserSource.includes(forbidden)) errors.push(`Worker Growth route parser contains forbidden enabled posture: ${forbidden}`);
}

const configuredWebsitePath = process.env.EVAVO_NEXT_WEBSITE_REPO_PATH?.trim();
const websiteRoot = configuredWebsitePath ? path.resolve(configuredWebsitePath) : path.resolve(root, "..", "next-website");
const websiteFixturePath = path.join(websiteRoot, "tests", "fixtures", "growth-worker-route-parity-v1.json");
const websiteParserPath = path.join(websiteRoot, "src", "server", "growth-autopilot", "growthWorkerRouteParity.ts");
let websiteState = "fixture-only";

if (fs.existsSync(websiteFixturePath)) {
  websiteState = "sibling-verified";
  const websiteFixtureRaw = fs.readFileSync(websiteFixturePath, "utf8");
  if (websiteFixtureRaw !== fixtureRaw) errors.push("Worker and website route parity fixtures must match byte-for-byte.");
  const websiteFixture = parseFixture(websiteFixtureRaw, "Website route parity fixture");
  if (websiteFixture) validateFixture(websiteFixture, "Website route parity fixture");

  const pagePath = path.join(websiteRoot, "src", "pages", "api", "private", "growth", "worker-proposals.ts");
  const actualPageState = fs.existsSync(pagePath) ? "present" : "absent";
  if (fixture && fixture.pageState !== actualPageState) {
    errors.push(`Mirrored route parity fixture pageState=${fixture.pageState} does not match website page state=${actualPageState}.`);
  }

  if (!fs.existsSync(websiteParserPath)) {
    errors.push(`Website route state parser is missing: ${websiteParserPath}`);
  } else if (fs.readFileSync(websiteParserPath, "utf8") !== parserSource) {
    errors.push("Worker and website route state parsers must match byte-for-byte.");
  }
} else if (configuredWebsitePath) {
  errors.push(`Configured EVAVO_NEXT_WEBSITE_REPO_PATH does not contain ${websiteFixturePath}.`);
}

if (errors.length) {
  console.error(`${CHECK_NAME} failed:\n`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Growth route parity check passed.");
console.log(`- website verification mode: ${websiteState}`);
console.log("- growth_worker_route_parity_v1 fixture and page-state blockers are exact");
console.log("- next_website_ingestion_endpoint_not_implemented and worker_proposal_delivery_not_implemented remain state-specific blockers");
console.log("- cross_repo_contract_tests_not_implemented remains explicit until both repositories are verified together");
console.log("- workflow validation is semantic, manual, exact-SHA, read-only and exact-toolchain");
console.log("- bridge and delivery remain disabled; no deployment or automatic workflow trigger is admitted");
