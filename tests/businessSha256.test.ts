import assert from "node:assert/strict";
import test from "node:test";

import { businessSha256 } from "../src/core/businessSha256";

test("platform-neutral SHA-256 matches standard vectors", () => {
  assert.equal(businessSha256(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(businessSha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
