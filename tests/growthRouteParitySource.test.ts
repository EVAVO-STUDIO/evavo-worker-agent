import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function assert(condition: boolean, label: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION_FAILED:${label}`);
}

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const guard = read("scripts/check-growth-route-parity.mjs");
const fixture = read("fixtures/growth-worker-route-parity-v1.json");
const contract = read("docs/growth-route-parity.md");
const behaviouralTest = read("tests/growthRouteParity.test.ts");

for (const token of [
  'const CHECK_NAME = "check-growth-route-parity"',
  "growth_worker_route_parity_v1",
  "EVAVO_NEXT_WEBSITE_REPO_PATH",
  "growth-worker-route-parity-v1.json",
  "MAX_DISCOVERED_FILES = 800",
  "MAX_DISCOVERED_BYTES = 12_000_000",
  "MAX_FILE_BYTES = 500_000",
  "function boundedCorpus(baseDirectory)",
  "Worker and website route parity fixtures must match byte-for-byte.",
  "fixture.pageState !== actualPageState",
  "bridgeEnabled: false",
  "externalExecutionEnabled: false",
  "canonicalGrowthPromotionEnabled: false",
  "next_website_ingestion_endpoint_not_implemented",
  "cross_repo_contract_tests_not_implemented",
  "Growth route parity check passed.",
]) {
  assert(guard.includes(token), `guard-${token}`);
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
  '"pageState": "absent"',
  '"bridgeEnabled": false',
  '"deliveryEnabled": false',
  "next_website_ingestion_endpoint_not_implemented",
  "cross_repo_contract_tests_not_implemented",
]) {
  assert(fixture.includes(token), `fixture-${token}`);
}

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
  assert(!fixture.includes(forbidden), `fixture-forbids-${forbidden}`);
}

for (const token of [
  "Growth Route Parity",
  "growth_worker_route_parity_v1",
  "node scripts/check-growth-route-parity.mjs",
  "bridgeEnabled: false",
  "deliveryEnabled: false",
  "Static fixture parity is not live bridge evidence.",
]) {
  assert(contract.includes(token), `contract-${token}`);
}

for (const token of [
  "Growth route parity contract passed.",
  "fixture-exact-field-set",
  "fixture-exact-blockers",
  "fixture-canonical-json",
  "source-file-bound",
  "source-byte-bound",
  "sibling-fixture-byte-parity",
  "sibling-page-state-parity",
  "static route parity does not clear the live cross-repository smoke blocker",
]) {
  assert(behaviouralTest.includes(token), `behavioural-test-${token}`);
}

console.log("Growth route parity source contract passed.");
console.log("- Worker guard uses bounded local source scanning and optional sibling verification only");
console.log("- route fixture contains exact version, path, page-state and blocker fields without credentials");
console.log("- behavioral fixtures cover source posture, canonical JSON, sibling byte parity and website page state");
console.log("- static route parity remains distinct from live HTTP delivery and end-to-end smoke");
