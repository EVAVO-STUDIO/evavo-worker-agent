import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const core = fs.readFileSync("src/core/opportunitySourceDiscovery.ts", "utf8");
const route = fs.readFileSync("src/routes/opportunitySourceCandidatesAdmin.ts", "utf8");

test("reviewed source candidates commit source rows, markers and audit atomically", () => {
  for (const token of [
    'SOURCE_CANDIDATE_SAVE_CONTRACT = "opportunity_source_candidate_save_v2_atomic"',
    "const statements: D1PreparedStatement[] = []",
    "INSERT INTO opportunity_sources",
    "UPDATE source_expansion_candidates",
    "INSERT INTO events",
    "requestBodySha256: options.requestBodySha256 || null",
    "await env.DB.batch(statements)",
    "sourceRecordsExpansionMarkersAndAuditAtomic: true",
    "reviewOnly: true",
    "executable: false",
    "externalExecutionAllowed: false",
  ]) {
    assert.ok(core.includes(token), `missing atomic source-candidate token: ${token}`);
  }

  const sourceInsert = core.indexOf("INSERT INTO opportunity_sources");
  const markerUpdate = core.indexOf("UPDATE source_expansion_candidates");
  const auditInsert = core.indexOf("INSERT INTO events");
  const batch = core.indexOf("await env.DB.batch(statements)");
  assert.ok(sourceInsert >= 0 && markerUpdate >= 0 && auditInsert >= 0 && batch >= 0);
  assert.ok(sourceInsert < batch && markerUpdate < batch && auditInsert < batch);
});

test("source candidate save has no sequential helper writes or external execution", () => {
  for (const forbidden of [
    "logEvent(",
    "await env.DB.prepare(`INSERT INTO opportunity_sources",
    "await env.DB.prepare(`UPDATE source_expansion_candidates",
    "fetch(",
    "sendEmail(",
    "waitUntil(",
  ]) {
    assert.equal(core.includes(forbidden), false, `forbidden source-candidate behavior: ${forbidden}`);
  }
});

test("source candidate route binds the audit to the bounded request receipt", () => {
  for (const token of [
    "readBoundedJsonObject<SourceCandidateCommitBody>(request",
    "isExplicitJsonConfirmation(parsed.value)",
    'SOURCE_CANDIDATE_COMMIT_LEASE = "opportunity-source-candidates-commit"',
    "requestBodySha256: parsed.bodySha256",
    "requestReceipt",
    "concurrentDuplicateCommitAllowed: false",
    "maximumCandidateCount: 25",
  ]) {
    assert.ok(route.includes(token), `missing source-candidate route token: ${token}`);
  }
  assert.equal(route.includes("request.json()"), false);
  assert.equal(route.includes("body?.confirm === 1"), false);
});
