import assert from "node:assert/strict";
import test from "node:test";

import {
  BUSINESS_STAFF_DECISION_CONTRACT,
  decideBusinessStaffAction,
  type StaffAuthorityPolicy,
  type StaffDecisionRequest,
} from "../src/core/businessStaffDecisionEngine";

const now = Date.parse("2026-09-04T00:00:00Z");

const policy: StaffAuthorityPolicy = {
  level: "internal_reversible",
  externalExecutionEnabled: false,
  maxAutonomousFinancialImpactAud: 0,
  minimumEvidenceConfidence: 70,
  minimumDecisionConfidence: 65,
  maxEvidenceAgeDays: 45,
};

function request(overrides: Partial<StaffDecisionRequest> = {}): StaffDecisionRequest {
  return {
    id: "decision-1",
    objective: "Keep an important client relationship healthy and move the work forward.",
    proposedAction: "Create an internal follow-up task for the account owner.",
    actionClass: "followup_plan",
    requestedAuthority: "internal_reversible",
    relationshipId: "relationship-1",
    organizationId: "org-1",
    personId: "person-1",
    reversible: true,
    externalStateChange: false,
    financialImpactAud: 0,
    stakeholderImpact: "low",
    evidence: [
      {
        id: "evidence-1",
        kind: "meeting_note",
        summary: "The client asked for the revised scope this week.",
        observedAt: "2026-09-03T02:00:00Z",
        confidence: 95,
        source: "operations-core:meeting-123",
        supports: ["followup_due"],
      },
      {
        id: "evidence-2",
        kind: "project_state",
        summary: "The revised scope is ready for owner review.",
        observedAt: "2026-09-03T05:00:00Z",
        confidence: 90,
        source: "project:scope-state",
        supports: ["internal_followup"],
      },
    ],
    alternatives: ["Wait until the next weekly review."],
    ...overrides,
  };
}

test("allows evidence-backed reversible internal work within authority", () => {
  const decision = decideBusinessStaffAction(request(), policy, now);
  assert.equal(decision.contract, BUSINESS_STAFF_DECISION_CONTRACT);
  assert.equal(decision.disposition, "act_internal");
  assert.equal(decision.requiresHumanApproval, false);
  assert.equal(decision.mayMutateExternalState, false);
  assert.ok(decision.evidenceConfidence >= 90);
  assert.deepEqual(decision.evidenceIds, ["evidence-1", "evidence-2"]);
});

test("external action is approval-gated when external execution is disabled", () => {
  const decision = decideBusinessStaffAction(
    request({
      actionClass: "external_action",
      proposedAction: "Send the revised scope to the client.",
      requestedAuthority: "external_reversible",
      externalStateChange: true,
      stakeholderImpact: "medium",
    }),
    policy,
    now,
  );

  assert.equal(decision.disposition, "prepare_for_approval");
  assert.equal(decision.requiresHumanApproval, true);
  assert.equal(decision.mayMutateExternalState, false);
});

test("suppression is a hard veto regardless of opportunity quality", () => {
  const decision = decideBusinessStaffAction(
    request({ suppressionActive: true }),
    policy,
    now,
  );

  assert.equal(decision.disposition, "reject");
  assert.equal(decision.decisionConfidence, 100);
  assert.match(decision.rationale[0], /hard veto/i);
});

test("weak or stale evidence causes defer rather than invented confidence", () => {
  const decision = decideBusinessStaffAction(
    request({
      evidence: [
        {
          id: "old-evidence",
          kind: "note",
          summary: "An old note suggested a follow-up may eventually be useful.",
          observedAt: "2025-01-01T00:00:00Z",
          confidence: 60,
          source: "legacy-note",
          supports: ["maybe_followup"],
        },
      ],
    }),
    policy,
    now,
  );

  assert.equal(decision.disposition, "defer");
  assert.ok(decision.evidenceConfidence < policy.minimumEvidenceConfidence);
  assert.ok(decision.uncertainties.some((item) => /freshness window/i.test(item)));
});

test("recipient or compliance uncertainty escalates before action", () => {
  const recipientDecision = decideBusinessStaffAction(
    request({ identityOrRecipientUncertainty: true }),
    policy,
    now,
  );
  assert.equal(recipientDecision.disposition, "escalate");

  const complianceDecision = decideBusinessStaffAction(
    request({ legalOrComplianceUncertainty: true }),
    policy,
    now,
  );
  assert.equal(complianceDecision.disposition, "escalate");
});

test("consequential or irreversible work is never silently treated as routine", () => {
  const decision = decideBusinessStaffAction(
    request({
      requestedAuthority: "consequential",
      proposedAction: "Commit EVAVO to a binding commercial term.",
      actionClass: "external_action",
      externalStateChange: true,
      reversible: false,
      stakeholderImpact: "high",
    }),
    {
      ...policy,
      level: "consequential",
      externalExecutionEnabled: true,
    },
    now,
  );

  assert.equal(decision.disposition, "prepare_for_approval");
  assert.equal(decision.requiresHumanApproval, true);
  assert.ok(decision.redTeamChecks.some((item) => /not safely reversible/i.test(item)));
});
