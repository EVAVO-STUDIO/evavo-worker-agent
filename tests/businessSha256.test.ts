import assert from "node:assert/strict";
import test from "node:test";

import { businessSha256, businessSha256Bytes } from "../src/core/businessSha256";

test("platform-neutral SHA-256 matches standard vectors", () => {
  assert.equal(businessSha256(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(businessSha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(
    businessSha256Bytes(new TextEncoder().encode("hello")),
    "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  );
});
