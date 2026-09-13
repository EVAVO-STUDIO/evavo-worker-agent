import type { Env } from "../db";
import { createBrainMemoryContextPort, type BrainMemoryContextPort } from "./businessBrainMemoryContextPort";
import {
  runCanonicalRelationshipManagerCycleWithBrainContext,
  type CanonicalRelationshipManagerBrainContextInput,
  type CanonicalRelationshipManagerBrainContextResult,
} from "./businessRelationshipManagerCanonicalBrainContextRuntime";

export const BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_BRAIN_CONTEXT_ENV_CONTRACT =
  "business_relationship_manager_canonical_brain_context_env_v2" as const;

function configuredPort(env: Pick<Env, "BRAIN_BASE_URL" | "BRAIN_API_TOKEN">): BrainMemoryContextPort {
  const baseUrl = env.BRAIN_BASE_URL?.trim() ?? "";
  const apiToken = env.BRAIN_API_TOKEN?.trim() ?? "";
  if (Boolean(baseUrl) !== Boolean(apiToken)) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_BRAIN_READ_ENV_INCOMPLETE");
  }
  if (!baseUrl && !apiToken) {
    return Object.freeze({
      contract: "business_brain_memory_context_port_v2" as const,
      async read() {
        throw new Error("BRAIN_MEMORY_CONTEXT_READ_UNAVAILABLE");
      },
    });
  }
  return createBrainMemoryContextPort({ baseUrl, apiToken });
}

export async function runCanonicalRelationshipManagerCycleWithBrainContextFromEnv(input: Readonly<{
  env: Pick<Env, "BRAIN_BASE_URL" | "BRAIN_API_TOKEN">;
  cycle: CanonicalRelationshipManagerBrainContextInput["cycle"];
  context: CanonicalRelationshipManagerBrainContextInput["context"];
}>): Promise<CanonicalRelationshipManagerBrainContextResult> {
  return runCanonicalRelationshipManagerCycleWithBrainContext({
    cycle: input.cycle,
    context: input.context,
    brain: configuredPort(input.env),
  });
}
