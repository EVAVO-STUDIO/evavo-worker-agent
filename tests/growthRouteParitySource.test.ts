import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION_FAILED:${label}`);
}

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const guard = read("scripts/check-growth-route-parity.mjs");
const parser = read("src/core/growthWorkerRouteParity.ts");
const fixtureRaw = read("fixtures/growth-worker-route-parity-v1.json");
const fixture = JSON.parse(fixtureRaw) as Record<string, unknown>;
const contract = read("docs/growth-route-parity.md");
const behaviouralTest = read("tests/growthRouteParity.test.ts");

for (const token of [
  'const CHECK_NAME = "check-growth-route-parity"',
  "growth_worker_route_parity_v1",
  "EVAVO_NEXT_WEBSITE_REPO_PATH",
  "growth-worker-route-parity-v1.json",
  "growthWorkerRouteParity.ts",
  "EXPECTED_BLOCKERS_BY_PAGE_STATE",
  "worker_proposal_delivery_not_implemented",
  "MAX_DISCOVERED_FILES = 800",
  "MAX_DISCOVERED_BYTES = 12_000_000",
  "MAX_FILE_BYTES = 500_000",
  "function boundedCorpus(baseDirectory)",
  "Worker and website route parity fixtures must match byte-for-byte.",
  "Worker and website route state parsers must match byte-for-byte.",
  "fixture.pageState !== actualPageState",
  "bridgeEnabled: false",
  "externalExecutionEnabled: false",
  "canonicalGrowthPromotionEnabled: false",
  "next_website_ingestion_endpoint_not_implemented",
  "worker_proposal_delivery_not_implemented",
  "cross_repo_contract_tests_not_implemented",
  "absent pages require the endpoint blocker; present pages require the Worker proposal delivery blocker",
  'const packageSource = readRequired("package.json")',
  'scripts["growth:route-parity:check"] !== "node scripts/check-growth-route-parity.mjs"',
  'String(scripts["check:local"] || "").includes("npm run growth:route-parity:check")',
  'const safetyGate = readRequired("scripts/check-safety-gate-completeness.mjs")',
  'const helperValidation = readRequired("scripts/check-helper-scripts.mjs")',
  'const workflowParity = readRequired("scripts/check-worker-contract-workflow.mjs")',
  'const workflow = readRequired(".github/workflows/worker-contract.yml")',
  "Verify Growth route parity",
  "npm run growth:route-parity:check",
  "Worker workflow must run route parity before deterministic tests and the complete local gate.",
  "Growth route parity check passed.",
]) {
  assert(guard.includes(token), `guard-${token}`);
}

for (const token of [
  "GROWTH_WORKER_ROUTE_PARITY_CONTRACT_VERSION",
  "GROWTH_WORKER_ROUTE_ABSENT_BLOCKERS",
  "GROWTH_WORKER_ROUTE_PRESENT_BLOCKERS",
  "GROWTH_WORKER_ROUTE_BLOCKERS_BY_PAGE_STATE",
  "GROWTH_WORKER_ROUTE_CURRENT_PAGE_STATE",
  "GROWTH_WORKER_ROUTE_CURRENT_BLOCKERS",
  "worker_proposal_delivery_not_implemented",
  "growthWorkerRouteBlockersForPageState",
  "parseGrowthWorkerRouteParityContract",
  "parseGrowthWorkerRouteParityJson",
  "assertGrowthWorkerRouteParityPageState",
  "GROWTH_WORKER_ROUTE_PARITY_BLOCKERS_INVALID",
  "GROWTH_WORKER_ROUTE_PARITY_PAGE_STATE_MISMATCH",
]) {
  assert(parser.includes(token), `parser-${token}`);
}

for (const forbidden of [
  "fetch(",
  "setTimeout(",
  "setInterval(",
  "child_process",
  "exec(",
  "spawn(",
  "ADMIN_TOKEN",
  "EVAVO_GROWTH_WORKER_ADMIN_TOKEN",
  "EVAVO_GROWTH_WORKER_PROPOSAL_KEYS_JSON",
  "PRIVATE_SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "authorization:",
  "providerToken",
  "localStorage",
  "document.cookie",
]) {
  assert(!guard.includes(forbidden), `guard-forbids-${forbidden}`);
  assert(!parser.includes(forbidden), `parser-forbids-${forbidden}`);
}

for (const token of [
  '"contractVersion": "growth_worker_route_parity_v1"',
  '"websiteRepository": "EVAVO-STUDIO/next-website"',
  '"workerRepository": "EVAVO-STUDIO/evavo-worker-agent"',
  '"path": "/api/private/growth/worker-proposals"',
  '"proposalVersion": "growth_worker_proposal_v1"',
  '"requestVersion": "growth_worker_request_v1"',
  '"bridgeVersion": "growth_worker_bridge_v2"',
  '"inventoryVersion": "growth_worker_route_inventory_v2"',
  '"bridgeEnabled": false',
  '"deliveryEnabled": false',
  "cross_repo_contract_tests_not_implemented",
]) {
  assert(fixtureRaw.includes(token), `fixture-${token}`);
}

const blockersByState = {
  absent: [
    "next_website_ingestion_endpoint_not_implemented",
    "cross_repo_contract_tests_not_implemented",
  ],
  present: [
    "worker_proposal_delivery_not_implemented",
    "cross_repo_contract_tests_not_implemented",
  ],
} as const;
assert(fixture.pageState === "absent" || fixture.pageState === "present", "fixture-page-state-finite");
assert(
  JSON.stringify(fixture.blockers) === JSON.stringify(blockersByState[fixture.pageState]),
  "fixture-current-blockers",
);
assert(
  parser.includes(`GROWTH_WORKER_ROUTE_CURRENT_PAGE_STATE = "${fixture.pageState}"`),
  "parser-current-state-matches-fixture",
);

for (const forbidden of [
  "ADMIN_TOKEN",
  "EVAVO_GROWTH_WORKER_ADMIN_TOKEN",
  "EVAVO_GROWTH_WORKER_PROPOSAL_KEYS_JSON",
  "PRIVATE_SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "providerToken",
  "signature",
  "nonce",
]) {
  assert(!fixtureRaw.includes(forbidden), `fixture-forbids-${forbidden}`);
}

for (const token of [
  "Growth Route Parity",
  "growth_worker_route_parity_v1",
  "src/core/growthWorkerRouteParity.ts",
  "node scripts/check-growth-route-parity.mjs",
  "Conditional blocker posture",
  "worker_proposal_delivery_not_implemented",
  "bridgeEnabled: false",
  "deliveryEnabled: false",
  "Static fixture and parser parity are not live bridge evidence.",
]) {
  assert(contract.includes(token), `contract-${token}`);
}

for (const token of [
  "Growth route parity contract passed.",
  "fixture-current-page-state",
  "fixture-current-blockers",
  "absent-state-accepted",
  "present-state-accepted",
  "present-removes-endpoint-blocker",
  "present-adds-delivery-blocker",
  "absent-with-present-blockers",
  "present-with-absent-blockers",
  "premature-bridge",
  "premature-delivery",
  "noncanonical-json",
  "source-file-bound",
  "source-byte-bound",
  "sibling-fixture-byte-parity",
  "sibling-parser-byte-parity",
  "sibling website fixture, parser bytes and actual page state are checked",
]) {
  assert(behaviouralTest.includes(token), `behavioural-test-${token}`);
}

console.log("Growth route parity source contract passed.");
console.log("- Worker guard uses bounded local source scanning and optional sibling verification only");
console.log("- npm, check:local, safety completeness, helper parsing and read-only workflow wiring are source-tested");
console.log("- one pure parser owns exact fields, canonical JSON, frozen output and conditional blocker sets");
console.log("- source tests accept either reviewed current state only when fixture, parser and blocker set agree");
console.log("- static fixture and parser parity remain distinct from live HTTP delivery and end-to-end smoke");
