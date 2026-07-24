import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as ts from "typescript";

const CHECK_NAME = "check-growth-proposal-packet-runtime";
const root = process.cwd();
const sourcePath = path.join(root, "src/core/growthProposalPacket.ts");
const fixturePath = path.join(root, "fixtures/growth-worker-proposal-v1.json");
const temporaryDirectory = path.join(root, ".growth-proposal-packet-check");
const temporaryModulePath = path.join(temporaryDirectory, "growthProposalPacket.mjs");
const errors = [];

function assert(condition, label) {
  if (!condition) errors.push(label);
}

function expectError(label, run, expected) {
  let observed = "";
  try {
    run();
  } catch (error) {
    observed = error instanceof Error ? error.message : String(error);
  }
  if (observed !== expected) errors.push(`${label}: expected ${expected}, received ${observed || "no error"}`);
}

fs.rmSync(temporaryDirectory, { recursive: true, force: true });
fs.mkdirSync(temporaryDirectory, { recursive: true });

try {
  const source = fs.readFileSync(sourcePath, "utf8");
  const fixtureText = fs.readFileSync(fixturePath, "utf8");
  const fixture = JSON.parse(fixtureText);
  const transpiled = ts.transpileModule(source, {
    fileName: sourcePath,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      isolatedModules: true,
      sourceMap: false,
      declaration: false,
      removeComments: false,
    },
  });

  for (const diagnostic of transpiled.diagnostics ?? []) {
    if (diagnostic.category === ts.DiagnosticCategory.Error) {
      errors.push(`TypeScript transpile diagnostic ${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`);
    }
  }
  fs.writeFileSync(temporaryModulePath, transpiled.outputText, "utf8");

  const moduleUrl = `${pathToFileURL(temporaryModulePath).href}?v=${Date.now()}`;
  const proposalModule = await import(moduleUrl);
  const build = proposalModule.buildGrowthProposalPacket;
  const serialise = proposalModule.serialiseGrowthProposalPacket;
  assert(typeof build === "function", "buildGrowthProposalPacket export missing");
  assert(typeof serialise === "function", "serialiseGrowthProposalPacket export missing");

  const input = {
    sourceRouteFamily: fixture.sourceRouteFamily,
    sourceRecordId: fixture.sourceRecordId,
    sourceFingerprint: fixture.sourceFingerprint,
    organisationId: fixture.organisationId,
    workspaceId: fixture.workspaceId,
    candidateKind: fixture.candidateKind,
    candidateTitle: fixture.candidateTitle,
    candidateSummary: fixture.candidateSummary,
    evidenceItems: fixture.evidenceItems,
    confidence: fixture.confidence,
    proposedAction: fixture.proposedAction,
    doNothingRationale: fixture.doNothingRationale,
    riskNotes: fixture.riskNotes,
    idempotencyKey: fixture.idempotencyKey,
    createdAt: fixture.createdAt,
  };
  const now = new Date("2026-07-24T04:00:00.000Z");
  const built = build(input, { now });

  assert(Object.isFrozen(built), "built packet is not frozen");
  assert(Object.isFrozen(built.evidenceItems), "built evidence array is not frozen");
  assert(Object.isFrozen(built.evidenceItems[0]), "built evidence item is not frozen");
  assert(serialise(built) === fixtureText, "Worker builder output does not exactly match the canonical fixture");
  assert(JSON.stringify(built) === JSON.stringify(fixture), "Worker builder object does not exactly match canonical fixture values");
  assert(built.contractVersion === "growth_worker_proposal_v1", "contract version mismatch");
  assert(built.sourceSystem === "evavo-worker-agent", "source system mismatch");
  assert(built.proposalMode === "proposal_only", "proposal mode mismatch");
  assert(built.externalExecutionRequested === false, "external execution flag mismatch");
  assert(built.canonicalPromotionRequested === false, "canonical promotion flag mismatch");
  assert(!serialise(built).includes("ADMIN_TOKEN"), "fixture output exposes ADMIN_TOKEN token");

  expectError(
    "path-shaped identifier",
    () => build({ ...input, idempotencyKey: "worker/proposal:opportunity:000000000001" }, { now }),
    "GROWTH_PROPOSAL_IDENTIFIER_INVALID:idempotencyKey",
  );
  expectError(
    "traversal identifier",
    () => build({ ...input, sourceFingerprint: "sha256:../worker-proposal-000000000001" }, { now }),
    "GROWTH_PROPOSAL_IDENTIFIER_INVALID:sourceFingerprint",
  );
  expectError(
    "execution-shaped action",
    () => build({ ...input, proposedAction: "Prepare the email and then send the email." }, { now }),
    "GROWTH_PROPOSAL_EXTERNAL_ACTION_INVALID:proposedAction",
  );
  expectError(
    "provider-write action",
    () => build({ ...input, proposedAction: "Prepare the changes and update HubSpot." }, { now }),
    "GROWTH_PROPOSAL_EXTERNAL_ACTION_INVALID:proposedAction",
  );
  expectError(
    "public HTTP evidence URL",
    () => build({
      ...input,
      evidenceItems: [{ ...input.evidenceItems[0], sourceUrl: "http://example.com/services" }],
    }, { now }),
    "GROWTH_PROPOSAL_URL_INVALID:sourceUrl",
  );
  expectError(
    "future packet",
    () => build({ ...input, createdAt: "2026-07-24T04:06:00.000Z" }, { now }),
    "GROWTH_PROPOSAL_CREATED_AT_FUTURE:createdAt",
  );
  expectError(
    "stale packet",
    () => build({ ...input, createdAt: "2026-06-20T03:50:00.000Z" }, { now }),
    "GROWTH_PROPOSAL_CREATED_AT_STALE:createdAt",
  );
  expectError(
    "missing evidence",
    () => build({ ...input, evidenceItems: [] }, { now }),
    "GROWTH_PROPOSAL_EVIDENCE_COUNT_INVALID:evidenceItems",
  );
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

if (errors.length) {
  console.error(`${CHECK_NAME} failed:\n`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Growth proposal packet runtime parity check passed.");
console.log("- TypeScript builder transpiles and executes without adding a runtime dependency or route");
console.log("- Worker output matches the canonical growth_worker_proposal_v1 fixture byte-for-byte");
console.log("- valid output is frozen, proposal-only and explicitly non-executing/non-promoting");
console.log("- path identifiers, unsafe URLs, stale/future packets and execution-shaped actions fail closed");
console.log("- temporary transpiled output is removed after every check");
