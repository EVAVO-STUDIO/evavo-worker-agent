import assert from "node:assert/strict";
import test from "node:test";

import { businessHmacSha256, businessSha256 } from "../src/core/businessSha256";

test("SHA-256 remains aligned to standard vectors", () => {
  assert.equal(
    businessSha256("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("HMAC-SHA256 matches RFC 4231 test case 1", () => {
  assert.equal(
    businessHmacSha256("\x0b".repeat(20), "Hi There"),
    "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7",
  );
});

test("HMAC-SHA256 matches RFC 4231 test case 2", () => {
  assert.equal(
    businessHmacSha256("Jefe", "what do ya want for nothing?"),
    "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
  );
});
