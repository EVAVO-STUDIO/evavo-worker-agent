import {
  createBrainMemoryContextPort,
  type BrainMemoryContextPort,
} from "./businessBrainMemoryContextPort";
import {
  createOperationsCoreRelationshipSnapshotPort,
  type OperationsCoreRelationshipSnapshotPort,
} from "./businessOperationsCoreRelationshipSnapshotPort";
import {
  runCanonicalRelationshipManagerCycleWithOperationsContext,
  type CanonicalRelationshipManagerOperationsContextInput,
  type CanonicalRelationshipManagerOperationsContextResult,
} from "./businessRelationshipManagerCanonicalOperationsContextRuntime";

export const BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_SOURCE_HYDRATION_ENV_CONTRACT =
  "business_relationship_manager_canonical_source_hydration_env_v1" as const;

export type RelationshipManagerCanonicalSourceEnv = Readonly<{
  BRAIN_BASE_URL?: string;
  BRAIN_API_TOKEN?: string;
  OPERATIONS_CORE_BASE_URL?: string;
  OPERATIONS_RELATIONSHIP_READ_TOKEN?: string;
}>;

export type CanonicalRelationshipManagerSourceHydrationEnvInput = Readonly<{
  env: RelationshipManagerCanonicalSourceEnv;
  cycle: CanonicalRelationshipManagerOperationsContextInput["cycle"];
  context: CanonicalRelationshipManagerOperationsContextInput["context"];
  operationsRequired: boolean;
  operationsIdentity?: CanonicalRelationshipManagerOperationsContextInput["operationsIdentity"];
}>;

export type CanonicalRelationshipManagerSourceHydrationEnvResult = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_SOURCE_HYDRATION_ENV_CONTRACT;
  brainConfigured: boolean;
  operationsConfigured: boolean;
  cycle: CanonicalRelationshipManagerOperationsContextResult;
  externalEffectPerformed: false;
}>;

function pair(valueA: string | undefined, valueB: string | undefined, code: string) {
  const a = valueA?.trim() ?? "";
  const b = valueB?.trim() ?? "";
  if (Boolean(a) !== Boolean(b)) throw new Error(code);
  return Object.freeze({ configured: Boolean(a && b), a, b });
}

function unavailableBrainPort(): BrainMemoryContextPort {
  return Object.freeze({
    contract: "business_brain_memory_context_port_v1" as const,
    async read() {
      throw new Error("BRAIN_MEMORY_CONTEXT_READ_UNAVAILABLE");
    },
  });
}

function unavailableOperationsPort(): OperationsCoreRelationshipSnapshotPort {
  return Object.freeze({
    contract: "business_operations_core_relationship_snapshot_port_v1" as const,
    async read() {
      throw new Error("OPERATIONS_RELATIONSHIP_READ_UNAVAILABLE");
    },
  });
}

function brainPort(env: RelationshipManagerCanonicalSourceEnv) {
  const config = pair(
    env.BRAIN_BASE_URL,
    env.BRAIN_API_TOKEN,
    "RELATIONSHIP_MANAGER_CANONICAL_BRAIN_READ_ENV_INCOMPLETE",
  );
  return Object.freeze({
    configured: config.configured,
    port: config.configured
      ? createBrainMemoryContextPort({ baseUrl: config.a, apiToken: config.b })
      : unavailableBrainPort(),
  });
}

function operationsPort(env: RelationshipManagerCanonicalSourceEnv) {
  const config = pair(
    env.OPERATIONS_CORE_BASE_URL,
    env.OPERATIONS_RELATIONSHIP_READ_TOKEN,
    "RELATIONSHIP_MANAGER_CANONICAL_OPERATIONS_READ_ENV_INCOMPLETE",
  );
  return Object.freeze({
    configured: config.configured,
    port: config.configured
      ? createOperationsCoreRelationshipSnapshotPort({ baseUrl: config.a, readToken: config.b })
      : unavailableOperationsPort(),
  });
}

export async function runCanonicalRelationshipManagerCycleWithSourcesFromEnv(
  input: CanonicalRelationshipManagerSourceHydrationEnvInput,
): Promise<CanonicalRelationshipManagerSourceHydrationEnvResult> {
  const brain = brainPort(input.env);
  const operations = operationsPort(input.env);
  const cycle = await runCanonicalRelationshipManagerCycleWithOperationsContext({
    cycle: input.cycle,
    context: input.context,
    brain: brain.port,
    operations: operations.port,
    operationsRequired: input.operationsRequired,
    operationsIdentity: input.operationsIdentity,
  });

  if (!brain.configured && cycle.brain.brainState !== "provider_unavailable") {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_BRAIN_ENV_READINESS_WIDENED");
  }
  if (
    input.operationsRequired
    && !operations.configured
    && cycle.operationsState !== "provider_unavailable"
  ) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_OPERATIONS_ENV_READINESS_WIDENED");
  }

  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_SOURCE_HYDRATION_ENV_CONTRACT,
    brainConfigured: brain.configured,
    operationsConfigured: operations.configured,
    cycle,
    externalEffectPerformed: false,
  });
}
