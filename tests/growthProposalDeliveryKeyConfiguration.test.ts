import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import type { GrowthProposalPacket } from "../src/core/growthProposalPacket.ts";
import {
  GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_MAX_BYTES,
  GrowthProposalDeliveryKeyConfigurationError,
  assertGrowthProposalDeliveryKeyRegistry,
  parseGrowthProposalDeliveryKeyConfiguration,
  parseGrowthProposalDeliveryKeyConfigurationJson,
} from "../src/core/growthProposalDeliveryKeyConfiguration.ts";
import {
  signGrowthProposalRequest,
  type SignedGrowthProposalRequest,
} from "../src/core/growthProposalRequestSignature.ts";

const NOW = new Date("2026-07-24T04:00:00.000Z");
const ORGANISATION_A = "00000000-0000-4000-8000-000000000101";
const WORKSPACE_A = "00000000-0000-4000-8000-000000000201";
const ORGANISATION_B = "00000000-0000-4000-8000-000000000102";
const WORKSPACE_B = "00000000-0000-4000-8000-000000000202";
const keyFixturePath = path.join(process.cwd(), "fixtures/growth-worker-key-registry-v1.json");
const proposalFixturePath = path.join(process.cwd(), "fixtures/growth-worker-proposal-v1.json");
const requestFixturePath = path.join(process.cwd(), "fixtures/growth-worker-request-v1.json");
const keyFixtureText = fs.readFileSync(keyFixturePath, "utf8");
const keyFixture = JSON.parse(keyFixtureText) as { contractVersion: string; keys: Array<Record<string, unknown>> };
const canonicalKeyFixtureText = JSON.stringify(keyFixture);
const proposalFixture = JSON.parse(fs.readFileSync(proposalFixturePath, "utf8")) as GrowthProposalPacket;
const requestFixture = JSON.parse(fs.readFileSync(requestFixturePath, "utf8")) as SignedGrowthProposalRequest;

type MutableRecord = Record<string, unknown>;

function cloneFixture(): { contractVersion: string; keys: Array<Record<string, unknown>> } {
  return JSON.parse(JSON.stringify(keyFixture)) as { contractVersion: string; keys: Array<Record<string, unknown>> };
}

function expectError(
  label: string,
  value: unknown,
  expectedCode: string,
  expectedField?: string,
): void {
  let observed: GrowthProposalDeliveryKeyConfigurationError | null = null;
  try {
    parseGrowthProposalDeliveryKeyConfiguration(value, { now: NOW });
  } catch (error) {
    if (error instanceof GrowthProposalDeliveryKeyConfigurationError) observed = error;
  }
  assert.equal(observed?.code, expectedCode, `${label}-code`);
  if (expectedField) assert.equal(observed?.field, expectedField, `${label}-field`);
}

test("canonical delivery key fixture selects the active tenant key and hides credentials", () => {
  assert.equal(`${JSON.stringify(keyFixture, null, 2)}\n`, keyFixtureText);
  const registry = parseGrowthProposalDeliveryKeyConfiguration(keyFixture, { now: NOW });
  assert.equal(registry.contractVersion, "growth_worker_key_registry_v1");
  assert.equal(registry.keyCount, 3);
  assert.equal(registry.activeKeyCount, 2);
  assert.equal(registry.retiringKeyCount, 1);
  assert.equal(registry.tenantCount, 2);
  assert.equal(registry.acceptsRetiringKeysForVerificationOnly, true);
  assert.equal(registry.selectsRetiringKeysForSigning, false);
  assert.equal(registry.exposesSecrets, false);
  assert.equal(Object.isFrozen(registry), true);
  assertGrowthProposalDeliveryKeyRegistry(registry);

  const primary = registry.activeSigningKeyForTenant(ORGANISATION_A.toUpperCase(), WORKSPACE_A.toUpperCase());
  assert.deepEqual(primary, {
    keyId: "worker-primary-2026-07",
    secret: "test-only-growth-worker-bridge-secret-000000000000000001",
    organisationId: ORGANISATION_A,
    workspaceId: WORKSPACE_A,
  });
  assert.equal(Object.isFrozen(primary), true);
  assert.equal(registry.hasRetiringKeyForTenant(ORGANISATION_A, WORKSPACE_A), true);
  assert.equal(registry.activeSigningKeyForTenant(ORGANISATION_B, WORKSPACE_B)?.keyId, "worker-secondary-2026-07");
  assert.equal(registry.hasRetiringKeyForTenant(ORGANISATION_B, WORKSPACE_B), false);
  assert.equal(registry.activeSigningKeyForTenant(ORGANISATION_A, WORKSPACE_B), null);

  const summary = registry.summary();
  assert.equal(Object.isFrozen(summary), true);
  assert.deepEqual(JSON.parse(JSON.stringify(registry)), summary);
  const serialised = JSON.stringify(registry);
  for (const forbidden of [
    "worker-primary-2026-07",
    "worker-retiring-2026-06",
    ORGANISATION_A,
    WORKSPACE_A,
    "test-only-growth-worker-bridge-secret",
    "test-only-growth-worker-retiring-secret",
  ]) {
    assert.equal(serialised.includes(forbidden), false, `summary excludes ${forbidden}`);
  }
});

test("selected active key reproduces the canonical signed request fixture", async () => {
  const registry = parseGrowthProposalDeliveryKeyConfigurationJson(canonicalKeyFixtureText, { now: NOW });
  const key = registry.activeSigningKeyForTenant(ORGANISATION_A, WORKSPACE_A);
  assert.ok(key);
  const signed = await signGrowthProposalRequest({
    packet: proposalFixture,
    keyId: key.keyId,
    secret: key.secret,
    requestId: requestFixture.requestId,
    timestamp: requestFixture.timestamp,
    nonce: requestFixture.nonce,
    now: NOW,
  });
  assert.deepEqual(signed, requestFixture);
  assert.equal(signed.bodySha256, requestFixture.bodySha256);
  assert.equal(signed.headers["x-evavo-growth-signature"], requestFixture.headers["x-evavo-growth-signature"]);
  assert.equal(JSON.stringify(signed).includes(key.secret), false);
});

test("structural registry forgeries fail closed", () => {
  const registry = parseGrowthProposalDeliveryKeyConfiguration(keyFixture, { now: NOW });
  const forged: MutableRecord = {
    ...registry.summary(),
    activeSigningKeyForTenant: () => ({
      keyId: "forged-key",
      secret: "forged-secret-000000000000000000000000000001",
      organisationId: ORGANISATION_A,
      workspaceId: WORKSPACE_A,
    }),
  };
  assert.throws(
    () => assertGrowthProposalDeliveryKeyRegistry(forged),
    (error: unknown) => error instanceof GrowthProposalDeliveryKeyConfigurationError
      && error.code === "GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_REGISTRY_REQUIRED",
  );
});

test("delivery key parser rejects malformed, unsafe and ambiguous rotation registries", async (t) => {
  const cases: ReadonlyArray<readonly [string, () => unknown, string, string?]> = [
    ["not-object", () => null, "GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_OBJECT_REQUIRED", "configuration"],
    ["unknown-registry-field", () => ({ ...cloneFixture(), unexpected: true }), "GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_FIELD_SET_INVALID", "configuration"],
    ["wrong-version", () => ({ ...cloneFixture(), contractVersion: "growth_worker_key_registry_v2" }), "GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_VERSION_INVALID", "contractVersion"],
    ["empty-keys", () => ({ ...cloneFixture(), keys: [] }), "GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_COUNT_INVALID", "keys"],
    ["unknown-key-field", () => {
      const value = cloneFixture();
      value.keys[0] = { ...value.keys[0], rawSecretReference: "bad" };
      return value;
    }, "GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_FIELD_SET_INVALID", "keys[0]"],
    ["path-key-id", () => {
      const value = cloneFixture();
      value.keys[0]!.keyId = "worker/primary/2026";
      return value;
    }, "GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_KEY_ID_INVALID", "keyId"],
    ["traversal-key-id", () => {
      const value = cloneFixture();
      value.keys[0]!.keyId = "worker..primary";
      return value;
    }, "GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_KEY_ID_INVALID", "keyId"],
    ["weak-secret", () => {
      const value = cloneFixture();
      value.keys[0]!.secret = "short";
      return value;
    }, "GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_SECRET_INVALID", "secret"],
    ["invalid-tenant", () => {
      const value = cloneFixture();
      value.keys[0]!.organisationId = "not-a-uuid";
      return value;
    }, "GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_UUID_INVALID", "organisationId"],
    ["invalid-state", () => {
      const value = cloneFixture();
      value.keys[0]!.state = "staged";
      return value;
    }, "GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_STATE_INVALID", "state"],
    ["future-not-before", () => {
      const value = cloneFixture();
      value.keys[0]!.notBefore = "2026-07-24T04:00:01.000Z";
      return value;
    }, "GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_NOT_ACTIVE", "keys[0]"],
    ["expired", () => {
      const value = cloneFixture();
      value.keys[0]!.expiresAt = "2026-07-24T03:59:59.000Z";
      return value;
    }, "GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_EXPIRED", "keys[0]"],
    ["active-expiry-too-soon", () => {
      const value = cloneFixture();
      value.keys[0]!.expiresAt = "2026-07-24T04:04:59.000Z";
      return value;
    }, "GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_ACTIVE_EXPIRY_TOO_SOON", "keys[0]"],
    ["retiring-too-long", () => {
      const value = cloneFixture();
      value.keys[1]!.expiresAt = "2026-08-01T04:00:01.000Z";
      return value;
    }, "GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_RETIRING_WINDOW_INVALID", "keys[1]"],
    ["duplicate-key-id", () => {
      const value = cloneFixture();
      value.keys[2]!.keyId = value.keys[0]!.keyId;
      return value;
    }, "GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_KEY_ID_DUPLICATE", "keyId"],
    ["reused-secret", () => {
      const value = cloneFixture();
      value.keys[2]!.secret = value.keys[0]!.secret;
      return value;
    }, "GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_SECRET_REUSED", "secret"],
    ["two-active-same-tenant", () => {
      const value = cloneFixture();
      value.keys[1]!.state = "active";
      return value;
    }, "GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_ACTIVE_KEY_REQUIRED", `${ORGANISATION_A}:${WORKSPACE_A}`],
    ["retiring-without-active", () => {
      const value = cloneFixture();
      value.keys = [value.keys[1]!];
      return value;
    }, "GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_ACTIVE_KEY_REQUIRED", `${ORGANISATION_A}:${WORKSPACE_A}`],
  ];
  for (const [label, build, code, field] of cases) {
    await t.test(label, () => expectError(label, build(), code, field));
  }
});

test("delivery key JSON parser is exact and bounded", () => {
  const parsed = parseGrowthProposalDeliveryKeyConfigurationJson(canonicalKeyFixtureText, { now: NOW });
  assert.equal(parsed.activeSigningKeyForTenant(ORGANISATION_A, WORKSPACE_A)?.keyId, "worker-primary-2026-07");

  for (const [label, raw, expected] of [
    ["empty", "", "GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_JSON_INVALID"],
    ["leading-space", ` ${canonicalKeyFixtureText}`, "GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_JSON_INVALID"],
    ["invalid-json", "{not-json", "GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_JSON_INVALID"],
    ["oversized", "x".repeat(GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_MAX_BYTES + 1), "GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_JSON_TOO_LARGE"],
  ] as const) {
    assert.throws(
      () => parseGrowthProposalDeliveryKeyConfigurationJson(raw, { now: NOW }),
      (error: unknown) => error instanceof GrowthProposalDeliveryKeyConfigurationError && error.code === expected,
      label,
    );
  }
});

test("invalid parser clock fails closed", () => {
  assert.throws(
    () => parseGrowthProposalDeliveryKeyConfiguration(keyFixture, { now: new Date(Number.NaN) }),
    (error: unknown) => error instanceof GrowthProposalDeliveryKeyConfigurationError
      && error.code === "GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_NOW_INVALID",
  );
});
