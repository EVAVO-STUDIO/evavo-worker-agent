import assert from "node:assert/strict";
import test from "node:test";

import { growthAutonomyPolicyForProfile } from "../src/core/growthAutonomyPolicy.ts";
import {
  GROWTH_AUTONOMY_POLICY_SYNC_CONTENT_TYPE,
  GROWTH_AUTONOMY_POLICY_SYNC_KEY_REGISTRY_VERSION,
  GROWTH_AUTONOMY_POLICY_SYNC_PATH,
  GROWTH_AUTONOMY_POLICY_SYNC_REQUEST_VERSION,
  GROWTH_AUTONOMY_POLICY_SYNC_VERSION,
  assertVerifiedGrowthAutonomyPolicySyncRequest,
  parseGrowthAutonomyPolicySyncKeyConfiguration,
  verifyGrowthAutonomyPolicySyncRequest,
} from "../src/core/growthAutonomyPolicySync.ts";
import { copyBytesToArrayBuffer } from "../src/core/cryptoBufferSource.ts";

const NOW = new Date("2026-07-27T00:00:00.000Z");
const ORGANISATION_ID = "00000000-0000-4000-8000-000000000101";
const WORKSPACE_ID = "00000000-0000-4000-8000-000000000201";
const OTHER_WORKSPACE_ID = "00000000-0000-4000-8000-000000000202";
const KEY_ID = "growth-policy-key-1";
const SECRET = "worker-policy-sync-test-secret-00000000000000000001";
const REQUEST_ID = "growth-policy-sync-request-0001";
const NONCE = "A".repeat(43);
const ENCODER = new TextEncoder();

async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    copyBytesToArrayBuffer(ENCODER.encode(value)),
  ));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    copyBytesToArrayBuffer(ENCODER.encode(SECRET)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign(
    "HMAC",
    key,
    copyBytesToArrayBuffer(ENCODER.encode(value)),
  ));
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function registry() {
  return parseGrowthAutonomyPolicySyncKeyConfiguration({
    contractVersion: GROWTH_AUTONOMY_POLICY_SYNC_KEY_REGISTRY_VERSION,
    keys: [{
      keyId: KEY_ID,
      secret: SECRET,
      organisationId: ORGANISATION_ID,
      workspaceId: WORKSPACE_ID,
      state: "active",
      notBefore: "2026-07-26T23:00:00.000Z",
      expiresAt: "2026-07-28T00:00:00.000Z",
    }],
  }, { now: NOW });
}

async function signedRequest(workspaceId = WORKSPACE_ID) {
  const policy = growthAutonomyPolicyForProfile("light");
  const policySha256 = await sha256Hex(JSON.stringify(policy));
  const packet = Object.freeze({
    contractVersion: GROWTH_AUTONOMY_POLICY_SYNC_VERSION,
    sourceSystem: "next-website" as const,
    targetSystem: "evavo-worker-agent" as const,
    organisationId: ORGANISATION_ID,
    workspaceId,
    policyVersion: 1,
    sourceUpdatedAt: NOW.toISOString(),
    policySha256,
    idempotencyKey: `growth-autonomy-policy:${ORGANISATION_ID}:${workspaceId}:v1`,
    policy,
  });
  const body = JSON.stringify(packet);
  const bodySha256 = await sha256Hex(body);
  const timestamp = Math.floor(NOW.getTime() / 1_000);
  const canonical = [
    GROWTH_AUTONOMY_POLICY_SYNC_REQUEST_VERSION,
    "POST",
    GROWTH_AUTONOMY_POLICY_SYNC_PATH,
    GROWTH_AUTONOMY_POLICY_SYNC_CONTENT_TYPE,
    KEY_ID,
    REQUEST_ID,
    String(timestamp),
    NONCE,
    bodySha256,
  ].join("\n");
  const signature = await hmacHex(canonical);
  return {
    body,
    bodySha256,
    headers: {
      "content-type": GROWTH_AUTONOMY_POLICY_SYNC_CONTENT_TYPE,
      "x-evavo-growth-policy-sync-contract-version": GROWTH_AUTONOMY_POLICY_SYNC_REQUEST_VERSION,
      "x-evavo-growth-policy-sync-key-id": KEY_ID,
      "x-evavo-growth-policy-sync-request-id": REQUEST_ID,
      "x-evavo-growth-policy-sync-timestamp": String(timestamp),
      "x-evavo-growth-policy-sync-nonce": NONCE,
      "x-evavo-growth-policy-sync-content-sha256": bodySha256,
      "x-evavo-growth-policy-sync-signature": `sha256=${signature}`,
    },
  };
}

test("verified policy sync requests retain tenant-bound canonical evidence", async () => {
  const signing = await signedRequest();
  const verified = await verifyGrowthAutonomyPolicySyncRequest({
    method: "POST",
    pathname: GROWTH_AUTONOMY_POLICY_SYNC_PATH,
    headers: signing.headers,
    rawBody: ENCODER.encode(signing.body),
    keyRegistry: registry(),
    now: NOW,
  });

  assert.doesNotThrow(() => assertVerifiedGrowthAutonomyPolicySyncRequest(verified));
  assert.equal(verified.contractVersion, GROWTH_AUTONOMY_POLICY_SYNC_REQUEST_VERSION);
  assert.equal(verified.packet.organisationId, ORGANISATION_ID);
  assert.equal(verified.packet.workspaceId, WORKSPACE_ID);
  assert.equal(verified.packet.policy.profile, "light");
  assert.equal(verified.bodySha256, signing.bodySha256);
  assert.equal(Object.isFrozen(verified), true);
  assert.equal(Object.isFrozen(verified.packet), true);
});

test("tampered policy bodies and forged verification objects fail closed", async () => {
  const signing = await signedRequest();
  const tampered = signing.body.replace('"profile":"light"', '"profile":"paused"');
  await assert.rejects(
    () => verifyGrowthAutonomyPolicySyncRequest({
      method: "POST",
      pathname: GROWTH_AUTONOMY_POLICY_SYNC_PATH,
      headers: signing.headers,
      rawBody: ENCODER.encode(tampered),
      keyRegistry: registry(),
      now: NOW,
    }),
    /GROWTH_AUTONOMY_POLICY_SYNC_BODY_HASH_MISMATCH/,
  );

  assert.throws(
    () => assertVerifiedGrowthAutonomyPolicySyncRequest({} as never),
    /GROWTH_AUTONOMY_POLICY_SYNC_REQUEST_UNVERIFIED/,
  );
});

test("valid signatures cannot cross the configured tenant boundary", async () => {
  const signing = await signedRequest(OTHER_WORKSPACE_ID);
  await assert.rejects(
    () => verifyGrowthAutonomyPolicySyncRequest({
      method: "POST",
      pathname: GROWTH_AUTONOMY_POLICY_SYNC_PATH,
      headers: signing.headers,
      rawBody: ENCODER.encode(signing.body),
      keyRegistry: registry(),
      now: NOW,
    }),
    /GROWTH_AUTONOMY_POLICY_SYNC_KEY_TENANT_MISMATCH/,
  );

  const summary = registry().summary();
  assert.deepEqual(summary, {
    contractVersion: GROWTH_AUTONOMY_POLICY_SYNC_KEY_REGISTRY_VERSION,
    keyCount: 1,
    activeKeyCount: 1,
    retiringKeyCount: 0,
    tenantCount: 1,
    acceptsRetiringKeys: true,
    exposesSecrets: false,
  });
  assert(!JSON.stringify(summary).includes(SECRET));
});
