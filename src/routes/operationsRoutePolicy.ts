export type OperationsRouteHandlerId =
  | "autonomy-settings"
  | "planner-routes"
  | "planner"
  | "source-batch"
  | "sources"
  | "draft-review"
  | "strategy-scores";

export type OperationsNetworkPosture = "none" | "read-only-research";

export type OperationsRoutePolicy = Readonly<{
  id: OperationsRouteHandlerId;
  priority: number;
  authentication: "handler-enforced";
  readMethods: readonly ("GET")[];
  writeMethods: readonly ("POST")[];
  writeConfirmation: "not-applicable" | "handler-enforced" | "handler-defined";
  mutationPosture: "read-only" | "mixed-internal";
  networkPosture: OperationsNetworkPosture;
  callsAI: false;
  canSendEmail: false;
  canPostSocial: false;
  canSubmitForms: false;
  matches(pathname: string): boolean;
}>;

const policies: readonly OperationsRoutePolicy[] = Object.freeze([
  Object.freeze({
    id: "autonomy-settings",
    priority: 10,
    authentication: "handler-enforced",
    readMethods: Object.freeze(["GET"] as const),
    writeMethods: Object.freeze(["POST"] as const),
    writeConfirmation: "handler-defined",
    mutationPosture: "mixed-internal",
    networkPosture: "none",
    callsAI: false,
    canSendEmail: false,
    canPostSocial: false,
    canSubmitForms: false,
    matches: (pathname: string) => pathname === "/admin/settings/autonomy",
  }),
  Object.freeze({
    id: "planner-routes",
    priority: 20,
    authentication: "handler-enforced",
    readMethods: Object.freeze(["GET"] as const),
    writeMethods: Object.freeze([] as const),
    writeConfirmation: "not-applicable",
    mutationPosture: "read-only",
    networkPosture: "none",
    callsAI: false,
    canSendEmail: false,
    canPostSocial: false,
    canSubmitForms: false,
    matches: (pathname: string) => pathname === "/admin/planner/routes",
  }),
  Object.freeze({
    id: "planner",
    priority: 30,
    authentication: "handler-enforced",
    readMethods: Object.freeze(["GET"] as const),
    writeMethods: Object.freeze(["POST"] as const),
    writeConfirmation: "handler-enforced",
    mutationPosture: "mixed-internal",
    networkPosture: "none",
    callsAI: false,
    canSendEmail: false,
    canPostSocial: false,
    canSubmitForms: false,
    matches: (pathname: string) => pathname === "/admin/planner" || pathname.startsWith("/admin/planner/"),
  }),
  Object.freeze({
    id: "source-batch",
    priority: 40,
    authentication: "handler-enforced",
    readMethods: Object.freeze([] as const),
    writeMethods: Object.freeze(["POST"] as const),
    writeConfirmation: "handler-enforced",
    mutationPosture: "mixed-internal",
    networkPosture: "read-only-research",
    callsAI: false,
    canSendEmail: false,
    canPostSocial: false,
    canSubmitForms: false,
    matches: (pathname: string) => pathname === "/admin/sources/run-tiny",
  }),
  Object.freeze({
    id: "sources",
    priority: 50,
    authentication: "handler-enforced",
    readMethods: Object.freeze(["GET"] as const),
    writeMethods: Object.freeze(["POST"] as const),
    writeConfirmation: "handler-defined",
    mutationPosture: "mixed-internal",
    networkPosture: "read-only-research",
    callsAI: false,
    canSendEmail: false,
    canPostSocial: false,
    canSubmitForms: false,
    matches: (pathname: string) => pathname.startsWith("/admin/sources") || pathname === "/admin/seeds",
  }),
  Object.freeze({
    id: "draft-review",
    priority: 60,
    authentication: "handler-enforced",
    readMethods: Object.freeze([] as const),
    writeMethods: Object.freeze(["POST"] as const),
    writeConfirmation: "handler-defined",
    mutationPosture: "mixed-internal",
    networkPosture: "none",
    callsAI: false,
    canSendEmail: false,
    canPostSocial: false,
    canSubmitForms: false,
    matches: (pathname: string) => pathname.startsWith("/admin/draft-review/"),
  }),
  Object.freeze({
    id: "strategy-scores",
    priority: 70,
    authentication: "handler-enforced",
    readMethods: Object.freeze(["GET"] as const),
    writeMethods: Object.freeze([] as const),
    writeConfirmation: "not-applicable",
    mutationPosture: "read-only",
    networkPosture: "none",
    callsAI: false,
    canSendEmail: false,
    canPostSocial: false,
    canSubmitForms: false,
    matches: (pathname: string) => pathname === "/admin/strategy-scores" || pathname.startsWith("/admin/strategy-scores/"),
  }),
]);

export const OPERATIONS_ROUTE_POLICIES: readonly OperationsRoutePolicy[] = policies;

export function resolveOperationsRouteHandlerId(pathname: string): OperationsRouteHandlerId | null {
  return policies.find((policy) => policy.matches(pathname))?.id ?? null;
}
