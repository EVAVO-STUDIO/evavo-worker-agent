import fs from "node:fs";
import path from "node:path";

import {
  GROWTH_WORKER_ROUTE_ABSENT_BLOCKERS,
  GROWTH_WORKER_ROUTE_CURRENT_BLOCKERS,
  GROWTH_WORKER_ROUTE_CURRENT_PAGE_STATE,
  GROWTH_WORKER_ROUTE_PRESENT_BLOCKERS,
  assertGrowthWorkerRouteParityPageState,
  growthWorkerRouteBlockersForPageState,
  parseGrowthWorkerRouteParityContract,
  parseGrowthWorkerRouteParityJson,
  type GrowthWorkerRoutePageState,
  type GrowthWorkerRouteParityContract,
} from "../src/core/growthWorkerRouteParity";

const root = process.cwd();
const fixturePath = path.join(root, "fixtures", "growth-worker-route-parity-v1.json");
const MAX_FILES = 800;
const MAX_TOTAL_BYTES = 12_000_000;
const MAX_FILE_BYTES = 500_000;

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION_FAILED:${label}`);
}

function expectError(label: string, run: () => unknown, expected: string): void {
  let observed = "";
  try { run(); } catch (error) { observed = error instanceof Error ? error.message : String(error); }
  assert(observed === expected, `${label}-${observed || "none"}`);
}

function withChanges(
  contract: GrowthWorkerRouteParityContract,
  changes: Partial<Record<keyof GrowthWorkerRouteParityContract | "unexpected", unknown>>,
): Record<string, unknown> {
  return { ...contract, ...changes };
}

function boundedCorpus(directory: string): string {
  const chunks: string[] = [];
  let files = 0;
  let bytes = 0;
  function visit(current: string, depth: number): void {
    if (depth > 8 || files > MAX_FILES || bytes > MAX_TOTAL_BYTES) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if ([".git", "node_modules", "dist", "coverage", ".wrangler"].includes(entry.name)) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) { visit(absolute, depth + 1); continue; }
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
const fixture = parseGrowthWorkerRouteParityJson(fixtureRaw);
assert(Object.isFrozen(fixture), "fixture-frozen");
assert(Object.isFrozen(fixture.blockers), "fixture-blockers-frozen");
assert(fixture.pageState === GROWTH_WORKER_ROUTE_CURRENT_PAGE_STATE, "fixture-current-page-state");
assert(fixture.blockers.join(",") === GROWTH_WORKER_ROUTE_CURRENT_BLOCKERS.join(","), "fixture-current-blockers");
assert(growthWorkerRouteBlockersForPageState("absent") === GROWTH_WORKER_ROUTE_ABSENT_BLOCKERS, "absent-blocker-identity");
assert(growthWorkerRouteBlockersForPageState("present") === GROWTH_WORKER_ROUTE_PRESENT_BLOCKERS, "present-blocker-identity");

const absent = parseGrowthWorkerRouteParityContract(withChanges(fixture, { pageState: "absent", blockers: [...GROWTH_WORKER_ROUTE_ABSENT_BLOCKERS] }));
assert(absent.pageState === "absent", "absent-state-accepted");
assert(absent.blockers.join(",") === GROWTH_WORKER_ROUTE_ABSENT_BLOCKERS.join(","), "absent-blockers-accepted");
assert(absent.blockers.includes("next_website_ingestion_endpoint_not_implemented"), "absent-keeps-endpoint-blocker");
assert(!absent.blockers.includes("worker_proposal_delivery_not_implemented"), "absent-excludes-delivery-blocker");
assert(Object.isFrozen(absent) && Object.isFrozen(absent.blockers), "absent-frozen");

const present = parseGrowthWorkerRouteParityContract(withChanges(fixture, { pageState: "present", blockers: [...GROWTH_WORKER_ROUTE_PRESENT_BLOCKERS] }));
assert(present.pageState === "present", "present-state-accepted");
assert(present.blockers.join(",") === GROWTH_WORKER_ROUTE_PRESENT_BLOCKERS.join(","), "present-blockers-accepted");
assert(!present.blockers.includes("next_website_ingestion_endpoint_not_implemented"), "present-removes-endpoint-blocker");
assert(present.blockers.includes("worker_proposal_delivery_not_implemented"), "present-adds-delivery-blocker");
assert(Object.isFrozen(present) && Object.isFrozen(present.blockers), "present-frozen");

expectError("absent-with-present-blockers", () => parseGrowthWorkerRouteParityContract(withChanges(fixture, { pageState: "absent", blockers: [...GROWTH_WORKER_ROUTE_PRESENT_BLOCKERS] })), "GROWTH_WORKER_ROUTE_PARITY_BLOCKERS_INVALID");
expectError("present-with-absent-blockers", () => parseGrowthWorkerRouteParityContract(withChanges(fixture, { pageState: "present", blockers: [...GROWTH_WORKER_ROUTE_ABSENT_BLOCKERS] })), "GROWTH_WORKER_ROUTE_PARITY_BLOCKERS_INVALID");
expectError("premature-bridge", () => parseGrowthWorkerRouteParityContract(withChanges(fixture, { bridgeEnabled: true })), "GROWTH_WORKER_ROUTE_PARITY_BRIDGE_PREMATURELY_ENABLED");
expectError("premature-delivery", () => parseGrowthWorkerRouteParityContract(withChanges(fixture, { deliveryEnabled: true })), "GROWTH_WORKER_ROUTE_PARITY_DELIVERY_PREMATURELY_ENABLED");
expectError("unknown-field", () => parseGrowthWorkerRouteParityContract(withChanges(fixture, { unexpected: true })), "GROWTH_WORKER_ROUTE_PARITY_FIELDS_INVALID");
expectError("noncanonical-json", () => parseGrowthWorkerRouteParityJson(JSON.stringify(fixture)), "GROWTH_WORKER_ROUTE_PARITY_JSON_NOT_CANONICAL");
const oppositePageState: GrowthWorkerRoutePageState = fixture.pageState === "absent" ? "present" : "absent";
expectError("page-state-mismatch", () => assertGrowthWorkerRouteParityPageState(fixture, oppositePageState), "GROWTH_WORKER_ROUTE_PARITY_PAGE_STATE_MISMATCH");

const sourceCorpus = boundedCorpus(path.join(root, "src"));
for (const token of [
  "growth_worker_route_parity_v1",
  "growth_worker_proposal_v1",
  "growth_worker_request_v1",
  "growth_worker_bridge_v2",
  "growth_worker_route_inventory_v3",
  "/api/private/growth/worker-proposals",
  "bridgeEnabled: false",
  "externalExecutionEnabled: false",
  "canonicalGrowthPromotionEnabled: false",
  "next_website_ingestion_endpoint_not_implemented",
  "worker_proposal_delivery_not_implemented",
  "cross_repo_contract_tests_not_implemented",
]) assert(sourceCorpus.includes(token), `source-${token}`);
for (const forbidden of [
  "bridgeEnabled: true", "externalExecutionEnabled: true", "canonicalGrowthPromotionEnabled: true",
  "clientBrowserAccess: true", "adminTokenBrowserExposure: true",
]) assert(!sourceCorpus.includes(forbidden), `source-forbids-${forbidden}`);
for (const forbidden of [
  "ADMIN_TOKEN", "EVAVO_GROWTH_WORKER_ADMIN_TOKEN", "EVAVO_GROWTH_WORKER_PROPOSAL_KEYS_JSON",
  "PRIVATE_SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "providerToken",
]) assert(!fixtureRaw.includes(forbidden), `fixture-forbids-${forbidden}`);

const configuredWebsitePath = process.env.EVAVO_NEXT_WEBSITE_REPO_PATH?.trim();
const websiteRoot = configuredWebsitePath ? path.resolve(configuredWebsitePath) : path.resolve(root, "..", "next-website");
const websiteFixturePath = path.join(websiteRoot, "tests", "fixtures", "growth-worker-route-parity-v1.json");
if (fs.existsSync(websiteFixturePath)) {
  const websiteFixtureRaw = fs.readFileSync(websiteFixturePath, "utf8");
  assert(websiteFixtureRaw === fixtureRaw, "sibling-fixture-byte-parity");
  const websitePagePath = path.join(websiteRoot, "src", "pages", "api", "private", "growth", "worker-proposals.ts");
  const actualPageState: GrowthWorkerRoutePageState = fs.existsSync(websitePagePath) ? "present" : "absent";
  assertGrowthWorkerRouteParityPageState(fixture, actualPageState);
  const websiteParserPath = path.join(websiteRoot, "src", "server", "growth-autopilot", "growthWorkerRouteParity.ts");
  assert(fs.existsSync(websiteParserPath), "sibling-parser-present");
  assert(fs.readFileSync(websiteParserPath, "utf8") === fs.readFileSync(path.join(root, "src", "core", "growthWorkerRouteParity.ts"), "utf8"), "sibling-parser-byte-parity");
} else if (configuredWebsitePath) {
  throw new Error(`ASSERTION_FAILED:configured-website-fixture-missing:${websiteFixturePath}`);
}

console.log("Growth route parity contract passed.");
console.log("- one pure parser owns exact route fields, canonical JSON, frozen output and bridge-disabled posture");
console.log("- route inventory v3 distinguishes internal previews from mutations");
console.log("- sibling website fixture, parser bytes and actual page state are checked when the checkout is available");
