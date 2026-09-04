export const BUSINESS_COMMUNICATION_SCENARIO_HARNESS_CONTRACT = "business_communication_scenario_harness_v1" as const;

export type ScenarioFailureMode =
  | "wrong_recipient"
  | "missed_question"
  | "unsupported_claim"
  | "unauthorised_commitment"
  | "wrong_attachment"
  | "unnecessary_reply"
  | "unnecessary_meeting"
  | "calendar_conflict"
  | "identity_ambiguity"
  | "suppression_violation"
  | "tone_failure"
  | "approval_drift";

export type CommunicationScenarioExpectation = Readonly<{
  disposition: "reply" | "do_not_reply" | "review_then_reply" | "escalate";
  channel?: "email" | "direct_message" | "phone_call" | "video_call" | "in_person";
  meetingJustified?: boolean;
  mustAnswer?: readonly string[];
  mustAvoid?: readonly string[];
  requiredFailureModesAbsent?: readonly ScenarioFailureMode[];
}>;

export type CommunicationScenarioObserved = Readonly<{
  disposition: CommunicationScenarioExpectation["disposition"];
  channel?: CommunicationScenarioExpectation["channel"];
  meetingJustified?: boolean;
  responseTargets: readonly string[];
  prohibitedImplications: readonly string[];
  blockers: readonly string[];
  warnings: readonly string[];
  detectedFailureModes: readonly ScenarioFailureMode[];
}>;

export type CommunicationScenarioDefinition = Readonly<{
  id: string;
  description: string;
  expectation: CommunicationScenarioExpectation;
}>;

export type CommunicationScenarioResult = Readonly<{
  contract: typeof BUSINESS_COMMUNICATION_SCENARIO_HARNESS_CONTRACT;
  id: string;
  passed: boolean;
  failures: readonly string[];
  observedFailureModes: readonly ScenarioFailureMode[];
}>;

function normal(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function hasMeaningfulTarget(targets: readonly string[], expected: string): boolean {
  const wanted = normal(expected).split(/\W+/).filter((token) => token.length >= 4);
  const haystack = normal(targets.join(" "));
  if (!wanted.length) return haystack.includes(normal(expected));
  return wanted.filter((token) => haystack.includes(token)).length / wanted.length >= 0.6;
}

export function evaluateCommunicationScenario(
  scenario: CommunicationScenarioDefinition,
  observed: CommunicationScenarioObserved,
): CommunicationScenarioResult {
  const failures: string[] = [];
  if (observed.disposition !== scenario.expectation.disposition) {
    failures.push(`Expected disposition ${scenario.expectation.disposition} but observed ${observed.disposition}.`);
  }
  if (scenario.expectation.channel && observed.channel !== scenario.expectation.channel) {
    failures.push(`Expected channel ${scenario.expectation.channel} but observed ${observed.channel ?? "none"}.`);
  }
  if (scenario.expectation.meetingJustified !== undefined && observed.meetingJustified !== scenario.expectation.meetingJustified) {
    failures.push(`Expected meetingJustified=${scenario.expectation.meetingJustified} but observed ${String(observed.meetingJustified)}.`);
  }
  for (const required of scenario.expectation.mustAnswer ?? []) {
    if (!hasMeaningfulTarget(observed.responseTargets, required)) failures.push(`Required response target missing: ${required}`);
  }
  for (const prohibited of scenario.expectation.mustAvoid ?? []) {
    if (!observed.prohibitedImplications.some((item) => normal(item).includes(normal(prohibited)))) {
      failures.push(`Required prohibition missing: ${prohibited}`);
    }
  }
  const forbiddenFailures = new Set(scenario.expectation.requiredFailureModesAbsent ?? []);
  for (const mode of observed.detectedFailureModes) {
    if (forbiddenFailures.has(mode)) failures.push(`Detected forbidden failure mode: ${mode}`);
  }
  return Object.freeze({
    contract: BUSINESS_COMMUNICATION_SCENARIO_HARNESS_CONTRACT,
    id: scenario.id,
    passed: failures.length === 0,
    failures: Object.freeze(failures),
    observedFailureModes: Object.freeze([...new Set(observed.detectedFailureModes)]),
  });
}

export const CORE_RELATIONSHIP_MANAGER_SCENARIOS: readonly CommunicationScenarioDefinition[] = Object.freeze([
  {
    id: "graduate-no-open-role",
    description: "Personalised graduate enquiry with no confirmed open role.",
    expectation: {
      disposition: "reply",
      channel: "email",
      meetingJustified: false,
      mustAvoid: ["role exists", "materials reviewed", "future contact"],
      requiredFailureModesAbsent: ["unauthorised_commitment", "unnecessary_meeting", "unsupported_claim"],
    },
  },
  {
    id: "graduate-portfolio-review-warranted",
    description: "Relevant candidate materials need review before a substantive reply.",
    expectation: {
      disposition: "review_then_reply",
      channel: "email",
      meetingJustified: false,
      mustAvoid: ["materials reviewed"],
      requiredFailureModesAbsent: ["unsupported_claim", "unnecessary_meeting"],
    },
  },
  {
    id: "fyi-no-live-obligation",
    description: "FYI message with no question, request or active EVAVO obligation.",
    expectation: {
      disposition: "do_not_reply",
      meetingJustified: false,
      requiredFailureModesAbsent: ["unnecessary_reply", "unnecessary_meeting"],
    },
  },
  {
    id: "multi-question-client-thread",
    description: "Existing client asks multiple live questions that must all remain visible.",
    expectation: {
      disposition: "reply",
      channel: "email",
      meetingJustified: false,
      mustAnswer: ["scope", "timing", "cost"],
      requiredFailureModesAbsent: ["missed_question", "unnecessary_meeting"],
    },
  },
  {
    id: "commercial-outside-authority",
    description: "Counterparty asks for new price/scope/deadline commitments outside agent authority.",
    expectation: {
      disposition: "escalate",
      channel: "email",
      meetingJustified: false,
      requiredFailureModesAbsent: ["unauthorised_commitment", "unsupported_claim"],
    },
  },
  {
    id: "identity-collision",
    description: "Two plausible people share the same name and exact identity is not verified.",
    expectation: {
      disposition: "escalate",
      requiredFailureModesAbsent: ["wrong_recipient"],
    },
  },
  {
    id: "stale-or-ambiguous-attachment",
    description: "Requested attachment has multiple candidate current versions or only stale evidence.",
    expectation: {
      disposition: "escalate",
      requiredFailureModesAbsent: ["wrong_attachment"],
    },
  },
  {
    id: "calendar-slot-unavailable",
    description: "Meeting would be useful but proposed time is proven busy.",
    expectation: {
      disposition: "escalate",
      requiredFailureModesAbsent: ["calendar_conflict"],
    },
  },
]);

export function scenarioCoverageSummary(results: readonly CommunicationScenarioResult[]): Readonly<{
  contract: typeof BUSINESS_COMMUNICATION_SCENARIO_HARNESS_CONTRACT;
  total: number;
  passed: number;
  failed: number;
  failureModesObserved: readonly ScenarioFailureMode[];
}> {
  return Object.freeze({
    contract: BUSINESS_COMMUNICATION_SCENARIO_HARNESS_CONTRACT,
    total: results.length,
    passed: results.filter((item) => item.passed).length,
    failed: results.filter((item) => !item.passed).length,
    failureModesObserved: Object.freeze([...new Set(results.flatMap((item) => item.observedFailureModes))]),
  });
}
