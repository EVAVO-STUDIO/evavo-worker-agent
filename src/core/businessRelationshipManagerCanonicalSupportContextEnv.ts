import { createSupportRelationshipSnapshotPort, type SupportRelationshipSnapshotPort } from "./businessSupportRelationshipSnapshotPort";
import {
  runCanonicalRelationshipManagerCycleWithSupportContext,
  type CanonicalRelationshipManagerSupportContextInput,
  type CanonicalRelationshipManagerSupportContextResult,
} from "./businessRelationshipManagerCanonicalSupportContextRuntime";

export const BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_SUPPORT_CONTEXT_ENV_CONTRACT =
  "business_relationship_manager_canonical_support_context_env_v1" as const;

export type RelationshipManagerSupportSourceEnv = Readonly<{
  SUPPORT_AGENT_BASE_URL?: string;
  SUPPORT_RELATIONSHIP_READ_TOKEN?: string;
}>;

function configuredPort(env: RelationshipManagerSupportSourceEnv): Readonly<{
  configured: boolean;
  port: SupportRelationshipSnapshotPort;
}> {
  const baseUrl = env.SUPPORT_AGENT_BASE_URL?.trim() ?? "";
  const readToken = env.SUPPORT_RELATIONSHIP_READ_TOKEN?.trim() ?? "";
  if (Boolean(baseUrl) !== Boolean(readToken)) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_SUPPORT_READ_ENV_INCOMPLETE");
  }
  if (!baseUrl) {
    return Object.freeze({
      configured: false,
      port: Object.freeze({
        contract: "business_support_relationship_snapshot_port_v1" as const,
        async read() { throw new Error("SUPPORT_RELATIONSHIP_READ_UNAVAILABLE"); },
      }),
    });
  }
  return Object.freeze({
    configured: true,
    port: createSupportRelationshipSnapshotPort({ baseUrl, readToken }),
  });
}

export async function runCanonicalRelationshipManagerCycleWithSupportContextFromEnv(input: Readonly<{
  env: RelationshipManagerSupportSourceEnv;
  sourceHydration: CanonicalRelationshipManagerSupportContextInput["sourceHydration"];
  supportRequired: boolean;
  supportIdentity?: CanonicalRelationshipManagerSupportContextInput["supportIdentity"];
}>): Promise<Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_SUPPORT_CONTEXT_ENV_CONTRACT;
  supportConfigured: boolean;
  result: CanonicalRelationshipManagerSupportContextResult;
  externalEffectPerformed: false;
}>> {
  const support = configuredPort(input.env);
  const result = await runCanonicalRelationshipManagerCycleWithSupportContext({
    sourceHydration: input.sourceHydration,
    support: support.port,
    supportRequired: input.supportRequired,
    supportIdentity: input.supportIdentity,
  });
  if (input.supportRequired && !support.configured && result.supportState !== "provider_unavailable") {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_SUPPORT_ENV_READINESS_WIDENED");
  }
  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_SUPPORT_CONTEXT_ENV_CONTRACT,
    supportConfigured: support.configured,
    result,
    externalEffectPerformed: false,
  });
}