import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const sourcePath = path.join(root, "src/core/growthProposalDeliveryKeyConfiguration.ts");
const dispatcherPath = path.join(root, "src/index.ts");
const wranglerPath = path.join(root, "wrangler.toml");

const source = fs.readFileSync(sourcePath, "utf8");
const dispatcher = fs.readFileSync(dispatcherPath, "utf8");
const wrangler = fs.readFileSync(wranglerPath, "utf8");

function occurrences(content: string, token: string): number {
  return content.split(token).length - 1;
}

test("delivery key selector remains a pure parser and tenant key selector", () => {
  for (const token of [
    'GROWTH_PROPOSAL_DELIVERY_KEY_REGISTRY_VERSION = "growth_worker_key_registry_v1"',
    'GROWTH_PROPOSAL_DELIVERY_KEYS_BINDING = "EVAVO_GROWTH_WORKER_PROPOSAL_KEYS_JSON"',
    "GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_MAX_BYTES = 16_000",
    "GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_MAX_KEYS = 8",
    "GROWTH_PROPOSAL_DELIVERY_KEY_MAX_LIFETIME_MS = 180 * 24 * 60 * 60 * 1_000",
    "GROWTH_PROPOSAL_DELIVERY_RETIRING_MAX_REMAINING_MS = 7 * 24 * 60 * 60 * 1_000",
    "GROWTH_PROPOSAL_DELIVERY_ACTIVE_MIN_REMAINING_MS = 5 * 60 * 1_000",
    "activeSigningKeyForTenant",
    "hasRetiringKeyForTenant",
    "acceptsRetiringKeysForVerificationOnly: true",
    "selectsRetiringKeysForSigning: false",
    "exposesSecrets: false",
    "parseGrowthProposalDeliveryKeyConfiguration",
    "parseGrowthProposalDeliveryKeyConfigurationJson",
  ]) {
    assert.equal(source.includes(token), true, `missing source contract token: ${token}`);
  }

  const forbiddenPatterns: ReadonlyArray<readonly [string, RegExp]> = [
    ["static or dynamic imports", /^\s*import(?:\s|\()/m],
    ["network fetch", /\bfetch\s*\(/],
    ["request construction", /\bnew\s+Request\s*\(/],
    ["response construction", /\bnew\s+Response\s*\(/],
    ["Node environment access", /\bprocess\.env\b/],
    ["Worker environment property access", /\benv\.[A-Za-z_$]/],
    ["D1 database access", /\bD1Database\b|\benv\.DB\b/],
    ["scheduled entrypoint", /\bscheduled\s*\(/],
    ["waitUntil orchestration", /\bwaitUntil\s*\(/],
    ["timer orchestration", /\bset(?:Timeout|Interval)\s*\(/],
    ["admin credential", /\bADMIN_TOKEN\b/],
    ["HTTP ingest route", /\/api\/private\/growth\/worker-proposals/],
    ["proposal request signing", /\bsignGrowthProposalRequest\b/],
    ["proposal packet creation", /\bbuildGrowthProposalPacket\b/],
    ["Web Crypto signing", /\bcrypto\.subtle\b/],
    ["nonce generation", /\bgetRandomValues\b/],
    ["runtime logging", /\bconsole\./],
    ["external execution flag", /externalExecutionRequested\s*:\s*true/],
    ["canonical promotion flag", /canonicalPromotionRequested\s*:\s*true/],
  ];

  for (const [label, pattern] of forbiddenPatterns) {
    assert.equal(pattern.test(source), false, `delivery key selector gained forbidden ${label}`);
  }
});

test("delivery key registries can only be created by the validated parser", () => {
  assert.equal(source.includes('const REGISTRY_CONSTRUCTION_TOKEN = Symbol("growth-proposal-delivery-key-registry")'), true);
  assert.equal(source.includes("const VERIFIED_REGISTRIES = new WeakSet<object>()"), true);
  assert.equal(
    source.includes("class GrowthProposalDeliveryKeyRegistryImplementation implements GrowthProposalDeliveryKeyRegistry"),
    true,
  );
  assert.equal(source.includes("export class GrowthProposalDeliveryKeyRegistryImplementation"), false);
  assert.equal(occurrences(source, "new GrowthProposalDeliveryKeyRegistryImplementation("), 1);
  assert.equal(source.includes("REGISTRY_CONSTRUCTION_TOKEN,"), true);
  assert.equal(source.includes("VERIFIED_REGISTRIES.has(value as object)"), true);

  const classStart = source.indexOf("class GrowthProposalDeliveryKeyRegistryImplementation");
  const classEnd = source.indexOf("export function assertGrowthProposalDeliveryKeyRegistry", classStart);
  assert.ok(classStart >= 0 && classEnd > classStart, "registry implementation section is isolatable");
  const classSection = source.slice(classStart, classEnd);
  const brandIndex = classSection.indexOf("VERIFIED_REGISTRIES.add(this)");
  const freezeIndex = classSection.indexOf("Object.freeze(this)");
  assert.ok(brandIndex >= 0 && freezeIndex > brandIndex, "registry is branded before it is frozen");
});

test("retiring keys cannot be selected or exposed for new Worker request signing", () => {
  assert.equal(source.includes("#activeByTenant"), true);
  assert.equal(source.includes("#retiringTenants"), true);
  assert.equal(source.includes("verificationKeys("), false);
  assert.equal(source.includes("resolveVerificationKey("), false);
  assert.equal(source.includes("#keysById"), false);

  const classStart = source.indexOf("class GrowthProposalDeliveryKeyRegistryImplementation");
  const selectorStart = source.indexOf("activeSigningKeyForTenant(", classStart);
  const selectorEnd = source.indexOf("hasRetiringKeyForTenant(", selectorStart);
  assert.ok(classStart >= 0 && selectorStart >= classStart && selectorEnd > selectorStart, "active selector section is isolatable");
  const selector = source.slice(selectorStart, selectorEnd);
  assert.equal(selector.includes("this.#activeByTenant.get"), true);
  assert.equal(selector.includes("retiring"), false);
});

test("delivery key selection is not wired into the Worker dispatcher or runtime configuration", () => {
  for (const forbidden of [
    "growthProposalDeliveryKeyConfiguration",
    "GROWTH_PROPOSAL_DELIVERY_KEYS_BINDING",
    "EVAVO_GROWTH_WORKER_PROPOSAL_KEYS_JSON",
    "signGrowthProposalRequest",
    "/api/private/growth/worker-proposals",
  ]) {
    assert.equal(dispatcher.includes(forbidden), false, `dispatcher unexpectedly references ${forbidden}`);
  }

  for (const forbidden of [
    "EVAVO_GROWTH_WORKER_PROPOSAL_KEYS_JSON",
    "GROWTH_WORKER_PROPOSAL_SECRET",
    "GROWTH_PROPOSAL_DELIVERY_URL",
  ]) {
    assert.equal(wrangler.includes(forbidden), false, `wrangler configuration unexpectedly enables ${forbidden}`);
  }
});
