import {
  Env,
  listLeads,
  listDrafts,
  updateLead,
  getSetting,
  listEvents,
  logEvent,
  getAdminToken,
  getDraftById,
  insertLead,
  getLeadById,
  parseLeadSignals,
} from "../db";
import { dailyTick, runDraftOnce, runScanOnce, runSendApproved } from "../engine";

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
  let qualityTier = weak ? "weak" : strong ? "strong" : "average";

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

async function handleOverview(env: Env, json: JsonResponse) {
  const counters = {
    crawl_scanned: Number((await getSetting(env, "crawl_scanned_today")) || 0),
    drafts_created: Number((await getSetting(env, "drafts_created_today")) || 0),
    sends_sent: Number((await getSetting(env, "sends_sent_today")) || 0),
    approvals: Number((await getSetting(env, "approvals_today")) || 0),
    replies: Number((await getSetting(env, "replies_today")) || 0),
    ai_calls: Number((await getSetting(env, "ai_calls")) || 0),
    bounces: Number((await getSetting(env, "bounces_today")) || 0),
    unsubscribes: Number((await getSetting(env, "unsubscribes_today")) || 0),
    day: new Date().toISOString().slice(0, 10),
  };
  const caps = {
    crawl: Number((await getSetting(env, "crawl_cap_per_day")) || env.CAP_CRAWL_PER_DAY || 60),
    drafts: Number((await getSetting(env, "draft_cap_per_day")) || env.CAP_DRAFTS_PER_DAY || 25),
    send: Number((await getSetting(env, "send_cap_per_day")) || env.CAP_SEND_PER_DAY || 12),
  };
  return json({ ok: true, counters, caps, lastRun: await getSetting(env, "last_engine_run") });
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
      directEmailRate: leads.length ? Number(((leads.filter((x) => !!x.contact_email).length / leads.length) * 100).toFixed(1)) : 0,
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
  for (const item of rawItems) {
    const url = String(item?.url || item || "").trim();
    if (!url) continue;
    const label = String(item?.label || body?.label || "manual");
    const type = String(item?.type || body?.type || "directory");
    const category = String(item?.category || body?.category || "general");
    const lead = await insertLead(env, url, `${type}:${label}:${category}`);
    inserted.push({ id: lead.id, url });
  }
  await logEvent(env, "seed_add", `Added ${inserted.length} seed URLs`);
  return json({ ok: true, inserted });
}

async function handleBackfill(env: Env, body: any, json: JsonResponse) {
  const limit = Math.max(1, Math.min(500, Number(body?.limit || 100)));
  const leads = await listLeads(env, { limit });
  let updated = 0;
  for (const lead of leads) {
    const derived = inferMetadata(lead);
    const signals = parseLeadSignals(lead) as any;
    const nextSignals = {
      ...signals,
      leadClass: derived.kind,
      opportunityType: derived.opportunityType,
      qualityTier: derived.qualityTier,
      draftStrategy: derived.draftStrategy,
      decisionSummary:
        derived.opportunityType === "white_label_partnership"
          ? "Likely partner candidate where EVAVO should position as quiet white-label support."
          : derived.opportunityType === "overflow_delivery_support"
          ? "Likely delivery partner candidate where overflow support could make sense."
          : derived.opportunityType === "lead_flow_uplift"
          ? "Good lead-generation opportunity for a service business."
          : derived.opportunityType === "conversion_optimisation"
          ? "Conversion-focused opportunity rather than a generic redesign pitch."
          : derived.opportunityType === "do_not_pitch"
          ? "Not a fit for outbound outreach."
          : "General improvement opportunity.",
    };
    await updateLead(env, lead.id, {
      category: derived.kind as any,
      signals_json: JSON.stringify(nextSignals),
    });
    updated += 1;
  }
  await logEvent(env, "backfill_ok", `Backfilled ${updated} leads`);
  return json({ ok: true, updated });
}

export async function handleAdmin(
  request: Request,
  env: Env,
  pathname: string,
  _ctx?: ExecutionContext,
  json: JsonResponse = defaultJson
) {
  if (request.method === "OPTIONS") return json({ ok: true });

  const token = getAdminToken(env);
  const auth = request.headers.get("authorization") || "";
  if (!token || auth !== `Bearer ${token}`) {
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (pathname === "/admin/overview" && request.method === "GET") return handleOverview(env, json);
  if (pathname === "/admin/leads" && request.method === "GET") return handleLeads(request, env, json);
  if (pathname === "/admin/drafts" && request.method === "GET") return handleDrafts(request, env, json);
  if (pathname === "/admin/events" && request.method === "GET") return json({ ok: true, events: await listEvents(env, 150) });
  if (pathname === "/admin/insights" && request.method === "GET") return handleInsights(env, json);
  if (pathname === "/admin/runs" && request.method === "GET") return json({ ok: true, runs: await listEvents(env, 100) });

  if (pathname === "/admin/settings" && request.method === "GET") {
    return json({
      ok: true,
      settings: {
        engine_enabled: (await getSetting(env, "engine_enabled")) || "1",
        ai_enabled: (await getSetting(env, "ai_enabled")) || "0",
        drafting_enabled: (await getSetting(env, "drafting_enabled")) || "1",
        sending_enabled: (await getSetting(env, "sending_enabled")) || "0",
        approval_required: (await getSetting(env, "approval_required")) || "1",
        crawl_cap_per_day: (await getSetting(env, "crawl_cap_per_day")) || String(env.CAP_CRAWL_PER_DAY || 60),
        draft_cap_per_day: (await getSetting(env, "draft_cap_per_day")) || String(env.CAP_DRAFTS_PER_DAY || 25),
        send_cap_per_day: (await getSetting(env, "send_cap_per_day")) || String(env.CAP_SEND_PER_DAY || 12),
        min_score_for_draft: (await getSetting(env, "min_score_for_draft")) || "0.45",
        min_score_for_send: (await getSetting(env, "min_score_for_send")) || "0.65",
      },
    });
  }

  if (pathname === "/admin/leads" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const websiteUrl = String(body?.websiteUrl || "").trim();
    if (!websiteUrl) return json({ ok: false, error: "websiteUrl is required" }, { status: 400 });
    const lead = await insertLead(env, websiteUrl, "manual");
    await logEvent(env, "lead_add", `Manually added ${websiteUrl}`, lead.id);
    return json({ ok: true, lead });
  }

  if (pathname === "/admin/seeds" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    return handleSeedInsert(env, body, json);
  }

  if (pathname === "/admin/run" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const kind = String(body?.kind || "");
    if (kind === "scan") return json({ ok: true, kind, ...(await runScanOnce(env)) });
    if (kind === "draft") return json({ ok: true, kind, ...(await runDraftOnce(env)) });
    if (kind === "send") return json({ ok: true, kind, ...(await runSendApproved(env)) });
    if (kind === "tick") {
      await dailyTick(env);
      return json({ ok: true, kind, finished: true });
    }
    if (kind === "backfill") return handleBackfill(env, body, json);
    return json({ ok: false, error: "Unsupported run kind" }, { status: 400 });
  }

  if (pathname.startsWith("/admin/drafts/") && pathname.endsWith("/approve") && request.method === "POST") {
    const id = pathname.split("/")[3];
    const draft = await getDraftById(env, id);
    if (!draft) return json({ ok: false, error: "Draft not found" }, { status: 404 });
    await updateLead(env, draft.lead_id, { status: "approved" as any });
    await env.DB.prepare(`UPDATE drafts SET status = 'approved', updated_at_iso = ? WHERE id = ?`)
      .bind(new Date().toISOString(), id)
      .run();
    await logEvent(env, "approve_ok", `Draft approved`, draft.lead_id);
    return json({ ok: true, id });
  }

  if (pathname.startsWith("/admin/drafts/") && pathname.endsWith("/reject") && request.method === "POST") {
    const id = pathname.split("/")[3];
    const draft = await getDraftById(env, id);
    if (!draft) return json({ ok: false, error: "Draft not found" }, { status: 404 });
    await updateLead(env, draft.lead_id, { status: "rejected" as any });
    await env.DB.prepare(`UPDATE drafts SET status = 'rejected', updated_at_iso = ? WHERE id = ?`)
      .bind(new Date().toISOString(), id)
      .run();
    await logEvent(env, "reject_ok", `Draft rejected`, draft.lead_id);
    return json({ ok: true, id });
  }

  return json({ ok: false, error: "Not found" }, { status: 404 });
}
