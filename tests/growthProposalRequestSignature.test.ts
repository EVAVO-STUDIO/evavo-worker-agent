import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import type { GrowthProposalPacket } from "../src/core/growthProposalPacket.ts";
import {
  GROWTH_PROPOSAL_REQUEST_CONTRACT_VERSION,
  GROWTH_PROPOSAL_REQUEST_HEADERS,
  GROWTH_PROPOSAL_REQUEST_PATH,
  canonicalGrowthProposalRequest,
  createGrowthProposalRequestNonce,
  signGrowthProposalRequest,
  type SignedGrowthProposalRequest,
} from "../src/core/growthProposalRequestSignature.ts";

const NOW = new Date("2026-07-24T04:00:00.000Z");
const TIMESTAMP = Math.floor(NOW.getTime() / 1_000);
const KEY_ID = "worker-primary-2026-07";
const REQUEST_ID = "worker-request:proposal:000000000001";
const SECRET = "test-only-growth-worker-bridge-secret-000000000000000001";
const NONCE = Buffer.alloc(32, 7).toString("base64url");
const proposalFixture = JSON.parse(fs.readFileSync(
  path.join(process.cwd(), "fixtures/growth-worker-proposal-v1.json"),
  "utf8",
)) as GrowthProposalPacket;
const signedFixturePath = path.join(process.cwd(), "fixtures/growth-worker-request-v1.json");
const signedFixtureText = fs.readFileSync(signedFixturePath, "utf8");
const signedFixture = JSON.parse(signedFixtureText) as SignedGrowthProposalRequest;

async function expectError(label: string, run: () => unknown | Promise<unknown>, expected: string): Promise<void> {
  let observed = "";
  try {
    await run();
  } catch (error) {
    observed = error instanceof Error ? error.message : String(error);
  }
  assert.equal(observed, expected, label);
}

function sign(overrides: Partial<Parameters<typeof signGrowthProposalRequest>[0]> = {}) {
  return signGrowthProposalRequest({
    packet: proposalFixture,
    keyId: KEY_ID,
    secret: SECRET,
    requestId: REQUEST_ID,
    timestamp: TIMESTAMP,
    nonce: NONCE,
    now: NOW,
    ...overrides,
  });
}

test("signed Growth proposal request matches independent HMAC and canonical cross-repository fixture", async () => {
  const signed = await sign();
  const expectedBody = JSON.stringify(proposalFixture);
  const expectedBodyHash = createHash("sha256").update(expectedBody, "utf8").digest("hex");
  const expectedCanonical = [
    "version:growth_worker_request_v1",
    "method:POST",
    "path:/api/private/growth/worker-proposals",
    "content-type:application/json",
    `key-id:${KEY_ID}`,
    `request-id:${REQUEST_ID}`,
    `timestamp:${TIMESTAMP}`,
    `nonce:${NONCE}`,
    `content-sha256:${expectedBodyHash}`,
  ].join("\n");
  const expectedSignature = createHmac("sha256", SECRET).update(expectedCanonical, "utf8").digest("hex");

  assert.equal(GROWTH_PROPOSAL_REQUEST_CONTRACT_VERSION, "growth_worker_request_v1");
  assert.equal(GROWTH_PROPOSAL_REQUEST_PATH, "/api/private/growth/worker-proposals");
  assert.equal(signed.contractVersion, "growth_worker_request_v1");
  assert.equal(signed.method, "POST");
  assert.equal(signed.pathname, "/api/private/growth/worker-proposals");
  assert.equal(signed.contentType, "application/json");
  assert.equal(signed.keyId, KEY_ID);
  assert.equal(signed.requestId, REQUEST_ID);
  assert.equal(signed.timestamp, TIMESTAMP);
  assert.equal(signed.signedAt, "2026-07-24T04:00:00.000Z");
  assert.equal(signed.nonce, NONCE);
  assert.equal(signed.body, expectedBody);
  assert.equal(signed.bodySha256, expectedBodyHash);
  assert.equal(canonicalGrowthProposalRequest({
    keyId: KEY_ID,
    requestId: REQUEST_ID,
    timestamp: TIMESTAMP,
    nonce: NONCE,
    bodySha256: expectedBodyHash,
  }), expectedCanonical);
  assert.deepEqual(signed.headers, {
    "content-type": "application/json",
    [GROWTH_PROPOSAL_REQUEST_HEADERS.contractVersion]: "growth_worker_request_v1",
    [GROWTH_PROPOSAL_REQUEST_HEADERS.keyId]: KEY_ID,
    [GROWTH_PROPOSAL_REQUEST_HEADERS.requestId]: REQUEST_ID,
    [GROWTH_PROPOSAL_REQUEST_HEADERS.timestamp]: String(TIMESTAMP),
    [GROWTH_PROPOSAL_REQUEST_HEADERS.nonce]: NONCE,
    [GROWTH_PROPOSAL_REQUEST_HEADERS.bodySha256]: expectedBodyHash,
    [GROWTH_PROPOSAL_REQUEST_HEADERS.signature]: `sha256=${expectedSignature}`,
  });
  assert.deepEqual(signed, signedFixture);
  assert.equal(`${JSON.stringify(signedFixture, null, 2)}\n`, signedFixtureText);
  assert.equal(signedFixture.body, expectedBody);
  assert.equal(signedFixture.bodySha256, expectedBodyHash);
  assert.equal(signedFixture.headers[GROWTH_PROPOSAL_REQUEST_HEADERS.signature], `sha256=${expectedSignature}`);
  assert.equal(Object.isFrozen(signed), true);
  assert.equal(Object.isFrozen(signed.headers), true);
  assert.equal(signed.body.includes(SECRET), false);
  assert.equal(JSON.stringify(signed).includes(SECRET), false);
  assert.equal(signed.body.endsWith("\n"), false);
});

test("generated request nonces are canonical 32-byte base64url values", () => {
  const first = createGrowthProposalRequestNonce();
  const second = createGrowthProposalRequestNonce();
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.match(second, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(Buffer.from(first, "base64url").byteLength, 32);
  assert.equal(Buffer.from(second, "base64url").byteLength, 32);
  assert.notEqual(first, second);
});

test("signer rejects noncanonical or execution-requesting packets", async (t) => {
  await t.test("unknown packet field", async () => {
    await expectError(
      "unknown packet field",
      () => sign({ packet: { ...proposalFixture, unexpected: true } as GrowthProposalPacket }),
      "GROWTH_PROPOSAL_REQUEST_PACKET_FIELDS_INVALID",
    );
  });
  await t.test("unknown evidence field", async () => {
    const firstEvidence = proposalFixture.evidenceItems[0];
    assert.ok(firstEvidence);
    await expectError(
      "unknown evidence field",
      () => sign({
        packet: {
          ...proposalFixture,
          evidenceItems: [{ ...firstEvidence, rawProviderPayload: true }],
        } as GrowthProposalPacket,
      }),
      "GROWTH_PROPOSAL_REQUEST_EVIDENCE_FIELDS_INVALID",
    );
  });
  for (const [label, packet] of [
    ["execution flag", { ...proposalFixture, externalExecutionRequested: true }],
    ["promotion flag", { ...proposalFixture, canonicalPromotionRequested: true }],
    ["execution mode", { ...proposalFixture, proposalMode: "execute" }],
    ["wrong version", { ...proposalFixture, contractVersion: "growth_worker_proposal_v2" }],
    ["wrong source", { ...proposalFixture, sourceSystem: "unknown-worker" }],
  ] as const) {
    await t.test(label, async () => {
      await expectError(
        label,
        () => sign({ packet: packet as unknown as GrowthProposalPacket }),
        "GROWTH_PROPOSAL_REQUEST_PACKET_NOT_CANONICAL",
      );
    });
  }
  await t.test("reordered packet", async () => {
    const reordered = Object.fromEntries(Object.entries(proposalFixture).reverse()) as unknown as GrowthProposalPacket;
    await expectError(
      "reordered packet",
      () => sign({ packet: reordered }),
      "GROWTH_PROPOSAL_REQUEST_PACKET_NOT_CANONICAL",
    );
  });
});

test("signer rejects unsafe credential, identifier, nonce and timestamp inputs", async (t) => {
  const cases: ReadonlyArray<readonly [string, Partial<Parameters<typeof signGrowthProposalRequest>[0]>, string]> = [
    ["short secret", { secret: "short-secret" }, "GROWTH_PROPOSAL_REQUEST_SECRET_INVALID"],
    ["trimmed secret", { secret: ` ${SECRET}` }, "GROWTH_PROPOSAL_REQUEST_SECRET_INVALID"],
    ["path key ID", { keyId: "worker/primary/2026" }, "GROWTH_PROPOSAL_REQUEST_KEY_ID_INVALID"],
    ["traversal key ID", { keyId: "worker..primary" }, "GROWTH_PROPOSAL_REQUEST_KEY_ID_INVALID"],
    ["short request ID", { requestId: "short" }, "GROWTH_PROPOSAL_REQUEST_ID_INVALID"],
    ["path request ID", { requestId: "worker/request/proposal/000000000001" }, "GROWTH_PROPOSAL_REQUEST_ID_INVALID"],
    ["traversal request ID", { requestId: "worker-request:../proposal:000000000001" }, "GROWTH_PROPOSAL_REQUEST_ID_INVALID"],
    ["short nonce", { nonce: "short" }, "GROWTH_PROPOSAL_REQUEST_NONCE_INVALID"],
    ["noncanonical nonce", { nonce: `${NONCE}=` }, "GROWTH_PROPOSAL_REQUEST_NONCE_INVALID"],
    ["stale signing timestamp", { timestamp: TIMESTAMP - 31 }, "GROWTH_PROPOSAL_REQUEST_TIMESTAMP_INVALID"],
    ["future signing timestamp", { timestamp: TIMESTAMP + 31 }, "GROWTH_PROPOSAL_REQUEST_TIMESTAMP_INVALID"],
    ["fractional timestamp", { timestamp: TIMESTAMP + 0.5 }, "GROWTH_PROPOSAL_REQUEST_TIMESTAMP_INVALID"],
    ["invalid clock", { now: new Date(Number.NaN) }, "GROWTH_PROPOSAL_REQUEST_TIME_INVALID"],
  ];
  for (const [label, overrides, expected] of cases) {
    await t.test(label, async () => {
      await expectError(label, () => sign(overrides), expected);
    });
  }
});

test("canonical request builder rejects malformed values independently", async () => {
  const bodyHash = createHash("sha256").update(JSON.stringify(proposalFixture), "utf8").digest("hex");
  await expectError(
    "uppercase body hash",
    () => canonicalGrowthProposalRequest({
      keyId: KEY_ID,
      requestId: REQUEST_ID,
      timestamp: TIMESTAMP,
      nonce: NONCE,
      bodySha256: bodyHash.toUpperCase(),
    }),
    "GROWTH_PROPOSAL_REQUEST_BODY_HASH_INVALID",
  );
  await expectError(
    "unsafe request ID",
    () => canonicalGrowthProposalRequest({
      keyId: KEY_ID,
      requestId: "worker-request:../proposal:000000000001",
      timestamp: TIMESTAMP,
      nonce: NONCE,
      bodySha256: bodyHash,
    }),
    "GROWTH_PROPOSAL_REQUEST_ID_INVALID",
  );
});
