import assert from "node:assert/strict";
import test from "node:test";

import {
  BOUNDED_JSON_REQUEST_CONTRACT,
  boundedJsonFailurePayload,
  isExplicitJsonConfirmation,
  readBoundedJsonObject,
} from "../src/core/boundedJsonRequest.ts";

function jsonRequest(body: BodyInit, headers: HeadersInit = {}): Request {
  return new Request("https://worker.example.com/admin/test", {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
    body,
  });
}

test("bounded JSON accepts a compact object and returns a body fingerprint", async () => {
  const result = await readBoundedJsonObject<{ confirm: true; limit: number }>(jsonRequest('{"confirm":true,"limit":3}'));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.contract, BOUNDED_JSON_REQUEST_CONTRACT);
  assert.deepEqual(result.value, { confirm: true, limit: 3 });
  assert.equal(result.bytes, 26);
  assert.match(result.bodySha256, /^[a-f0-9]{64}$/);
  assert.equal(isExplicitJsonConfirmation(result.value), true);
});

test("confirmation is exact and does not accept compatibility coercions", () => {
  assert.equal(isExplicitJsonConfirmation({ confirm: true }), true);
  assert.equal(isExplicitJsonConfirmation({ confirm: 1 }), false);
  assert.equal(isExplicitJsonConfirmation({ confirm: "1" }), false);
  assert.equal(isExplicitJsonConfirmation({ confirm: "true" }), false);
  assert.equal(isExplicitJsonConfirmation([true]), false);
  assert.equal(isExplicitJsonConfirmation(null), false);
});

test("bounded JSON requires a JSON media type", async () => {
  const result = await readBoundedJsonObject(new Request("https://worker.example.com/admin/test", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "{}",
  }));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 415);
  assert.equal(result.error, "json_content_type_required");
  assert.deepEqual(boundedJsonFailurePayload(result), {
    ok: false,
    error: "json_content_type_required",
    requestBodyContract: BOUNDED_JSON_REQUEST_CONTRACT,
    maxBytes: 65_536,
  });
});

test("bounded JSON rejects oversized declared and streamed bodies", async (t) => {
  await t.test("declared length", async () => {
    const request = jsonRequest("{}", { "content-length": "70000" });
    const result = await readBoundedJsonObject(request);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 413);
    assert.equal(result.error, "request_body_too_large");
  });

  await t.test("observed length", async () => {
    const result = await readBoundedJsonObject(jsonRequest(`{"value":"${"x".repeat(300)}"}`), {
      maxBytes: 256,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 413);
    assert.equal(result.error, "request_body_too_large");
    assert.ok(result.bytesRead > 256);
  });
});

test("bounded JSON rejects malformed encodings and non-object roots", async (t) => {
  await t.test("invalid UTF-8", async () => {
    const result = await readBoundedJsonObject(jsonRequest(new Uint8Array([0xff, 0xfe, 0xfd])));
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error, "invalid_utf8_json");
  });

  await t.test("array root", async () => {
    const result = await readBoundedJsonObject(jsonRequest("[]"));
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error, "json_object_required");
  });
});

test("bounded JSON rejects dangerous keys and excessive structure", async (t) => {
  await t.test("prototype-pollution key", async () => {
    const result = await readBoundedJsonObject(jsonRequest('{"nested":{"__proto__":{"enabled":true}}}'));
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error, "forbidden_json_key");
  });

  await t.test("excessive depth", async () => {
    let value: unknown = true;
    for (let index = 0; index < 14; index += 1) value = { next: value };
    const result = await readBoundedJsonObject(jsonRequest(JSON.stringify(value)), { maxDepth: 8 });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error, "json_structure_too_deep");
  });

  await t.test("oversized string", async () => {
    const result = await readBoundedJsonObject(jsonRequest(JSON.stringify({ value: "x".repeat(40) })), { maxStringLength: 16 });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error, "json_string_too_long");
  });
});
