export type WorkerRouteFamilyId = "health" | "admin" | "tools" | "public" | "root";
export type WorkerRouteExposure = "public" | "protected";
export type WorkerRouteAuthentication = "none" | "handler-enforced";
export type WorkerRouteMutationPosture = "read-only" | "mixed-internal";

export type WorkerRouteFamilyPolicy = Readonly<{
  id: WorkerRouteFamilyId;
  exposure: WorkerRouteExposure;
  authentication: WorkerRouteAuthentication;
  mutationPosture: WorkerRouteMutationPosture;
  priority: number;
  matches(pathname: string): boolean;
}>;

const policies: readonly WorkerRouteFamilyPolicy[] = Object.freeze([
  Object.freeze({
    id: "health",
    exposure: "public",
    authentication: "none",
    mutationPosture: "read-only",
    priority: 10,
    matches: (pathname: string) => pathname === "/health",
  }),
  Object.freeze({
    id: "admin",
    exposure: "protected",
    authentication: "handler-enforced",
    mutationPosture: "mixed-internal",
    priority: 20,
    matches: (pathname: string) => pathname.startsWith("/admin"),
  }),
  Object.freeze({
    id: "tools",
    exposure: "protected",
    authentication: "handler-enforced",
    mutationPosture: "mixed-internal",
    priority: 30,
    matches: (pathname: string) => pathname.startsWith("/tools"),
  }),
  Object.freeze({
    id: "public",
    exposure: "public",
    authentication: "none",
    mutationPosture: "read-only",
    priority: 40,
    matches: (pathname: string) => pathname.startsWith("/public"),
  }),
  Object.freeze({
    id: "root",
    exposure: "public",
    authentication: "none",
    mutationPosture: "read-only",
    priority: 50,
    matches: (pathname: string) => pathname === "/" || pathname === "",
  }),
]);

export const WORKER_ROUTE_FAMILY_POLICIES: readonly WorkerRouteFamilyPolicy[] = policies;

export function getWorkerRouteFamilyPolicy(id: WorkerRouteFamilyId): WorkerRouteFamilyPolicy {
  const policy = policies.find((candidate) => candidate.id === id);
  if (!policy) throw new Error(`WORKER_ROUTE_FAMILY_POLICY_MISSING:${id}`);
  return policy;
}

export function matchesWorkerRouteFamily(id: WorkerRouteFamilyId, pathname: string): boolean {
  return getWorkerRouteFamilyPolicy(id).matches(pathname);
}
