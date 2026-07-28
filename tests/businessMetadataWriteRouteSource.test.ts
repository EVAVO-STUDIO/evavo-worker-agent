import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const routePath = path.join(
  process.cwd(),
  "src",
  "routes",
  "businessAutopilotAdmin.ts",
);

function routeSource(): string {
  return fs.readFileSync(routePath, "utf8");
}

function postBlock(source: string, route: string): string {
  const marker = `if (request.method === "POST" && pathname === "${route}")`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Missing POST route ${route}`);
  const next = source.indexOf(
    'if (request.method === "POST"',
    start + marker.length,
  );
  return source.slice(start, next === -1 ? source.length : next);
}

test("all active generic Business writes use the bounded exact-confirmation boundary", () => {
  const source = routeSource();
  const routes = [
    ["/admin/business/organizations", "organization"],
    ["/admin/business/signals", "signal"],
    ["/admin/business/opportunities", "opportunity"],
    ["/admin/business/service-matches", "serviceMatch"],
    ["/admin/business/audit-packs", "auditPack"],
    ["/admin/business/action-drafts/build", "draftRequest"],
    ["/admin/business/suppression", "suppression"],
    ["/admin/business/content-ideas", "contentIdea"],
    ["/admin/business/followups", "followup"],
    ["/admin/business/learning", "learningEvent"],
  ] as const;

  for (const [route, entityKey] of routes) {
    const block = postBlock(source, route);
    assert.match(block, /readBusinessMetadataWriteRequest\(request,/);
    assert.equal(
      block.includes(`entityKey: "${entityKey}"`),
      true,
      `${route} must require the ${entityKey} wrapper`,
    );
    assert.match(block, /if \(!parsed\.ok\) return json\(parsed\.payload, \{ status: parsed\.status \}\);/);
    assert.match(block, /confirmedWriteMetadata\(parsed\.requestReceipt\)/);
  }
});

test("legacy raw-body and coercive confirmation helpers remain absent", () => {
  const source = routeSource();
  for (const forbidden of [
    "async function parseBody",
    "function confirmed(",
    "function blockedWrite(",
    'url.searchParams.get("confirm")',
    "body.organization || body",
    "body.signal || body",
    "body.opportunity || body",
    "body.serviceMatch || body",
    "body.auditPack || body",
    "body.draftRequest || body",
    "body.suppression || body",
    "body.contentIdea || body",
    "body.followup || body",
    "body.learningEvent || body",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test("disabled historical writes remain explicit 410 boundaries", () => {
  const source = routeSource();
  for (const route of [
    "/admin/business/action-drafts",
    "/admin/business/approval-requests",
  ]) {
    const block = postBlock(source, route);
    assert.match(block, /blockedHistoricalRecordWrite/);
    assert.equal(block.includes("readBusinessMetadataWriteRequest"), false);
  }
  assert.match(source, /error: "historical_record_write_disabled"/);
  assert.match(source, /\{ status: 410 \}/);
});
