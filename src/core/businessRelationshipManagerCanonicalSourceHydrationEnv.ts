import {
  createBrainMemoryContextPort,
  type BrainMemoryContextPort,
} from "./businessBrainMemoryContextPort";
import {
  createCareersRoleTruthPort,
  type CareersRoleTruthPort,
} from "./businessCareersRoleTruthPort";
import {
  createOperationsCoreRelationshipSnapshotPort,
  type OperationsCoreRelationshipSnapshotPort,
} from "./businessOperationsCoreRelationshipSnapshotPort";
import {
  runCanonicalRelationshipManagerCycleWithCareersContext,
  type CanonicalRelationshipManagerCareersContextInput,
  type CanonicalRelationshipManagerCareersContextResult,
} from "./businessRelationshipManagerCanonicalCareersContextRuntime";

export const BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_SOURCE_HYDRATION_ENV_CONTRACT =
  "business_relationship_manager_canonical_source_hydration_env_v3" as const;

export type RelationshipManagerCanonicalSourceEnv = Readonly<{
  BRAIN_BASE_URL?: string;
  BRAIN_API_TOKEN?: string;
  OPERATIONS_CORE_BASE_URL?: string;
  OPERATIONS_RELATIONSHIP_READ_TOKEN?: string;
  OPERATIONS_CAREERS_READ_TOKEN?: string;
}>;

export type CanonicalRelationshipManagerSourceHydrationEnvInput = Readonly<{
  env: RelationshipManagerCanonicalSourceEnv;
  cycle: CanonicalRelationshipManagerCareersContextInput["cycle"];
  context: CanonicalRelationshipManagerCareersContextInput["context"];
  operationsRequired: boolean;
  operationsIdentity?: CanonicalRelationshipManagerCareersContextInput["operationsIdentity"];
  careersRequired: boolean;
  careersIdentity?: CanonicalRelationshipManagerCareersContextInput["careersIdentity"];
}>;

export type CanonicalRelationshipManagerSourceHydrationEnvResult = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_SOURCE_HYDRATION_ENV_CONTRACT;
  brainConfigured: boolean;
  operationsConfigured: boolean;
  careersConfigured: boolean;
  cycle: CanonicalRelationshipManagerCareersContextResult;
  externalEffectPerformed: false;
}>;

function pair(valueA: string | undefined, valueB: string | undefined, code: string) {
  const a = valueA?.trim() ?? "";
  const b = valueB?.trim() ?? "";
  if (Boolean(a) !== Boolean(b)) throw new Error(code);
  return Object.freeze({ configured: Boolean(a && b), a, b });
}
function sharedBaseSource(baseUrlValue: string | undefined, tokenValue: string | undefined, tokenWithoutBaseCode: string) {
  const baseUrl = baseUrlValue?.trim() ?? "";
  const readToken = tokenValue?.trim() ?? "";
  if (readToken && !baseUrl) throw new Error(tokenWithoutBaseCode);
  return Object.freeze({ configured: Boolean(baseUrl && readToken), baseUrl, readToken });
}
function unavailableBrainPort(): BrainMemoryContextPort {
  return Object.freeze({
    contract: "business_brain_memory_context_port_v2" as const,
    async read() { throw new Error("BRAIN_MEMORY_CONTEXT_READ_UNAVAILABLE"); },
  });
}
function unavailableOperationsPort(): OperationsCoreRelationshipSnapshotPort {
  return Object.freeze({
    contract: "business_operations_core_relationship_snapshot_port_v1" as const,
    async read() { throw new Error("OPERATIONS_RELATIONSHIP_READ_UNAVAILABLE"); },
  });
}
function unavailableCareersPort(): CareersRoleTruthPort {
  return Object.freeze({
    contract: "business_careers_role_truth_port_v1" as const,
    async read() { throw new Error("CAREERS_ROLE_TRUTH_READ_UNAVAILABLE"); },
  });
}
function brainPort(env: RelationshipManagerCanonicalSourceEnv) {
  const config = pair(env.BRAIN_BASE_URL, env.BRAIN_API_TOKEN, "RELATIONSHIP_MANAGER_CANONICAL_BRAIN_READ_ENV_INCOMPLETE");
  return Object.freeze({
    configured: config.configured,
    port: config.configured ? createBrainMemoryContextPort({ baseUrl: config.a, apiToken: config.b }) : unavailableBrainPort(),
  });
}
function operationsPort(env: RelationshipManagerCanonicalSourceEnv) {
  const config = sharedBaseSource(env.OPERATIONS_CORE_BASE_URL, env.OPERATIONS_RELATIONSHIP_READ_TOKEN, "RELATIONSHIP_MANAGER_CANONICAL_OPERATIONS_READ_ENV_INCOMPLETE");
  return Object.freeze({
    configured: config.configured,
    port: config.configured ? createOperationsCoreRelationshipSnapshotPort({ baseUrl: config.baseUrl, readToken: config.readToken }) : unavailableOperationsPort(),
  });
}
function careersPort(env: RelationshipManagerCanonicalSourceEnv) {
  const config = sharedBaseSource(env.OPERATIONS_CORE_BASE_URL, env.OPERATIONS_CAREERS_READ_TOKEN, "RELATIONSHIP_MANAGER_CANONICAL_CAREERS_READ_ENV_INCOMPLETE");
  return Object.freeze({
    configured: config.configured,
    port: config.configured ? createCareersRoleTruthPort({ baseUrl: config.baseUrl, readToken: config.readToken }) : unavailableCareersPort(),
  });
}

export async function runCanonicalRelationshipManagerCycleWithSourcesFromEnv(
  input: CanonicalRelationshipManagerSourceHydrationEnvInput,
): Promise<CanonicalRelationshipManagerSourceHydrationEnvResult> {
  const brain = brainPort(input.env);
  const operations = operationsPort(input.env);
  const careers = careersPort(input.env);
  const cycle = await runCanonicalRelationshipManagerCycleWithCareersContext({
    cycle: input.cycle,
    context: input.context,
    brain: brain.port,
    operations: operations.port,
    operationsRequired: input.operationsRequired,
    operationsIdentity: input.operationsIdentity,
    careers: careers.port,
    careersRequired: input.careersRequired,
    careersIdentity: input.careersIdentity,
  });
  if (!brain.configured && cycle.canonical.brain.brainState !== "provider_unavailable") throw new Error("RELATIONSHIP_MANAGER_CANONICAL_BRAIN_ENV_READINESS_WIDENED");
  if (input.operationsRequired && !operations.configured && cycle.canonical.operationsState !== "provider_unavailable") throw new Error("RELATIONSHIP_MANAGER_CANONICAL_OPERATIONS_ENV_READINESS_WIDENED");
  if (input.careersRequired && !careers.configured && cycle.careersState !== "provider_unavailable") throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CAREERS_ENV_READINESS_WIDENED");
  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_SOURCE_HYDRATION_ENV_CONTRACT,
    brainConfigured: brain.configured,
    operationsConfigured: operations.configured,
    careersConfigured: careers.configured,
    cycle,
    externalEffectPerformed: false,
  });
}
