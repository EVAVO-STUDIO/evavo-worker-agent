import assert from "node:assert/strict";
import test from "node:test";

import { buildCommunicationDecisionPackage } from "../src/core/businessCommunicationDecisionPackage";

const base = {
  packageId: "pkg-staff",
  scenario: "general" as const,
  objective: "Reply safely.",
  thread: {
    threadId: "thread-1",
    previousState: [],
    latestObservedState: [
      { id: "q1", kind: "question" as const, statement: "Can you send the current proposal?", status: "open" as const, owner: "evavo" as const, sourceEvidenceIds: ["gmail:m1"] },
    ],
  },
  obligations: [],
  channel: { currentChannel: "email" as const, canResolveInWriting: true },
  evidenceIds: ["gmail:m1"],
  evidenceConfidence: 94,
};

test("non approval-grade staff context blocks an otherwise plausible reply", () => {
  const result = buildCommunicationDecisionPackage({
    ...base,
    staffBrief: {
      contract: "business_relationship_staff_brief_v3",
      relationshipId: "rel-1",
      objective: "Reply safely.",
      situation: "Proposal requested.",
      whatChanged: "New proposal request.",
      materialChanges: ["communications: new proposal request"],
      priorities: ["Resolve the current request."],
      mustVerify: ["Resolve current proposal version."],
      mustNotAssume: ["Do not assume a document is controlling."],
      obligationsToRespect: [],
      priorDecisionsToRespect: [],
      relationshipRisks: ["Document state incomplete."],
      staleDomains: [],
      sourceRefs: ["gmail:m1"],
      approvalGradeReady: false,
    },
  });
  assert.equal(result.disposition, "escalate");
  assert.equal(result.approvalGradeReady, false);
  assert.ok(result.mustVerify.some((item) => /proposal/i.test(item)));
});

test("context resolution plan exposes the canonical sources needed next", () => {
  const result = buildCommunicationDecisionPackage({
    ...base,
    contextResolutionPlan: {
      contract: "business_relationship_context_resolution_plan_v1",
      relationshipId: "rel-1",
      ready: false,
      items: [
        { issue: "Document/version context is uncertain.", source: "docs_suite", purpose: "Resolve exact artifact.", blocking: true, evidenceRequired: true },
      ],
      orderedSources: ["docs_suite"],
      blockingIssues: ["Document/version context is uncertain."],
    },
  });
  assert.equal(result.disposition, "escalate");
  assert.deepEqual(result.nextContextSources, ["docs_suite"]);
  assert.ok(result.reasons.some((item) => /context resolution required/i.test(item)));
});
