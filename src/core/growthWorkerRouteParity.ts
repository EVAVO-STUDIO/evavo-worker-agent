export const GROWTH_WORKER_ROUTE_PARITY_CONTRACT_VERSION =
  "growth_worker_route_parity_v1" as const;
export const GROWTH_WORKER_ROUTE_PARITY_MAX_JSON_BYTES = 4_096;
export const GROWTH_WORKER_PROPOSAL_INGEST_PATH =
  "/api/private/growth/worker-proposals" as const;

export const GROWTH_WORKER_ROUTE_ABSENT_BLOCKERS = Object.freeze([
  "next_website_ingestion_endpoint_not_implemented",
  "cross_repo_contract_tests_not_implemented",
] as const);

export const GROWTH_WORKER_ROUTE_PRESENT_BLOCKERS = Object.freeze([
  "worker_proposal_delivery_not_implemented",
  "cross_repo_contract_tests_not_implemented",
] as const);

export const GROWTH_WORKER_ROUTE_BLOCKERS_BY_PAGE_STATE = Object.freeze({
  absent: GROWTH_WORKER_ROUTE_ABSENT_BLOCKERS,
  present: GROWTH_WORKER_ROUTE_PRESENT_BLOCKERS,
} as const);

export const GROWTH_WORKER_ROUTE_CURRENT_PAGE_STATE = "present" as const;
export const GROWTH_WORKER_ROUTE_CURRENT_BLOCKERS =
  GROWTH_WORKER_ROUTE_BLOCKERS_BY_PAGE_STATE[GROWTH_WORKER_ROUTE_CURRENT_PAGE_STATE];

const ROUTE_PARITY_KEYS = Object.freeze([
  "contractVersion",
  "websiteRepository",
  "workerRepository",
  "path",
  "proposalVersion",
  "requestVersion",
  "bridgeVersion",
  "inventoryVersion",
  "nextApiAdapterVersion",
  "pageHandlerVersion",
  "pageState",
  "bridgeEnabled",
  "deliveryEnabled",
  "blockers",
] as const);

export type GrowthWorkerRoutePageState = keyof typeof GROWTH_WORKER_ROUTE_BLOCKERS_BY_PAGE_STATE;
export type GrowthWorkerRouteBlockingReason =
  | (typeof GROWTH_WORKER_ROUTE_ABSENT_BLOCKERS)[number]
  | (typeof GROWTH_WORKER_ROUTE_PRESENT_BLOCKERS)[number];

export type GrowthWorkerRouteParityContract = Readonly<{
  contractVersion: typeof GROWTH_WORKER_ROUTE_PARITY_CONTRACT_VERSION;
  websiteRepository: "EVAVO-STUDIO/next-website";
  workerRepository: "EVAVO-STUDIO/evavo-worker-agent";
  path: typeof GROWTH_WORKER_PROPOSAL_INGEST_PATH;
  proposalVersion: "growth_worker_proposal_v1";
  requestVersion: "growth_worker_request_v1";
  bridgeVersion: "growth_worker_bridge_v2";
  inventoryVersion: "growth_worker_route_inventory_v2";
  nextApiAdapterVersion: "growth_worker_next_api_adapter_v1";
  pageHandlerVersion: "growth_worker_proposal_page_handler_v1";
  pageState: GrowthWorkerRoutePageState;
  bridgeEnabled: false;
  deliveryEnabled: false;
  blockers: readonly GrowthWorkerRouteBlockingReason[];
}>;

type UnknownRecord = Record<string, unknown>;

function fail(code: string): never {
  throw new Error(code);
}

function objectValue(value: unknown): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("GROWTH_WORKER_ROUTE_PARITY_CONTRACT_INVALID");
  }
  return value as UnknownRecord;
}

function requireExactKeys(record: UnknownRecord): void {
  const actual = Object.keys(record).sort();
  const expected = [...ROUTE_PARITY_KEYS].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    fail("GROWTH_WORKER_ROUTE_PARITY_FIELDS_INVALID");
  }
}

function exactString<T extends string>(
  record: UnknownRecord,
  key: string,
  expected: T,
  code: string,
): T {
  if (record[key] !== expected) fail(code);
  return expected;
}

function exactBoolean<T extends boolean>(
  record: UnknownRecord,
  key: string,
  expected: T,
  code: string,
): T {
  if (record[key] !== expected) fail(code);
  return expected;
}

function pageStateValue(record: UnknownRecord): GrowthWorkerRoutePageState {
  const value = record.pageState;
  if (value !== "absent" && value !== "present") {
    fail("GROWTH_WORKER_ROUTE_PARITY_PAGE_STATE_INVALID");
  }
  return value;
}

export function growthWorkerRouteBlockersForPageState(
  pageState: GrowthWorkerRoutePageState,
): readonly GrowthWorkerRouteBlockingReason[] {
  const blockers = GROWTH_WORKER_ROUTE_BLOCKERS_BY_PAGE_STATE[pageState];
  if (!blockers) fail("GROWTH_WORKER_ROUTE_PARITY_PAGE_STATE_INVALID");
  return blockers;
}

function exactBlockers(
  record: UnknownRecord,
  pageState: GrowthWorkerRoutePageState,
): readonly GrowthWorkerRouteBlockingReason[] {
  const value = record.blockers;
  const expected = growthWorkerRouteBlockersForPageState(pageState);
  if (
    !Array.isArray(value) ||
    value.length !== expected.length ||
    value.some((item, index) => item !== expected[index])
  ) {
    fail("GROWTH_WORKER_ROUTE_PARITY_BLOCKERS_INVALID");
  }
  return Object.freeze([...expected]);
}

export function parseGrowthWorkerRouteParityContract(
  value: unknown,
): GrowthWorkerRouteParityContract {
  const record = objectValue(value);
  requireExactKeys(record);
  const pageState = pageStateValue(record);

  return Object.freeze({
    contractVersion: exactString(
      record,
      "contractVersion",
      GROWTH_WORKER_ROUTE_PARITY_CONTRACT_VERSION,
      "GROWTH_WORKER_ROUTE_PARITY_VERSION_INVALID",
    ),
    websiteRepository: exactString(
      record,
      "websiteRepository",
      "EVAVO-STUDIO/next-website",
      "GROWTH_WORKER_ROUTE_PARITY_WEBSITE_INVALID",
    ),
    workerRepository: exactString(
      record,
      "workerRepository",
      "EVAVO-STUDIO/evavo-worker-agent",
      "GROWTH_WORKER_ROUTE_PARITY_WORKER_INVALID",
    ),
    path: exactString(
      record,
      "path",
      GROWTH_WORKER_PROPOSAL_INGEST_PATH,
      "GROWTH_WORKER_ROUTE_PARITY_PATH_INVALID",
    ),
    proposalVersion: exactString(
      record,
      "proposalVersion",
      "growth_worker_proposal_v1",
      "GROWTH_WORKER_ROUTE_PARITY_PROPOSAL_VERSION_INVALID",
    ),
    requestVersion: exactString(
      record,
      "requestVersion",
      "growth_worker_request_v1",
      "GROWTH_WORKER_ROUTE_PARITY_REQUEST_VERSION_INVALID",
    ),
    bridgeVersion: exactString(
      record,
      "bridgeVersion",
      "growth_worker_bridge_v2",
      "GROWTH_WORKER_ROUTE_PARITY_BRIDGE_VERSION_INVALID",
    ),
    inventoryVersion: exactString(
      record,
      "inventoryVersion",
      "growth_worker_route_inventory_v2",
      "GROWTH_WORKER_ROUTE_PARITY_INVENTORY_VERSION_INVALID",
    ),
    nextApiAdapterVersion: exactString(
      record,
      "nextApiAdapterVersion",
      "growth_worker_next_api_adapter_v1",
      "GROWTH_WORKER_ROUTE_PARITY_ADAPTER_VERSION_INVALID",
    ),
    pageHandlerVersion: exactString(
      record,
      "pageHandlerVersion",
      "growth_worker_proposal_page_handler_v1",
      "GROWTH_WORKER_ROUTE_PARITY_HANDLER_VERSION_INVALID",
    ),
    pageState,
    bridgeEnabled: exactBoolean(
      record,
      "bridgeEnabled",
      false,
      "GROWTH_WORKER_ROUTE_PARITY_BRIDGE_PREMATURELY_ENABLED",
    ),
    deliveryEnabled: exactBoolean(
      record,
      "deliveryEnabled",
      false,
      "GROWTH_WORKER_ROUTE_PARITY_DELIVERY_PREMATURELY_ENABLED",
    ),
    blockers: exactBlockers(record, pageState),
  });
}

export function parseGrowthWorkerRouteParityJson(
  raw: string,
): GrowthWorkerRouteParityContract {
  if (
    typeof raw !== "string" ||
    raw.length === 0 ||
    new TextEncoder().encode(raw).byteLength > GROWTH_WORKER_ROUTE_PARITY_MAX_JSON_BYTES
  ) {
    fail("GROWTH_WORKER_ROUTE_PARITY_JSON_INVALID");
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    fail("GROWTH_WORKER_ROUTE_PARITY_JSON_INVALID");
  }

  const contract = parseGrowthWorkerRouteParityContract(value);
  if (`${JSON.stringify(contract, null, 2)}\n` !== raw) {
    fail("GROWTH_WORKER_ROUTE_PARITY_JSON_NOT_CANONICAL");
  }
  return contract;
}

export function assertGrowthWorkerRouteParityPageState(
  contract: GrowthWorkerRouteParityContract,
  actualPageState: GrowthWorkerRoutePageState,
): void {
  const parsed = parseGrowthWorkerRouteParityContract(contract);
  if (actualPageState !== "absent" && actualPageState !== "present") {
    fail("GROWTH_WORKER_ROUTE_PARITY_PAGE_STATE_INVALID");
  }
  if (parsed.pageState !== actualPageState) {
    fail("GROWTH_WORKER_ROUTE_PARITY_PAGE_STATE_MISMATCH");
  }
}
