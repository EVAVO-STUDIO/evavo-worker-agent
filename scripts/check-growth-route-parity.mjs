import fs from "node:fs";
import path from "node:path";

const CHECK_NAME = "check-growth-route-parity";
const root = process.cwd();
const fixturePath = "fixtures/growth-worker-route-parity-v1.json";
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
const EXPECTED_BLOCKERS = Object.freeze([
  "next_website_ingestion_endpoint_not_implemented",
  "cross_repo_contract_tests_not_implemented",
]);
const MAX_DISCOVERED_FILES = 800;
const MAX_DISCOVERED_BYTES = 12_000_000;
const MAX_FILE_BYTES = 500_000;

function requireTokens(label, content, tokens) {
  for (const token of tokens) {
    if (!content.includes(token)) errors.push(`${label} is missing: ${token}`);
  }
}

function forbidTokens(label, content, tokens) {
  for (const token of tokens) {
    if (content.includes(token)) errors.push(`${label} contains forbidden token: ${token}`);
  }
}

function exactKeys(record, expected, label) {
  const actual = Object.keys(record).sort();
  const sortedExpected = [...expected].sort();
  if (
    actual.length !== sortedExpected.length ||
    actual.some((key, index) => key !== sortedExpected[index])
  ) {
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
  if (
    !Array.isArray(record.blockers) ||
    record.blockers.length !== EXPECTED_BLOCKERS.length ||
    record.blockers.some((value, index) => value !== EXPECTED_BLOCKERS[index])
  ) {
    errors.push(`${label}.blockers must preserve the exact current bridge-disabled blocker order.`);
  }
}

function boundedCorpus(baseDirectory) {
  const chunks = [];
  let discoveredFiles = 0;
  let discoveredBytes = 0;

  function visit(current, depth) {
    if (depth > 8 || discoveredFiles > MAX_DISCOVERED_FILES || discoveredBytes > MAX_DISCOVERED_BYTES) return;
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if ([".git", "node_modules", "dist", "coverage", ".wrangler"].includes(entry.name)) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(absolute, depth + 1);
        continue;
      }
      if (!/\.(?:ts|tsx|mjs|json|md)$/.test(entry.name)) continue;
      const stat = fs.statSync(absolute);
      if (stat.size > MAX_FILE_BYTES) continue;
      discoveredFiles += 1;
      discoveredBytes += stat.size;
      if (discoveredFiles > MAX_DISCOVERED_FILES || discoveredBytes > MAX_DISCOVERED_BYTES) break;
      chunks.push(fs.readFileSync(absolute, "utf8"));
    }
  }

  visit(baseDirectory, 0);
  if (discoveredFiles > MAX_DISCOVERED_FILES || discoveredBytes > MAX_DISCOVERED_BYTES) {
    errors.push("Worker route parity scan exceeded its reviewed file or byte bounds.");
  }
  return chunks.join("\n");
}

const workerFixtureRaw = fs.readFileSync(path.join(root, fixturePath), "utf8");
const fixture = parseFixture(workerFixtureRaw, "Worker route parity fixture");
if (fixture) validateFixture(fixture, "Worker route parity fixture");

const workerCorpus = boundedCorpus(path.join(root, "src"));
requireTokens("Worker Growth route sources", workerCorpus, [
  "growth_worker_proposal_v1",
  "growth_worker_request_v1",
  "growth_worker_bridge_v2",
  "growth_worker_route_inventory_v2",
  "/api/private/growth/worker-proposals",
  "bridgeEnabled: false",
  "externalExecutionEnabled: false",
  "canonicalGrowthPromotionEnabled: false",
  "next_website_ingestion_endpoint_not_implemented",
  "cross_repo_contract_tests_not_implemented",
]);
forbidTokens("Worker Growth route sources", workerCorpus, [
  "bridgeEnabled: true",
  "externalExecutionEnabled: true",
  "canonicalGrowthPromotionEnabled: true",
  "clientBrowserAccess: true",
  "adminTokenBrowserExposure: true",
]);
forbidTokens("Worker route parity fixture", workerFixtureRaw, [
  "ADMIN_TOKEN",
  "EVAVO_GROWTH_WORKER_ADMIN_TOKEN",
  "EVAVO_GROWTH_WORKER_PROPOSAL_KEYS_JSON",
  "PRIVATE_SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "secret",
  "signature",
  "nonce",
  "providerToken",
]);

const configuredWebsitePath = process.env.EVAVO_NEXT_WEBSITE_REPO_PATH?.trim();
const websiteRoot = configuredWebsitePath
  ? path.resolve(configuredWebsitePath)
  : path.resolve(root, "..", "next-website");
const websiteFixturePath = path.join(websiteRoot, "tests", "fixtures", "growth-worker-route-parity-v1.json");
let websiteState = "fixture-only";

if (fs.existsSync(websiteFixturePath)) {
  websiteState = "sibling-verified";
  const websiteFixtureRaw = fs.readFileSync(websiteFixturePath, "utf8");
  if (websiteFixtureRaw !== workerFixtureRaw) {
    errors.push("Worker and website route parity fixtures must match byte-for-byte.");
  }
  const websiteFixture = parseFixture(websiteFixtureRaw, "Website route parity fixture");
  if (websiteFixture) validateFixture(websiteFixture, "Website route parity fixture");

  const pagePath = path.join(websiteRoot, "src", "pages", "api", "private", "growth", "worker-proposals.ts");
  const actualPageState = fs.existsSync(pagePath) ? "present" : "absent";
  if (fixture && fixture.pageState !== actualPageState) {
    errors.push(`Mirrored route parity fixture pageState=${fixture.pageState} does not match website page state=${actualPageState}.`);
  }

  const websiteCorpus = [
    path.join(websiteRoot, "src", "server", "growth-autopilot", "workerProposalRequestSignature.ts"),
    path.join(websiteRoot, "src", "server", "growth-autopilot", "workerBridgeReadiness.ts"),
    path.join(websiteRoot, "src", "server", "growth-autopilot", "workerProposalIngestionNextApiAdapter.ts"),
    path.join(websiteRoot, "src", "server", "growth-autopilot", "workerProposalIngestionPageHandler.ts"),
    path.join(websiteRoot, "scripts", "check-growth-worker-proposal-page-source.mjs"),
  ].map((file) => fs.readFileSync(file, "utf8")).join("\n");
  requireTokens("Website route parity sources", websiteCorpus, [
    "growth_worker_request_v1",
    "growth_worker_bridge_v2",
    "growth_worker_route_inventory_v2",
    "growth_worker_next_api_adapter_v1",
    "growth_worker_proposal_page_handler_v1",
    "/api/private/growth/worker-proposals",
    "bridgeEnabled: false",
    "next_website_ingestion_endpoint_not_implemented",
    "cross_repo_contract_tests_not_implemented",
    "present state must match the exact reviewed frozen-config and page-handler delegation source byte-for-byte",
  ]);
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
console.log("- mirrored fixture pins repository names, reserved path, packet/request/readiness versions and bridge-disabled posture");
console.log("- Worker source preserves the two current blockers and keeps delivery, canonical promotion and external execution disabled");
console.log("- when the sibling website checkout is available, its fixture must match byte-for-byte and page state must match the fixture");
console.log("- the current cross_repo_contract_tests_not_implemented blocker still covers absent live HTTP delivery and end-to-end smoke, not static fixture parity");
console.log("- no admin, bridge, service-role, provider, signature or nonce credential may enter the parity fixture");
