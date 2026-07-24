import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const fixturePath = path.join(root, "fixtures", "growth-worker-route-parity-v1.json");

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
] as const);
const EXPECTED_BLOCKERS = Object.freeze([
  "next_website_ingestion_endpoint_not_implemented",
  "cross_repo_contract_tests_not_implemented",
] as const);
const MAX_FILES = 800;
const MAX_TOTAL_BYTES = 12_000_000;
const MAX_FILE_BYTES = 500_000;

type UnknownRecord = Record<string, unknown>;

function assert(condition: boolean, label: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION_FAILED:${label}`);
}

function objectValue(value: unknown, label: string): UnknownRecord {
  assert(Boolean(value) && typeof value === "object" && !Array.isArray(value), label);
  return value as UnknownRecord;
}

function exactString(record: UnknownRecord, key: string, expected: string): void {
  assert(record[key] === expected, `fixture-${key}`);
}

function boundedCorpus(directory: string): string {
  const chunks: string[] = [];
  let files = 0;
  let bytes = 0;

  function visit(current: string, depth: number): void {
    if (depth > 8 || files > MAX_FILES || bytes > MAX_TOTAL_BYTES) return;
    let entries: fs.Dirent[];
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
      files += 1;
      bytes += stat.size;
      if (files > MAX_FILES || bytes > MAX_TOTAL_BYTES) break;
      chunks.push(fs.readFileSync(absolute, "utf8"));
    }
  }

  visit(directory, 0);
  assert(files <= MAX_FILES, "source-file-bound");
  assert(bytes <= MAX_TOTAL_BYTES, "source-byte-bound");
  return chunks.join("\n");
}

const fixtureRaw = fs.readFileSync(fixturePath, "utf8");
const fixture = objectValue(JSON.parse(fixtureRaw) as unknown, "fixture-object");
const actualKeys = Object.keys(fixture).sort();
const expectedKeys = [...EXPECTED_KEYS].sort();
assert(
  actualKeys.length === expectedKeys.length && actualKeys.every((key, index) => key === expectedKeys[index]),
  "fixture-exact-field-set",
);

exactString(fixture, "contractVersion", "growth_worker_route_parity_v1");
exactString(fixture, "websiteRepository", "EVAVO-STUDIO/next-website");
exactString(fixture, "workerRepository", "EVAVO-STUDIO/evavo-worker-agent");
exactString(fixture, "path", "/api/private/growth/worker-proposals");
exactString(fixture, "proposalVersion", "growth_worker_proposal_v1");
exactString(fixture, "requestVersion", "growth_worker_request_v1");
exactString(fixture, "bridgeVersion", "growth_worker_bridge_v2");
exactString(fixture, "inventoryVersion", "growth_worker_route_inventory_v2");
exactString(fixture, "nextApiAdapterVersion", "growth_worker_next_api_adapter_v1");
exactString(fixture, "pageHandlerVersion", "growth_worker_proposal_page_handler_v1");
assert(fixture.pageState === "absent" || fixture.pageState === "present", "fixture-page-state");
assert(fixture.bridgeEnabled === false, "fixture-bridge-disabled");
assert(fixture.deliveryEnabled === false, "fixture-delivery-disabled");
assert(Array.isArray(fixture.blockers), "fixture-blockers-array");
const blockers = fixture.blockers as unknown[];
assert(
  blockers.length === EXPECTED_BLOCKERS.length && blockers.every((value, index) => value === EXPECTED_BLOCKERS[index]),
  "fixture-exact-blockers",
);
assert(`${JSON.stringify(fixture, null, 2)}\n` === fixtureRaw, "fixture-canonical-json");

const sourceCorpus = boundedCorpus(path.join(root, "src"));
for (const token of [
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
]) {
  assert(sourceCorpus.includes(token), `source-${token}`);
}
for (const forbidden of [
  "bridgeEnabled: true",
  "externalExecutionEnabled: true",
  "canonicalGrowthPromotionEnabled: true",
  "clientBrowserAccess: true",
  "adminTokenBrowserExposure: true",
]) {
  assert(!sourceCorpus.includes(forbidden), `source-forbids-${forbidden}`);
}
for (const forbidden of [
  "ADMIN_TOKEN",
  "EVAVO_GROWTH_WORKER_ADMIN_TOKEN",
  "EVAVO_GROWTH_WORKER_PROPOSAL_KEYS_JSON",
  "PRIVATE_SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "providerToken",
]) {
  assert(!fixtureRaw.includes(forbidden), `fixture-forbids-${forbidden}`);
}

const configuredWebsitePath = process.env.EVAVO_NEXT_WEBSITE_REPO_PATH?.trim();
const websiteRoot = configuredWebsitePath
  ? path.resolve(configuredWebsitePath)
  : path.resolve(root, "..", "next-website");
const websiteFixturePath = path.join(websiteRoot, "tests", "fixtures", "growth-worker-route-parity-v1.json");
if (fs.existsSync(websiteFixturePath)) {
  const websiteFixtureRaw = fs.readFileSync(websiteFixturePath, "utf8");
  assert(websiteFixtureRaw === fixtureRaw, "sibling-fixture-byte-parity");
  const websitePagePath = path.join(
    websiteRoot,
    "src",
    "pages",
    "api",
    "private",
    "growth",
    "worker-proposals.ts",
  );
  const actualPageState = fs.existsSync(websitePagePath) ? "present" : "absent";
  assert(fixture.pageState === actualPageState, "sibling-page-state-parity");
} else if (configuredWebsitePath) {
  throw new Error(`ASSERTION_FAILED:configured-website-fixture-missing:${websiteFixturePath}`);
}

Object.freeze(fixture);
assert(Object.isFrozen(fixture), "fixture-frozen-after-validation");

console.log("Growth route parity contract passed.");
console.log("- Worker fixture pins the reserved path, packet/request/readiness versions and exact blocker order");
console.log("- Worker source keeps bridge delivery, canonical promotion and external execution disabled");
console.log("- sibling website fixture and page state are checked when the website checkout is available");
console.log("- static route parity does not clear the live cross-repository smoke blocker");
