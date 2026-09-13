import {
  BUSINESS_DOCUMENT_RELATIONSHIP_SNAPSHOT_PORT_CONTRACT,
  createDocumentRelationshipSnapshotPort,
  type DocumentRelationshipSnapshotPort,
} from "./businessDocumentRelationshipSnapshotPort";
import {
  runCanonicalRelationshipManagerCycleWithDocumentContext,
  type CanonicalRelationshipManagerDocumentContextResult,
} from "./businessRelationshipManagerCanonicalDocumentContextRuntime";
import type { CanonicalRelationshipManagerSourceHydrationEnvInput, RelationshipManagerCanonicalSourceEnv } from "./businessRelationshipManagerCanonicalSourceHydrationEnv";
import { createSupportRelationshipSnapshotPort, type SupportRelationshipSnapshotPort } from "./businessSupportRelationshipSnapshotPort";

export const BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_FULL_SOURCE_HYDRATION_ENV_CONTRACT =
  "business_relationship_manager_canonical_full_source_hydration_env_v2" as const;

export type RelationshipManagerFullSourceEnv = RelationshipManagerCanonicalSourceEnv & Readonly<{
  OPERATIONS_DOCUMENT_READ_TOKEN?: string;
  SUPPORT_AGENT_BASE_URL?: string;
  SUPPORT_RELATIONSHIP_READ_TOKEN?: string;
}>;

export type CanonicalRelationshipManagerFullSourceHydrationInput = Readonly<{
  env: RelationshipManagerFullSourceEnv;
  sourceHydration: Omit<CanonicalRelationshipManagerSourceHydrationEnvInput, "env">;
  supportRequired: boolean;
  supportIdentity?: Readonly<{ organisationId: string; ticketId: string }> | null;
  documentRequired: boolean;
  documentIdentity?: Readonly<{ workspaceId: string; documentId: string }> | null;
}>;

export type CanonicalRelationshipManagerFullSourceHydrationResult = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_FULL_SOURCE_HYDRATION_ENV_CONTRACT;
  supportConfigured: boolean;
  documentConfigured: boolean;
  result: CanonicalRelationshipManagerDocumentContextResult;
  externalEffectPerformed: false;
}>;

function supportPort(env: RelationshipManagerFullSourceEnv): Readonly<{ configured: boolean; port: SupportRelationshipSnapshotPort }> {
  const baseUrl = env.SUPPORT_AGENT_BASE_URL?.trim() ?? "";
  const token = env.SUPPORT_RELATIONSHIP_READ_TOKEN?.trim() ?? "";
  if (Boolean(baseUrl) !== Boolean(token)) throw new Error("RELATIONSHIP_MANAGER_FULL_SOURCE_SUPPORT_ENV_INCOMPLETE");
  if (!baseUrl) return Object.freeze({
    configured: false,
    port: Object.freeze({
      contract: "business_support_relationship_snapshot_port_v1" as const,
      async read() { throw new Error("SUPPORT_RELATIONSHIP_READ_UNAVAILABLE"); },
    }),
  });
  return Object.freeze({ configured: true, port: createSupportRelationshipSnapshotPort({ baseUrl, readToken: token }) });
}

function documentPort(env: RelationshipManagerFullSourceEnv): Readonly<{ configured: boolean; port: DocumentRelationshipSnapshotPort }> {
  const baseUrl = env.OPERATIONS_CORE_BASE_URL?.trim() ?? "";
  const token = env.OPERATIONS_DOCUMENT_READ_TOKEN?.trim() ?? "";
  if (token && !baseUrl) throw new Error("RELATIONSHIP_MANAGER_FULL_SOURCE_DOCUMENT_ENV_INCOMPLETE");
  if (!baseUrl || !token) return Object.freeze({
    configured: false,
    port: Object.freeze({
      contract: BUSINESS_DOCUMENT_RELATIONSHIP_SNAPSHOT_PORT_CONTRACT,
      async read() { throw new Error("DOCUMENT_RELATIONSHIP_READ_UNAVAILABLE"); },
    }),
  });
  return Object.freeze({ configured: true, port: createDocumentRelationshipSnapshotPort({ baseUrl, readToken: token }) });
}

export async function runCanonicalRelationshipManagerCycleWithFullSourcesFromEnv(
  input: CanonicalRelationshipManagerFullSourceHydrationInput,
): Promise<CanonicalRelationshipManagerFullSourceHydrationResult> {
  const support = supportPort(input.env);
  const documents = documentPort(input.env);
  const result = await runCanonicalRelationshipManagerCycleWithDocumentContext({
    supportContext: {
      sourceHydration: { ...input.sourceHydration, env: input.env },
      supportRequired: input.supportRequired,
      ...(input.supportIdentity !== undefined ? { supportIdentity: input.supportIdentity } : {}),
    },
    support: support.port,
    documents: documents.port,
    documentRequired: input.documentRequired,
    ...(input.documentIdentity !== undefined ? { documentIdentity: input.documentIdentity } : {}),
  });
  if (input.supportRequired && !support.configured && result.support.supportState !== "provider_unavailable") {
    throw new Error("RELATIONSHIP_MANAGER_FULL_SOURCE_SUPPORT_READINESS_WIDENED");
  }
  if (input.documentRequired && !documents.configured && result.documentState !== "provider_unavailable") {
    throw new Error("RELATIONSHIP_MANAGER_FULL_SOURCE_DOCUMENT_READINESS_WIDENED");
  }
  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_FULL_SOURCE_HYDRATION_ENV_CONTRACT,
    supportConfigured: support.configured,
    documentConfigured: documents.configured,
    result,
    externalEffectPerformed: false,
  });
}