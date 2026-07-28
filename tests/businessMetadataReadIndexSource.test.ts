import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const source = fs.readFileSync(path.join(process.cwd(), "src", "index.ts"), "utf8");

test("Worker entrypoint preflights every Business GET before route-specific parsing and dispatch", () => {
  assert.match(source, /preflightBusinessMetadataReadQuery/);
  assert.match(source, /parseBusinessMetadataReadRouteQuery/);
  assert.match(source, /const businessReadPreflight = preflightBusinessMetadataReadQuery\(url, pathname, req\.method\);/);
  assert.match(source, /if \(businessReadPreflight && !businessReadPreflight\.ok\) \{/);
  assert.match(source, /return jsonResponse\(businessReadPreflight\.payload, \{ status: businessReadPreflight\.status \}\);/);
  assert.match(source, /const businessReadQuery = parseBusinessMetadataReadRouteQuery\(url, pathname, req\.method\);/);
  assert.match(source, /if \(businessReadQuery && !businessReadQuery\.ok\) \{/);
  assert.match(source, /return jsonResponse\(businessReadQuery\.payload, \{ status: businessReadQuery\.status \}\);/);

  const preflight = source.indexOf("const businessReadPreflight = preflightBusinessMetadataReadQuery");
  const routeParser = source.indexOf("const businessReadQuery = parseBusinessMetadataReadRouteQuery");
  const businessDispatch = source.indexOf("switch (resolveBusinessRouteHandlerId(pathname))");
  assert.equal(preflight >= 0 && routeParser > preflight && businessDispatch > routeParser, true);
});
