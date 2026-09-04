import assert from "node:assert/strict";
import test from "node:test";

import {
  CORE_RELATIONSHIP_MANAGER_SCENARIOS,
  evaluateCommunicationScenario,
  scenarioCoverageSummary,
} from "../src/core/businessCommunicationScenarioHarness";

const graduate = CORE_RELATIONSHIP_MANAGER_SCENARIOS.find((item) => item.id === "graduate-no-open-role")!;
const multi = CORE_RELATIONSHIP_MANAGER_SCENARIOS.find((item) => item.id === "multi-question-client-thread")!;

test("graduate scenario requires async reply without unsupported promises", () => {
  const result = evaluateCommunicationScenario(graduate, {
    disposition: "reply",
    channel: "email",
    meetingJustified: false,
    responseTargets: ["Acknowledge the enquiry and answer what can be answered honestly."],
    prohibitedImplications: [
      "Do not imply a role exists.",
      "Do not imply materials were reviewed.",
      "Do not promise future contact.",
    ],
    blockers: [],
    warnings: [],
    detectedFailureModes: [],
  });
  assert.equal(result.passed, true);
});

test("multi-question scenario catches a missed live question", () => {
  const result = evaluateCommunicationScenario(multi, {
    disposition: "reply",
    channel: "email",
    meetingJustified: false,
    responseTargets: ["Confirm scope.", "Confirm timing."],
    prohibitedImplications: [],
    blockers: [],
    warnings: [],
    detectedFailureModes: ["missed_question"],
  });
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((item) => /cost/i.test(item)));
  assert.ok(result.failures.some((item) => /missed_question/i.test(item)));
});

test("coverage summary reports scenario failures explicitly", () => {
  const pass = evaluateCommunicationScenario(graduate, {
    disposition: "reply",
    channel: "email",
    meetingJustified: false,
    responseTargets: [],
    prohibitedImplications: ["role exists", "materials reviewed", "future contact"],
    blockers: [], warnings: [], detectedFailureModes: [],
  });
  const fail = evaluateCommunicationScenario(multi, {
    disposition: "do_not_reply",
    channel: "email",
    meetingJustified: false,
    responseTargets: [], prohibitedImplications: [], blockers: [], warnings: [], detectedFailureModes: ["missed_question"],
  });
  const summary = scenarioCoverageSummary([pass, fail]);
  assert.equal(summary.total, 2);
  assert.equal(summary.passed, 1);
  assert.equal(summary.failed, 1);
  assert.ok(summary.failureModesObserved.includes("missed_question"));
});
