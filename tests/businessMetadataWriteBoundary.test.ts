import assert from "node:assert/strict";
import test from "node:test";

import {
  BUSINESS_METADATA_WRITE_BOUNDARY_CONTRACT,
  readBusinessMetadataWriteRequest,
} from "../src/core/businessMetadataWriteBoundary";

const fields = new Set([
  "id",
  "name",
  "fitScore",
  "priorityScore",
  "active",
  "tags",
  "metadata",
  "scoreDelta",
]);

function request(body: unknown, query = ""): Request {
  return new Request(`https://worker.example/admin/business/test${query}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function options() {
  return {
    entityKey: "organization",
    allowedEntityFields: fields,
    requiredTextFields: new Set(["name"]),
    textFields: new Set(["id", "name"]),
    arrayFields: new Set(["tags"]),
    objectFields: new Set(["metadata"]),
    booleanFields: new Set(["active"]),
    numberFields: {
      fitScore: { min: 0, max: 100 },
      priorityScore: { min: 0, max: 100 },
      scoreDelta: { min: -10, max: 10 },
    },
  } as const;
}

test("accepts exact confirmation, explicit zero and explicit null", async () => {
  const result = await readBusinessMetadataWriteRequest(request({
    confirm: true,
    organization: {
      id: "org-1",
      name: "Example Co",
      fitScore: 0,
      priorityScore: null,
      active: true,
      tags: ["reviewed"],
      metadata: { source: "operator" },
      scoreDelta: -2,
    },
  }), options());

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.entity.fitScore, 0);
  assert.equal(result.entity.priorityScore, null);
  assert.equal(result.requestReceipt.boundaryContract, BUSINESS_METADATA_WRITE_BOUNDARY_CONTRACT);
  assert.equal(result.requestReceipt.bodyHashAvailable, true);
  assert.equal(result.requestReceipt.bytes > 0, true);
});

test("rejects query confirmation before reading the body", async () => {
  const result = await readBusinessMetadataWriteRequest(
    request({ confirm: true, organization: { name: "Example Co" } }, "?confirm=1"),
    options(),
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 400);
  assert.equal(result.payload.error, "query_not_supported");
  assert.equal(result.payload.queryConfirmationAllowed, false);
  assert.equal(result.payload.rawInputExposed, false);
});

test("rejects unsupported media types with a finite non-echoing 415 response", async () => {
  const result = await readBusinessMetadataWriteRequest(new Request(
    "https://worker.example/admin/business/test",
    {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "must-not-leak",
    },
  ), options());

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 415);
  assert.equal(result.payload.error, "json_content_type_required");
  assert.equal(result.payload.rawInputExposed, false);
  assert.equal(result.payload.externalExecutionAllowed, false);
  assert.equal(JSON.stringify(result.payload).includes("must-not-leak"), false);
});

test("rejects coercive confirmations", async () => {
  for (const confirm of [1, "1", false, null]) {
    const result = await readBusinessMetadataWriteRequest(
      request({ confirm, organization: { name: "Example Co" } }),
      options(),
    );
    assert.equal(result.ok, false, String(confirm));
    if (!result.ok) {
      assert.equal(result.payload.error, "confirm_required");
      assert.equal(result.payload.confirmationCoercionAllowed, false);
    }
  }
});

test("rejects unknown top-level and entity fields", async () => {
  const topLevel = await readBusinessMetadataWriteRequest(request({
    confirm: true,
    organization: { name: "Example Co" },
    debug: true,
  }), options());
  assert.equal(topLevel.ok, false);
  if (!topLevel.ok) {
    assert.equal(topLevel.payload.error, "unsupported_request_fields");
    assert.deepEqual(topLevel.payload.fields, ["debug"]);
  }

  const entity = await readBusinessMetadataWriteRequest(request({
    confirm: true,
    organization: { name: "Example Co", unexpected: true },
  }), options());
  assert.equal(entity.ok, false);
  if (!entity.ok) {
    assert.equal(entity.payload.error, "unsupported_entity_fields");
    assert.deepEqual(entity.payload.fields, ["unexpected"]);
  }
});

test("rejects nested sensitive keys without echoing input", async () => {
  const secret = "must-not-leak";
  const result = await readBusinessMetadataWriteRequest(request({
    confirm: true,
    organization: {
      name: "Example Co",
      metadata: { nested: { apiToken: secret } },
    },
  }), options());

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.payload.error, "forbidden_business_input_key");
    assert.equal(result.payload.rawInputExposed, false);
    assert.equal(JSON.stringify(result.payload).includes(secret), false);
  }
});

test("rejects malformed field types and out-of-range numbers", async () => {
  const cases: Array<[Record<string, unknown>, string, string]> = [
    [{ name: 4 }, "required_text_invalid", "name"],
    [{ name: "Example", tags: "not-array" }, "array_field_invalid", "tags"],
    [{ name: "Example", metadata: [] }, "object_field_invalid", "metadata"],
    [{ name: "Example", active: "yes" }, "boolean_field_invalid", "active"],
    [{ name: "Example", fitScore: "0" }, "number_field_invalid", "fitScore"],
    [{ name: "Example", fitScore: 101 }, "number_field_invalid", "fitScore"],
    [{ name: "Example", scoreDelta: -11 }, "number_field_invalid", "scoreDelta"],
  ];

  for (const [organization, error, field] of cases) {
    const result = await readBusinessMetadataWriteRequest(
      request({ confirm: true, organization }),
      options(),
    );
    assert.equal(result.ok, false, JSON.stringify(organization));
    if (!result.ok) {
      assert.equal(result.payload.error, error);
      assert.equal(result.payload.field, field);
    }
  }
});

test("rejects oversized request bodies with a finite safe payload", async () => {
  const result = await readBusinessMetadataWriteRequest(request({
    confirm: true,
    organization: { name: "Example", metadata: { note: "x".repeat(40_000) } },
  }), options());

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 413);
    assert.equal(result.payload.error, "request_body_too_large");
    assert.equal(result.payload.rawInputExposed, false);
    assert.equal(JSON.stringify(result.payload).length < 2_000, true);
  }
});
