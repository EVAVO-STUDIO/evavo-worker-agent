import type { Env } from "../db";
import { buildBusinessAccount360 } from "./businessAccount360";
import {
  BUSINESS_ACCOUNT_360_SNAPSHOT_CONTRACT,
  type BusinessAccount360Snapshot,
  readBusinessAccount360Snapshot,
} from "./businessAccount360Snapshot";

type Row = Record<string, unknown>;
type Account360Result = Awaited<ReturnType<typeof buildBusinessAccount360>>;

function snapshotRows(
  snapshot: BusinessAccount360Snapshot,
  sql: string,
): readonly Row[] {
  if (sql.includes("FROM business_organizations")) {
    return Object.freeze([snapshot.organization]);
  }
  if (sql.includes("FROM business_people")) return snapshot.people;
  if (sql.includes("FROM business_websites")) return snapshot.websites;
  if (sql.includes("FROM business_pages")) return snapshot.pages;
  if (sql.includes("FROM business_website_audit_runs")) return snapshot.auditRuns;
  if (sql.includes("FROM business_audit_observations")) return snapshot.auditObservations;
  if (sql.includes("FROM business_signals")) return snapshot.signals;
  if (sql.includes("FROM business_opportunities")) return snapshot.opportunities;
  if (sql.includes("FROM business_service_matches")) return snapshot.serviceMatches;
  if (sql.includes("FROM business_audit_packs")) return snapshot.auditPacks;
  if (sql.includes("FROM business_followups")) return snapshot.followups;
  throw new Error("BUSINESS_ACCOUNT_360_SNAPSHOT_QUERY_UNKNOWN");
}

function inMemorySnapshotEnv(
  env: Env,
  snapshot: BusinessAccount360Snapshot,
): Env {
  const DB = {
    prepare(sql: string) {
      const records = snapshotRows(snapshot, sql);
      let bound = false;
      return {
        bind() {
          bound = true;
          return this;
        },
        async first<T>() {
          if (!bound) throw new Error("BUSINESS_ACCOUNT_360_SNAPSHOT_BIND_REQUIRED");
          if (!sql.includes("FROM business_organizations")) {
            throw new Error("BUSINESS_ACCOUNT_360_SNAPSHOT_FIRST_INVALID");
          }
          return (records[0] ?? null) as T | null;
        },
        async all<T>() {
          if (!bound) throw new Error("BUSINESS_ACCOUNT_360_SNAPSHOT_BIND_REQUIRED");
          if (sql.includes("FROM business_organizations")) {
            throw new Error("BUSINESS_ACCOUNT_360_SNAPSHOT_ALL_INVALID");
          }
          return {
            success: true,
            results: records.map((record) => ({ ...record })) as T[],
          };
        },
      };
    },
  } as unknown as D1Database;

  return Object.freeze({ ...env, DB });
}

export async function buildBusinessAccount360Batched(
  env: Env,
  organizationId: string,
  limit: number,
  observedAt = Date.now(),
): Promise<Account360Result> {
  const snapshot = await readBusinessAccount360Snapshot(
    env,
    organizationId,
    limit,
  );
  if (!snapshot) return null;

  const account = await buildBusinessAccount360(
    inMemorySnapshotEnv(env, snapshot),
    organizationId,
    limit,
    observedAt,
  );
  if (!account) {
    throw new Error("BUSINESS_ACCOUNT_360_SNAPSHOT_ORGANIZATION_LOST");
  }

  return Object.freeze({
    ...account,
    snapshotEvidenceContract: BUSINESS_ACCOUNT_360_SNAPSHOT_CONTRACT,
    deterministicIndicators: Object.freeze({
      ...account.deterministicIndicators,
      snapshotConsistency: snapshot.snapshotConsistency,
      snapshotStatementCount: snapshot.statementCount,
    }),
  });
}
