import type { Env } from "../db";
import { getAdminToken } from "../db";
import { bootstrapSourceExpansionSeeds, listSourceExpansionCandidates, runSourceExpansion } from "../core/sourceExpansionEngine";
import { learnSourceExpansionQuality, listSourceExpansionStrategyScores } from "../core/sourceExpansionLearning";
import { runSitemapSourceExpansion } from "../core/sourceExpansionSitemap";
import { listQueryHints, saveQueryHints } from "../core/sourceExpansionQueryHints";

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

function sourceExpansionFallback(result: any) {
  if (!result?.ok) {
    return {
      state: "blocked",
      nextMethod: "fix_prerequisite",
      reason: result?.error || "source_expansion_unavailable",
      steps: ["Check required migrations", "Verify admin token and settings", "Retry the bounded scan after prerequisites pass"],
      guardrail: "Do not increase fetch depth while prerequisites are failing.",
    };
  }

  const seedsChecked = Number(result.seedsChecked || 0);
  const pagesFetched = Number(result.pagesFetched || 0);
  const linksFound = Number(result.linksFound || 0);
  const candidatesFound = Number(result.candidatesFound || 0);
  const candidatesNew = Number(result.candidatesNew || 0);
  const failed = Number(result.failed || 0);

  if (!seedsChecked) {
    return {
      state: "no_due_seeds",
      nextMethod: "bootstrap_or_rotate_strategy",
      reason: "No source-expansion seeds were due for this bounded scan.",
      steps: ["Bootstrap durable seeds", "Try All due instead of a narrow strategy", "Run sitemap/public-link discovery", "Use query hints if memory is exhausted"],
      guardrail: "Rotate method before raising limits or forcing deeper scans.",
    };
  }

  if (failed && !pagesFetched) {
    return {
      state: "all_fetches_failed",
      nextMethod: "source_health_or_sitemap",
      reason: `${failed} selected seed${failed === 1 ? "" : "s"} failed before useful pages were fetched.`,
      steps: ["Review source health", "Reset or pause failing seeds", "Try sitemap discovery from known domains", "Generate query hints for replacement sources"],
      guardrail: "Do not keep retrying failing seeds without health review or cooldown changes.",
    };
  }

  if (pagesFetched && !linksFound) {
    return {
      state: "thin_seed_pages",
      nextMethod: "sitemap_or_public_link_graph",
      reason: "Seed pages were reachable but produced no useful links.",
      steps: ["Run sitemap/robots scan", "Run public-link graph scan", "Open the seed manually to confirm page structure", "Use query hints if the page is a dead end"],
      guardrail: "Do not increase maxLinksPerSeed first; change discovery method.",
    };
  }

  if (linksFound && !candidatesFound) {
    return {
      state: "links_without_candidates",
      nextMethod: "query_hints_or_filter_review",
      reason: "Links were found, but none passed source-candidate scoring.",
      steps: ["Review rejected-count patterns", "Try a different strategy filter", "Use query hints for more targeted public sources", "Run learning before another scan"],
      guardrail: "Avoid saving weak links manually unless they are opened and clearly useful.",
    };
  }

  if (candidatesFound && !candidatesNew) {
    return {
      state: "known_or_duplicate_candidates",
      nextMethod: "candidate_review_or_origin_rotation",
      reason: "Candidates were found, but none were clearly new.",
      steps: ["Check duplicate and saved candidate filters", "Review source-origin metrics", "Rotate to sitemap/public-link/query-hint methods", "Promote only fresh strong candidates"],
      guardrail: "Do not treat duplicate rediscovery as new source coverage.",
    };
  }

  return {
    state: "fresh_candidates_found",
    nextMethod: "candidate_review",
    reason: `${candidatesNew} new candidate${candidatesNew === 1 ? "" : "s"} found from ${seedsChecked} seed${seedsChecked === 1 ? "" : "s"}.`,
    steps: ["Open candidate review", "Select recommended fresh candidates", "Confirm local metadata save only", "Test promoted sources before relying on them"],
    guardrail: "Saving candidate sources still requires explicit confirmation and never sends email or calls AI.",
  };
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
    return json({ ...result, fallback: sourceExpansionFallback(result) });
  }

  if (pathname === "/admin/opportunities/sources/expansion/sitemap-scan") {
    if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
    const body = await bodyJson(request);
    if (body?.confirm !== true) return json({ ok: false, error: "confirm_required" }, { status: 400 });
    return json(await runSitemapSourceExpansion(env, {
      limitSeeds: boundedInteger(body?.limitSeeds, 3, 1, 10),
      maxFetches: boundedInteger(body?.maxFetches, 4, 1, 10),
      maxSitemapUrls: boundedInteger(body?.maxSitemapUrls, 50, 5, 100),
      maxCandidates: boundedInteger(body?.maxCandidates, 30, 5, 100),
    }));
  }

  if (pathname === "/admin/opportunities/sources/expansion/query-hints/generate") {
    if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
    const body = await bodyJson(request);
    if (body?.confirm !== true) return json({ ok: false, error: "confirm_required" }, { status: 400 });
    return json(await saveQueryHints(env, {
      limit: boundedInteger(body?.limit, 80, 1, 150),
      strategy: typeof body?.strategy === "string" ? body.strategy : undefined,
    }));
  }

  if (pathname === "/admin/opportunities/sources/expansion/query-hints") {
    if (request.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
    const url = new URL(request.url);
    return json(await listQueryHints(env, {
      status: url.searchParams.get("status") || "candidate",
      strategy: url.searchParams.get("strategy") || undefined,
      limit: boundedInteger(url.searchParams.get("limit"), 80, 1, 150),
    }));
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
