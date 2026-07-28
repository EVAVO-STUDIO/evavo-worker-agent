import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const source = fs.readFileSync(path.join(process.cwd(), "src", "index.ts"), "utf8");

test("Worker entrypoint rejects invalid Business read queries before dispatch", () => {
  assert.match(source, /parseBusinessMetadataReadRouteQuery/);
  assert.match(source, /const businessReadQuery = parseBusinessMetadataReadRouteQuery\(url, pathname, req\.method\);/);
  assert.match(source, /if \(businessReadQuery && !businessReadQuery\.ok\) \{/);
  assert.match(source, /return jsonResponse\(businessReadQuery\.payload, \{ status: businessReadQuery\.status \}\);/);

  const guard = source.indexOf("const businessReadQuery = parseBusinessMetadataReadRouteQuery");
  const dispatch = source.indexOf("switch (resolveBusinessRouteHandlerId(pathname))");
  assert.equal(guard >= 0 && dispatch > guard, true);
});
