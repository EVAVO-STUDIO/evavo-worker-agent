import assert from "node:assert/strict";
import test from "node:test";

import {
  GROWTH_INTERNAL_OPERATOR_PACK_VERSION,
  composeGrowthInternalOperatorPack,
  type GrowthInternalOperatorPackInput,
} from "../src/core/growthInternalOperatorPack";

function input(): GrowthInternalOperatorPackInput {
  return {
    generatedAt: "2026-07-26T09:00:00.000Z",
    intensity: "balanced",
    suggestedFocus: [
      "One saved action needs operator review.",
      "One saved signal has strong EVAVO fit.",
    ],
    signals: [
      {
        id: "signal-example-0001",
        sourceUrl: "https://example.com/opportunity",
        sourceTitle: "Example digital opportunity",
        signalType: "project_signal",
        evidence: "The public page describes an active digital customer-experience procurement need.",
        urgency: 82,
        fitScore: 88,
        riskScore: 24,
        status: "new",
        discoveredAt: "2026-07-26T08:30:00.000Z",
      },
    ],
    actions: [
      {
        id: "action-example-0001",
        signalId: "signal-example-0001",
        actionType: "prepare_discovery_outline",
        reason: "The signal is relevant but should be validated before any contact.",
        contextEvidence: "Public procurement copy and EVAVO service fit are available for review.",
        evavoFitExplanation: "EVAVO can support digital experience strategy, design and implementation.",
        riskFlags: ["timing_unconfirmed", "budget_unconfirmed"],
        status: "needs_review",
        blockedReason: "Owner must confirm the active need and budget path.",
        updatedAt: "2026-07-26T08:45:00.000Z",
      },
    ],
    externalExecutionRequested: false,
    canonicalPromotionRequested: false,
  };
}

test("saved Worker review models produce a deterministic frozen operator pack", () => {
  const first = composeGrowthInternalOperatorPack(input());
  const second = composeGrowthInternalOperatorPack(input());

  assert.equal(first.contractVersion, GROWTH_INTERNAL_OPERATOR_PACK_VERSION);
  assert.equal(first.source, "worker_d1_review_models");
  assert.equal(first.intensity, "balanced");
  assert.equal(first.deterministic, true);
  assert.equal(first.aiGenerated, false);
  assert.equal(first.callsNetwork, false);
  assert.equal(first.externalExecutionEnabled, false);
  assert.equal(first.canonicalPromotionEnabled, false);
  assert.deepEqual(first.summary, {
    signalsReviewed: 1,
    actionsReviewed: 1,
    focusItems: 4,
    followUpPlans: 1,
    missingEvidenceItems: 0,
    blockedActions: 1,
  });
  assert.equal(first.focusItems[0]?.kind, "action");
  assert.equal(first.focusItems[0]?.urgency, "now");
  assert.equal(first.signalBriefs[0]?.title, "Example digital opportunity");
  assert.equal(first.meetingAgenda.length, 5);
  assert.equal(first.followUpPlans[0]?.deliveryAllowed, false);
  assert(first.markdown.includes("# EVAVO Growth internal operator pack"));
  assert(first.markdown.includes("No AI, outbound network call, email, calendar event, social post"));
  assert.deepEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.summary), true);
  assert.equal(Object.isFrozen(first.focusItems), true);
  assert.equal(Object.isFrozen(first.signalBriefs), true);
  assert.equal(Object.isFrozen(first.meetingAgenda), true);
  assert.equal(Object.isFrozen(first.followUpPlans), true);
  assert.equal(Object.isFrozen(first.safety), true);
  assert.deepEqual(first.safety, {
    sendsEmail: false,
    createsCalendarEvent: false,
    postsExternally: false,
    submitsForms: false,
    writesProvider: false,
    promotesCanonicalRecord: false,
    automaticRetryAllowed: false,
  });
});

test("missing evidence and risk metadata are surfaced rather than invented", () => {
  const value = input();
  const pack = composeGrowthInternalOperatorPack({
    ...value,
    actions: [{
      ...value.actions[0]!,
      contextEvidence: null,
      evavoFitExplanation: null,
      riskFlags: [],
      blockedReason: null,
      status: "queued",
    }],
  });

  assert.equal(pack.summary.missingEvidenceItems, 1);
  assert.equal(pack.summary.blockedActions, 0);
  assert(pack.followUpPlans[0]?.talkingPoints.some((point) => point.includes("Evidence context is missing")));
  assert(pack.followUpPlans[0]?.talkingPoints.some((point) => point.includes("incomplete risk analysis")));
});

test("external execution and canonical promotion requests fail closed", () => {
  const value = input();
  assert.throws(
    () => composeGrowthInternalOperatorPack({
      ...value,
      externalExecutionRequested: true,
    } as unknown as GrowthInternalOperatorPackInput),
    /GROWTH_INTERNAL_OPERATOR_PACK_INPUT_INVALID/,
  );
  assert.throws(
    () => composeGrowthInternalOperatorPack({
      ...value,
      canonicalPromotionRequested: true,
    } as unknown as GrowthInternalOperatorPackInput),
    /GROWTH_INTERNAL_OPERATOR_PACK_INPUT_INVALID/,
  );
});

test("unsafe source URLs, malformed scores and noncanonical timestamps fail closed", () => {
  const value = input();
  assert.throws(
    () => composeGrowthInternalOperatorPack({
      ...value,
      signals: [{ ...value.signals[0]!, sourceUrl: "http://public.example/opportunity" }],
    }),
    /GROWTH_INTERNAL_OPERATOR_PACK_SOURCE_URL_INVALID/,
  );
  assert.throws(
    () => composeGrowthInternalOperatorPack({
      ...value,
      signals: [{ ...value.signals[0]!, sourceUrl: "https://user:secret@example.com/opportunity" }],
    }),
    /GROWTH_INTERNAL_OPERATOR_PACK_SOURCE_URL_INVALID/,
  );
  assert.throws(
    () => composeGrowthInternalOperatorPack({
      ...value,
      signals: [{ ...value.signals[0]!, fitScore: 101 }],
    }),
    /GROWTH_INTERNAL_OPERATOR_PACK_SIGNAL_INVALID/,
  );
  assert.throws(
    () => composeGrowthInternalOperatorPack({ ...value, generatedAt: "not-a-time" }),
    /GROWTH_INTERNAL_OPERATOR_PACK_TIME_INVALID/,
  );
});

test("record and focus limits remain bounded", () => {
  const value = input();
  assert.throws(
    () => composeGrowthInternalOperatorPack({
      ...value,
      signals: Array.from({ length: 21 }, (_, index) => ({
        ...value.signals[0]!,
        id: `signal-example-${String(index + 1).padStart(4, "0")}`,
      })),
    }),
    /GROWTH_INTERNAL_OPERATOR_PACK_INPUT_INVALID/,
  );
  assert.throws(
    () => composeGrowthInternalOperatorPack({
      ...value,
      suggestedFocus: Array.from({ length: 11 }, (_, index) => `Focus ${index + 1}`),
    }),
    /GROWTH_INTERNAL_OPERATOR_PACK_INPUT_INVALID/,
  );
});
