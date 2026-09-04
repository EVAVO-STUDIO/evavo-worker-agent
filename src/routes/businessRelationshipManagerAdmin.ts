import type { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import { boundedJsonFailurePayload, readBoundedJsonObject } from "../core/boundedJsonRequest";
import { runRelationshipManagerCommunicationCycle } from "../core/businessRelationshipManagerRuntime";
import { parseRelationshipManagerCommunicationCycleInput } from "../core/businessRelationshipManagerRuntimeInput";
import { BUSINESS_RELATIONSHIP_MANAGER_CYCLE_PATH } from "../core/businessRoutePaths";
import type { JsonResponse } from "./businessAutopilotAdmin";

export const BUSINESS_RELATIONSHIP_MANAGER_ADMIN_CONTRACT = "business_relationship_manager_admin_v1" as const;

function safeFailure(error: unknown): Readonly<{ ok: false; error: string; rawErrorExposed: false }> {
  const code = error instanceof Error && /^[A-Z0-9_:.-]+$/.test(error.message)
    ? error.message.slice(0, 240)
    : "RELATIONSHIP_MANAGER_CYCLE_INVALID";
  return Object.freeze({ ok: false, error: code, rawErrorExposed: false });
}

export async function handleBusinessRelationshipManagerAdmin(
  request: Request,
  env: Env,
  pathname: string,
  json: JsonResponse,
): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) {
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (pathname !== BUSINESS_RELATIONSHIP_MANAGER_CYCLE_PATH) {
    return json({ ok: false, error: "not_found" }, { status: 404 });
  }
  if (request.method !== "POST") {
    return json({
      ok: false,
      contract: BUSINESS_RELATIONSHIP_MANAGER_ADMIN_CONTRACT,
      error: "method_not_allowed",
      sendsEmail: false,
      externalExecutionAllowed: false,
    }, { status: 405, headers: { allow: "POST" } });
  }

  const parsed = await readBoundedJsonObject(request, {
    maxBytes: 262_144,
    maxDepth: 16,
    maxNodes: 5_000,
    maxArrayLength: 500,
    maxStringLength: 32_768,
  });
  if (!parsed.ok) return json(boundedJsonFailurePayload(parsed), { status: parsed.status });

  try {
    const cycleInput = parseRelationshipManagerCommunicationCycleInput(parsed.value);
    const cycle = runRelationshipManagerCommunicationCycle(cycleInput);
    return json({
      ok: true,
      contract: BUSINESS_RELATIONSHIP_MANAGER_ADMIN_CONTRACT,
      mode: "relationship_manager_communication_cycle_preview",
      cycleId: cycle.cycleId,
      observedAt: cycle.observedAt,
      normalizedMessageIds: cycle.projection.normalizedMessageIds,
      sourceEvidenceIds: cycle.projection.sourceEvidenceIds,
      thread: {
        threadId: cycle.projection.threadId,
        liveResponseTargets: cycle.decision.liveResponseTargets,
        activeEvavoObligations: cycle.decision.activeEvavoObligations,
        nextActionOwner: cycle.projection.obligationLedger.nextActionOwner,
      },
      evidenceReadiness: cycle.evidenceReadiness,
      decision: {
        packageId: cycle.decision.packageId,
        decisionAt: cycle.decision.decisionAt,
        replayDeterministic: cycle.decision.replayDeterministic,
        disposition: cycle.decision.disposition,
        recommendedChannel: cycle.decision.recommendedChannel,
        meetingJustified: cycle.decision.meetingJustified,
        modelApprovalGradeReady: cycle.decision.approvalGradeReady,
        previewApprovalGradeReady: false,
        prohibitedImplications: cycle.decision.prohibitedImplications,
        mustVerify: cycle.decision.mustVerify,
        mustNotAssume: cycle.decision.mustNotAssume,
        reasons: cycle.decision.reasons,
      },
      memory: {
        observationCount: cycle.memoryObservations.length,
        kinds: [...new Set(cycle.memoryObservations.map((item) => item.kind))],
        sourceRefs: [...new Set(cycle.memoryObservations.map((item) => item.sourceRef))],
        persisted: false,
      },
      rawMessageBodiesExposed: false,
      callerSuppliedTrustedContextAccepted: false,
      canonicalStateMutated: false,
      callsExternalNetwork: false,
      callsAI: false,
      sendsEmail: false,
      createsMeetings: false,
      mutatesExternalProviders: false,
      externalExecutionAllowed: false,
    });
  } catch (error) {
    return json({
      ...safeFailure(error),
      contract: BUSINESS_RELATIONSHIP_MANAGER_ADMIN_CONTRACT,
      mode: "relationship_manager_communication_cycle_preview",
      rawMessageBodiesExposed: false,
      callerSuppliedTrustedContextAccepted: false,
      canonicalStateMutated: false,
      sendsEmail: false,
      externalExecutionAllowed: false,
    }, { status: 400 });
  }
}