import {
  Env,
  listLeads,
  listDrafts,
  updateLead,
  getSetting,
  listEvents,
  logEvent,
  getAdminToken,
  insertLead,
  getLeadById,
  parseLeadSignals,
} from "../db";
import { buildHealthReport, buildDiagnosticsReport } from "../core/health";
import { buildSchemaReport } from "../core/schema";

type JsonResponse = (data: any, init?: ResponseInit) => Response;
type InferredKind = "agency" | "contractor" | "ecommerce" | "service" | "not_fit" | "general";

function defaultJson(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "Content-Type, Authorization",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      ...(init.headers || {}),
    },
  });
}

function inferKind(lead: any): InferredKind {
  const hay = JSON.stringify({
    website: lead.website_url || "",
    category: lead.category || "",
    company_name: lead.company_name || "",
    signals_json: lead.signals_json || "",
  }).toLowerCase();

  if (/(government|council|school|university|charity|nonprofit|not-for-profit|foundation)/.test(hay)) return "not_fit";
  if (/(agency|studio|creative|branding|marketing agency|seo agency|web design|development company|developers|software studio|app development|white label|partner)/.test(hay)) return "agency";
  if (/(builder|construction|joinery|cabinet|plumber|electrician|roofing|glazing|concrete|carpentry|landscap|civil contractor|earthworks|fabrication)/.test(hay)) return "contractor";
  if (/(ecommerce|shopify|checkout|cart|product)/.test(hay)) return "ecommerce";
  if (/(dentist|lawyer|accountant|clinic|cleaning|mechanic|repairs|service business|local service)/.test(hay)) return "service";
  return "general";
}

function inferMetadata(lead: any) {
  const kind = inferKind(lead);
  const signals = parseLeadSignals(lead) as any;
  const text = JSON.stringify(signals || {}).toLowerCase();
  const weak = /wix|squarespace|weebly|template|placeholder|coming soon|under construction/.test(text);
  const strong = /react|webflow|shopify|wordpress/.test(text);

  let opportunityType = "positioning_improvement";
  let draftStrategy = "light_teardown_offer";
  const qualityTier = weak ? "weak" : strong ? "strong" : "average";

  if (kind === "agency") {
    opportunityType = /white.?label|partner/.test(text) ? "white_label_partnership" : "overflow_delivery_support";
    draftStrategy = opportunityType === "white_label_partnership" ? "white_label_partnership" : "overflow_delivery_support";
  } else if (kind === "contractor" || kind === "service") {
    opportunityType = weak ? "site_rebuild" : "lead_flow_uplift";
    draftStrategy = "contractor_lead_uplift";
  } else if (kind === "ecommerce") {
    opportunityType = "conversion_optimisation";
    draftStrategy = "ecommerce_conversion_offer";
  } else if (kind === "not_fit") {
    opportunityType = "do_not_pitch";
    draftStrategy = "do_not_send";
  } else if (weak) {
    opportunityType = "site_rebuild";
    draftStrategy = "site_rebuild_offer";
  }

  return { kind, opportunityType, qualityTier, draftStrategy };
}

function withDerivedLead(lead: any) {
  const derived = inferMetadata(lead);
  const signals = parseLeadSignals(lead) as any;
  return {
    ...lead,
    website: lead.website_url || "",
    domain: String(lead.website_url || "").replace(/^https?:\/\//, "").replace(/\/+$/, ""),
    lead_class: signals.leadClass || derived.kind,
    opportunity_type: signals.opportunityType || derived.opportunityType,
    quality_tier: signals.qualityTier || derived.qualityTier,
    draft_strategy: signals.draftStrategy || derived.draftStrategy,
    brief: {
      summary: signals.summary || signals.brief || "",
      siteQualitySummary: signals.siteQualitySummary || "",
      contactSummary: signals.contactSummary || "",
      outreachAngles: signals.outreachAngles || [],
      groundedFacts: signals.groundedFacts || [],
      avoidSaying: signals.avoidSaying || [],
      decisionSummary: signals.decisionSummary || "",
    },
    score_breakdown: {
      fit: lead.score_fit || 0,
      contactability: lead.score_contact || 0,
      risk: lead.score_risk || 0,
    },
    score_total: lead.score_total || 0,
    summary: signals.summary || signals.brief || "",
    title: signals.title || "",
    category: lead.category || derived.kind,
  };
}

function inferCountryFromUrl(url: string): string {
  const lower = String(url || "").toLowerCase();
  if (lower.includes(".co.nz") || lower.includes(".nz/") || lower.endsWith(".nz")) return "NZ";
  return "AU";
}

function isDirectorySource(url: string, type: string, label: string): boolean {
  const lower = `${url} ${type} ${label}`.toLowerCase();
  return /truelocal|yellowpages|hipages|directory/.test(lower);
}

async function handleLeads(request: Request, env: Env, json: JsonResponse) {
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || 100)));
  const status = url.searchParams.get("status") || undefined;
  const leads = (await listLeads(env, { status: status as any, limit })).map(withDerivedLead);
  return json({ ok: true, leads });
}

async function handleDrafts(request: Request, env: Env, json: JsonResponse) {
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || 100)));
  const status = url.searchParams.get("status") || undefined;
  const drafts = await listDrafts(env, { status: status as any, limit });
  const enriched = [];
  for (const draft of drafts) {
    const lead = await getLeadById(env, draft.lead_id);
    enriched.push({
      ...draft,
      to_email: lead?.contact_email || null,
      to_name: lead?.company_name || null,
      website: lead?.website_url || null,
    });
  }
  return json({ ok: true, drafts: enriched });
}

async function handleInsights(env: Env, json: JsonResponse) {
  const leads = (await listLeads(env, { limit: 500 })).map(withDerivedLead);
  const leadClasses: Record<string, number> = {};
  const qualityTiers: Record<string, number> = {};
  const opportunityTypes: Record<string, number> = {};
  const statuses: Record<string, number> = {};
  let contactable = 0;
  let totalScore = 0;

  for (const lead of leads) {
    leadClasses[lead.lead_class] = (leadClasses[lead.lead_class] || 0) + 1;
    qualityTiers[lead.quality_tier] = (qualityTiers[lead.quality_tier] || 0) + 1;
    opportunityTypes[lead.opportunity_type] = (opportunityTypes[lead.opportunity_type] || 0) + 1;
    statuses[lead.status] = (statuses[lead.status] || 0) + 1;
    if (lead.contact_email || lead.contact_page_url || lead.has_contact_form) contactable += 1;
    totalScore += Number(lead.score_total || 0);
  }

  return json({
    ok: true,
    summary: {
      totalLeads: leads.length,
      contactableLeads: contactable,
      directEmailRate: leads.length ? Number(((leads.filter((item) => Boolean(item.contact_email)).length / leads.length) * 100).toFixed(1)) : 0,
      averageScore: leads.length ? Number((totalScore / leads.length).toFixed(2)) : 0,
    },
    leadClasses,
    qualityTiers,
    opportunityTypes,
    statuses,
  });
}

async function handleSeedInsert(env: Env, body: any, json: JsonResponse) {
  const rawItems = Array.isArray(body?.items)
    ? body.items
    : Array.isArray(body?.urls)
      ? body.urls.map((url: string) => ({ url }))
      : [];
  const inserted = [];
  const requeued = [];

  for (const item of rawItems) {
    const url = String(item?.url || item || "").trim();
    if (!url) continue;

    const label = String(item?.label || body?.label || "manual");
    const type = String(item?.type || body?.type || "directory");
    const category = String(item?.category || body?.category || "general");
    const country = String(item?.country || body?.country || inferCountryFromUrl(url) || "AU").toUpperCase();
    const region = item?.region ? String(item.region) : null;
    const discoverySource = `${type}:${label}:${category}`;

    const lead = await insertLead(env, {
      websiteUrl: url,
      discoverySource,
      category,
      country,
      region,
      signalsJson: "{}",
    });

    if (isDirectorySource(url, type, label)) {
      await updateLead(env, lead.id, {
        category: category as any,
        country,
        region,
        discovery_source: discoverySource,
        signals_json: "{}",
        contact_email: null,
        contact_page_url: null,
        has_contact_form: 0,
        score_fit: 0,
        score_contact: 0,
        score_risk: 0,
        score_total: 0,
        status: "new",
      });
      requeued.push({ id: lead.id, url, status: "new" });
    }

    inserted.push({ id: lead.id, url, country, category });
  }

  await logEvent(env, "seed_add", `Added or refreshed ${inserted.length} seed URLs`);
  return json({ ok: true, inserted, requeued });
}

export async function handleAdmin(
  request: Request,
  env: Env,
  pathname: string,
  _ctx?: any,
  json: JsonResponse = defaultJson,
) {
  if (request.method === "OPTIONS") return json({ ok: true });

  const token = getAdminToken(env);
  const auth = request.headers.get("authorization") || "";
  if (!token || auth !== `Bearer ${token}`) {
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (pathname === "/admin/health" && request.method === "GET") return json(await buildHealthReport(env));
  if (pathname === "/admin/diagnostics" && request.method === "GET") {
    const url = new URL(request.url);
    return json(await buildDiagnosticsReport(env, { deep: url.searchParams.get("deep") === "1", confirm: url.searchParams.get("confirm") === "1" }));
  }
  if (pathname === "/admin/schema" && request.method === "GET") return json(await buildSchemaReport(env));
  if (pathname === "/admin/leads" && request.method === "GET") return handleLeads(request, env, json);
  if (pathname === "/admin/drafts" && request.method === "GET") return handleDrafts(request, env, json);
  if (pathname === "/admin/events" && request.method === "GET") return json({ ok: true, events: await listEvents(env, 150) });
  if (pathname === "/admin/insights" && request.method === "GET") return handleInsights(env, json);
  if (pathname === "/admin/runs" && request.method === "GET") return json({ ok: true, runs: await listEvents(env, 100) });

  if (pathname === "/admin/leads" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const websiteUrl = String(body?.websiteUrl || "").trim();
    if (!websiteUrl) return json({ ok: false, error: "websiteUrl is required" }, { status: 400 });

    const lead = await insertLead(env, {
      websiteUrl,
      discoverySource: "manual",
      category: String(body?.category || "general"),
      country: String(body?.country || inferCountryFromUrl(websiteUrl) || "AU").toUpperCase(),
      region: body?.region ? String(body.region) : null,
      signalsJson: "{}",
    });

    await logEvent(env, "lead_add", `Manually added ${websiteUrl}`, lead.id);
    return json({ ok: true, lead });
  }

  if (pathname === "/admin/seeds" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    return handleSeedInsert(env, body, json);
  }

  return json({ ok: false, error: "Not found" }, { status: 404 });
}
