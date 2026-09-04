import type { Env } from "../db";
import {
  createBrainMemoryIngestionPort,
  type BrainMemoryIngestionPort,
} from "./businessBrainMemoryIngestionPort";

export const BUSINESS_BRAIN_MEMORY_INGESTION_ENV_CONTRACT =
  "business_brain_memory_ingestion_env_v1" as const;

export type BrainMemoryIngestionEnvStatus = Readonly<{
  contract: typeof BUSINESS_BRAIN_MEMORY_INGESTION_ENV_CONTRACT;
  configured: boolean;
  complete: boolean;
  missing: readonly ("BRAIN_BASE_URL" | "BRAIN_API_TOKEN" | "BRAIN_RELATIONSHIP_MEMORY_WRITE_TOKEN")[];
}>;

const KEYS = [
  "BRAIN_BASE_URL",
  "BRAIN_API_TOKEN",
  "BRAIN_RELATIONSHIP_MEMORY_WRITE_TOKEN",
] as const;

type BrainEnvKey = (typeof KEYS)[number];

function clean(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function inspectBrainMemoryIngestionEnv(env: Pick<Env, BrainEnvKey>): BrainMemoryIngestionEnvStatus {
  const missing = KEYS.filter((key) => !clean(env[key]));
  const configured = missing.length < KEYS.length;
  return Object.freeze({
    contract: BUSINESS_BRAIN_MEMORY_INGESTION_ENV_CONTRACT,
    configured,
    complete: missing.length === 0,
    missing: Object.freeze([...missing]),
  });
}

export function requireBrainMemoryIngestionPortFromEnv(
  env: Pick<Env, BrainEnvKey>,
): BrainMemoryIngestionPort {
  const status = inspectBrainMemoryIngestionEnv(env);
  if (!status.complete) {
    throw new Error(`BRAIN_MEMORY_INGESTION_ENV_INCOMPLETE:${status.missing.join(",")}`);
  }
  return createBrainMemoryIngestionPort({
    baseUrl: clean(env.BRAIN_BASE_URL),
    apiToken: clean(env.BRAIN_API_TOKEN),
    scopedWriteToken: clean(env.BRAIN_RELATIONSHIP_MEMORY_WRITE_TOKEN),
  });
}
