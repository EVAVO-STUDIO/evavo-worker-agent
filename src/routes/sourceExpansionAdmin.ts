import type { Env } from "../db";
import { getAdminToken } from "../db";
import { bootstrapSourceExpansionSeeds, listSourceExpansionCandidates, runSourceExpansion } from "../core/sourceExpansionEngine";
import { learnSourceExpansionQuality, listSourceExpansionStrategyScores } from "../core/sourceExpansionLearning";

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

export async function handleSourceExpansionAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });

  if (pathname === "/admin/opportunities/sources/expansion/bootstrap") {
    if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
    const body = await bodyJson(request);
    if (body?.confirm !== true) return json({ ok: false, error: "confirm_required" }, { status: 400 });
    return json(await bootstrapSourceExpansionSeeds(env));
  }

  if (pathname === "/admin/opportunities/sources/expansion/scan") {
    if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
    const body = await bodyJson(request);
    if (body?.confirm !== true) return json({ ok: false, error: "confirm_required" }, { status: 400 });
    const result = await runSourceExpansion(env, {
      strategy: typeof body?.strategy === "string" ? body.strategy : undefined,
      limitSeeds: boundedInteger(body?.limitSeeds, 3, 1, 10),
      maxFetches: boundedInteger(body?.maxFetches, 3, 1, 10),
      maxLinksPerSeed: boundedInteger(body?.maxLinksPerSeed, 40, 5, 80),
      maxCandidates: boundedInteger(body?.maxCandidates, 40, 5, 100),
    });
    return json(result);
  }

  if (pathname === "/admin/opportunities/sources/expansion/learn") {
    if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
    const body = await bodyJson(request);
    if (body?.confirm !== true) return json({ ok: false, error: "confirm_required" }, { status: 400 });
    return json(await learnSourceExpansionQuality(env));
  }

  if (pathname === "/admin/opportunities/sources/expansion/strategies") {
    if (request.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
    const url = new URL(request.url);
    return json(await listSourceExpansionStrategyScores(env, boundedInteger(url.searchParams.get("limit"), 50, 1, 100)));
  }

  if (pathname === "/admin/opportunities/sources/expansion/candidates") {
    if (request.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
    const url = new URL(request.url);
    return json(await listSourceExpansionCandidates(env, {
      status: url.searchParams.get("status") || "candidate",
      limit: boundedInteger(url.searchParams.get("limit"), 50, 1, 100),
    }));
  }

  return json({ ok: false, error: "Not found" }, { status: 404 });
}
