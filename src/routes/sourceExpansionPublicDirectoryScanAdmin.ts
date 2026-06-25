import type { Env } from "../db";
import { getAdminToken } from "../db";
import { runRelationshipGraphDiscovery } from "../core/sourceExpansionGraphDiscovery";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

function authorized(request: Request, env: Env): boolean {
  const token = getAdminToken(env);
  return Boolean(token && (request.headers.get("authorization") || "") === `Bearer ${token}`);
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

async function bodyJson(request: Request) {
  return request.json().catch(() => ({}));
}

export async function handleSourceExpansionPublicDirectoryScanAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (pathname !== "/admin/opportunities/sources/expansion/public-directory-scan") return json({ ok: false, error: "Not found" }, { status: 404 });
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await bodyJson(request);
  if (body?.confirm !== true) return json({ ok: false, error: "confirm_required" }, { status: 400 });

  return json(await runRelationshipGraphDiscovery(env, {
    limitSeeds: boundedInteger(body?.limitSeeds, 3, 1, 10),
    maxFetches: boundedInteger(body?.maxFetches, 3, 1, 10),
    maxLinksPerSeed: boundedInteger(body?.maxLinksPerSeed, 50, 10, 100),
    maxCandidates: boundedInteger(body?.maxCandidates, 40, 5, 100),
  }));
}
