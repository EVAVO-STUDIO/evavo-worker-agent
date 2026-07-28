import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const routePath = path.join(
  process.cwd(),
  "src",
  "routes",
  "businessAutopilotWebsiteAdmin.ts",
);

function source(): string {
  return fs.readFileSync(routePath, "utf8");
}

function postBlock(routeSource: string, route: string): string {
  const marker = `if (request.method === "POST" && pathname === "${route}")`;
  const start = routeSource.indexOf(marker);
  assert.notEqual(start, -1, `Missing POST route ${route}`);
  const next = routeSource.indexOf(
    'if (request.method === "POST"',
    start + marker.length,
  );
  return routeSource.slice(start, next === -1 ? routeSource.length : next);
}

test("website, page and audit writes use bounded exact-confirmation wrappers", () => {
  const routeSource = source();
  const routes = [
    ["/admin/business/websites", "website"],
    ["/admin/business/pages", "page"],
    ["/admin/business/website-audit-runs", "auditRun"],
    ["/admin/business/audit-observations", "observation"],
  ] as const;

  for (const [route, entityKey] of routes) {
    const block = postBlock(routeSource, route);
    assert.match(block, /readBusinessMetadataWriteRequest\(request,/);
    assert.equal(block.includes(`entityKey: "${entityKey}"`), true);
    assert.match(block, /if \(!parsed\.ok\) return json\(parsed\.payload, \{ status: parsed\.status \}\);/);
    assert.match(block, /confirmedWriteMetadata\(parsed\.requestReceipt\)/);
  }
});

test("website write validation keeps field-specific bounds", () => {
  const routeSource = source();
  assert.match(routeSource, /requiredTextFields: new Set\(\["url"\]\)/);
  assert.match(routeSource, /booleanFields: new Set\(\["crawlAllowed"\]\)/);
  assert.match(routeSource, /httpStatus: \{ min: 100, max: 599, integer: true \}/);
  assert.match(routeSource, /readinessScore: SCORE_RANGE/);
  assert.match(routeSource, /riskScore: SCORE_RANGE/);
  assert.match(routeSource, /confidenceScore: SCORE_RANGE/);
  assert.match(routeSource, /requiredTextFields: new Set\(\["title"\]\)/);
});

test("legacy website raw-body and coercive confirmation helpers remain absent", () => {
  const routeSource = source();
  for (const forbidden of [
    "async function parseBody",
    "function confirmed(",
    "function blockedWrite(",
    'url.searchParams.get("confirm")',
    "body.website || body",
    "body.page || body",
    "body.auditRun || body",
    "body.observation || body",
  ]) {
    assert.equal(routeSource.includes(forbidden), false, forbidden);
  }
});

test("read routes and candidate generation remain intact", () => {
  const routeSource = source();
  for (const route of [
    "/admin/business/websites",
    "/admin/business/pages",
    "/admin/business/website-audit-runs",
    "/admin/business/audit-observations",
    "/admin/business/audit-observation-candidates",
  ]) {
    assert.equal(
      routeSource.includes(`request.method === "GET" && pathname === "${route}"`),
      true,
      route,
    );
  }
  assert.match(routeSource, /buildBusinessAuditObservationCandidates/);
  assert.match(routeSource, /businessAuditObservationCandidatePayload/);
});
