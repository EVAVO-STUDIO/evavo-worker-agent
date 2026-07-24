import type { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import { boundedJsonFailurePayload, isExplicitJsonConfirmation, readBoundedJsonObject } from "../core/boundedJsonRequest";
import { acquireManualResearchLease, manualResearchLeaseConflict, releaseManualResearchLease } from "../core/manualResearchLease";
import { bootstrapSourceExpansionSeeds, listSourceExpansionCandidates, runSourceExpansion } from "../core/sourceExpansionEngine";
import { learnSourceExpansionQuality, listSourceExpansionStrategyScores } from "../core/sourceExpansionLearning";
import { runSitemapSourceExpansion } from "../core/sourceExpansionSitemap";
import { listQueryHints, saveQueryHints } from "../core/sourceExpansionQueryHints";

type JsonResponse = (data: any, init?: ResponseInit) => Response;
type RequestReceipt = { contract: string; bytes: number; bodySha256: string };
type ConfirmedBodyResult =
  | { ok: true; body: Record<string, unknown>; requestReceipt: RequestReceipt }
  | { ok: false; response: Response };

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function boundedStrategy(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9:_-]{1,80}$/.test(normalized) ? normalized : undefined;
}

async function confirmedBody(request: Request, json: JsonResponse): Promise<ConfirmedBodyResult> {
  const parsed = await readBoundedJsonObject(request);
  if (!parsed.ok) return { ok: false, response: json(boundedJsonFailurePayload(parsed), { status: parsed.status }) };
  if (!isExplicitJsonConfirmation(parsed.value)) {
    return {
      ok: false,
      response: json({
        ok: false,
        error: "confirm_required",
        requiredPayload: { confirm: true },
        confirmationCoercionAllowed: false,
        requestBodyContract: parsed.contract,
      }, { status: 400 }),
    };
  }
  return {
    ok: true,
    body: parsed.value,
    requestReceipt: {
      contract: parsed.contract,
      bytes: parsed.bytes,
      bodySha256: parsed.bodySha256,
    },
  };
}

async function withResearchLease(
  env: Env,
  json: JsonResponse,
  actionKey: string,
  requestReceipt: RequestReceipt,
  run: () => Promise<Response>,
): Promise<Response> {
  const lease = await acquireManualResearchLease(env, actionKey, 900);
  if (!lease) return json({ ...manualResearchLeaseConflict(actionKey), requestReceipt }, { status: 409 });
  try {
    return await run();
  } finally {
    await releaseManualResearchLease(env, lease).catch(() => false);
  }
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
  if (!(await isAdminRequestAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (request.method === "OPTIONS") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "GET, POST" } });
  }

  if (pathname === "/admin/opportunities/sources/expansion/bootstrap") {
    if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "POST" } });
    const confirmed = await confirmedBody(request, json);
    if (!confirmed.ok) return confirmed.response;
    return json({ ...(await bootstrapSourceExpansionSeeds(env)), requestReceipt: confirmed.requestReceipt });
  }

  if (pathname === "/admin/opportunities/sources/expansion/scan") {
    if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "POST" } });
    const confirmed = await confirmedBody(request, json);
    if (!confirmed.ok) return confirmed.response;
    const body = confirmed.body;
    return withResearchLease(env, json, "source-expansion-scan", confirmed.requestReceipt, async () => {
      const result = await runSourceExpansion(env, {
        strategy: boundedStrategy(body.strategy),
        limitSeeds: boundedInteger(body.limitSeeds, 3, 1, 10),
        maxFetches: boundedInteger(body.maxFetches, 3, 1, 10),
        maxLinksPerSeed: boundedInteger(body.maxLinksPerSeed, 40, 5, 80),
        maxCandidates: boundedInteger(body.maxCandidates, 40, 5, 100),
      });
      return json({ ...result, leaseContract: "manual_research_lease_v1", requestReceipt: confirmed.requestReceipt, fallback: sourceExpansionFallback(result) });
    });
  }

  if (pathname === "/admin/opportunities/sources/expansion/sitemap-scan") {
    if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "POST" } });
    const confirmed = await confirmedBody(request, json);
    if (!confirmed.ok) return confirmed.response;
    const body = confirmed.body;
    return withResearchLease(env, json, "source-expansion-sitemap-scan", confirmed.requestReceipt, async () => json({
      ...(await runSitemapSourceExpansion(env, {
        limitSeeds: boundedInteger(body.limitSeeds, 3, 1, 10),
        maxFetches: boundedInteger(body.maxFetches, 4, 1, 10),
        maxSitemapUrls: boundedInteger(body.maxSitemapUrls, 50, 5, 100),
        maxCandidates: boundedInteger(body.maxCandidates, 30, 5, 100),
      })),
      leaseContract: "manual_research_lease_v1",
      requestReceipt: confirmed.requestReceipt,
    }));
  }

  if (pathname === "/admin/opportunities/sources/expansion/query-hints/generate") {
    if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "POST" } });
    const confirmed = await confirmedBody(request, json);
    if (!confirmed.ok) return confirmed.response;
    const result = await saveQueryHints(env, {
      limit: boundedInteger(confirmed.body.limit, 80, 1, 150),
      strategy: boundedStrategy(confirmed.body.strategy),
    });
    return json({ ...result, requestReceipt: confirmed.requestReceipt });
  }

  if (pathname === "/admin/opportunities/sources/expansion/query-hints") {
    if (request.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "GET" } });
    const url = new URL(request.url);
    return json(await listQueryHints(env, {
      status: url.searchParams.get("status") || "candidate",
      strategy: boundedStrategy(url.searchParams.get("strategy")),
      limit: boundedInteger(url.searchParams.get("limit"), 80, 1, 150),
    }));
  }

  if (pathname === "/admin/opportunities/sources/expansion/learn") {
    if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "POST" } });
    const confirmed = await confirmedBody(request, json);
    if (!confirmed.ok) return confirmed.response;
    return json({ ...(await learnSourceExpansionQuality(env)), requestReceipt: confirmed.requestReceipt });
  }

  if (pathname === "/admin/opportunities/sources/expansion/strategies") {
    if (request.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "GET" } });
    const url = new URL(request.url);
    return json(await listSourceExpansionStrategyScores(env, boundedInteger(url.searchParams.get("limit"), 50, 1, 100)));
  }

  if (pathname === "/admin/opportunities/sources/expansion/candidates") {
    if (request.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "GET" } });
    const url = new URL(request.url);
    return json(await listSourceExpansionCandidates(env, {
      status: url.searchParams.get("status") || "candidate",
      limit: boundedInteger(url.searchParams.get("limit"), 50, 1, 100),
    }));
  }

  return json({ ok: false, error: "Not found" }, { status: 404 });
}
