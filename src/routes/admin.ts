import type { Env, LeadBrief, LeadClass } from "../db";
import { getLeadById, getSetting, listDrafts, listEvents, listLeads, listSettings, logEvent, safeJsonParse, setSetting, updateDraft, updateLead } from "../db";
import { adminEnqueueSeeds, createDraftForLead, dailyTick, getInsights, getOverview, getRuns, runScanOnce, sendApprovedBatch } from "../engine";

function withCors(res: Response, origin: string | null) {
  const headers = new Headers(res.headers);
  headers.set("access-control-allow-origin", origin || "*");
  headers.set("access-control-allow-credentials", "true");
  headers.set("access-control-allow-headers", "Content-Type, Authorization");
  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set("vary", "Origin");
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(res.body, { status: res.status, headers });
}

function presentLead(lead: any) {
  const brief = safeJsonParse<LeadBrief>(lead.lead_brief_json || "{}", {
    companyName: lead.company_name,
    businessType: null,
    geoHint: null,
    summary: "",
    siteQualitySummary: "",
    siteFlags: [],
    serviceTags: [],
    techTags: [],
    outreachAngles: [],
    groundedFacts: [],
    avoidSaying: [],
    contactSummary: "",
    confidence: "low",
  });
  const allEmails = safeJsonParse<string[]>(lead.all_emails_json || "[]", []);
  const scoreBreakdown = safeJsonParse(lead.score_breakdown_json || "{}", {
    fit: lead.score_fit || 0,
    contactability: lead.score_contact || 0,
    opportunity: 0,
    risk: lead.score_risk || 0,
    total: lead.score_total || 0,
  });
  return {
    id: lead.id,
    website_url: lead.website_url,
    domain: (() => {
      try {
        return new URL(lead.website_url).hostname.replace(/^www\./i, "");
      } catch {
        return lead.website_url;
      }
    })(),
    title: lead.company_name,
    summary: brief.summary || brief.siteQualitySummary || "",
    category: lead.category,
    status: lead.status,
    contact_email: lead.contact_email,
    contact_emails: allEmails.join(", "),
    contact_page_url: lead.contact_page_url,
    has_contact_form: !!lead.has_contact_form,
    score: lead.score_total,
    score_total: lead.score_total,
    score_breakdown: scoreBreakdown,
    country: lead.country,
    region: lead.region,
    mode: "email",
    tech_stack: [...(brief.techTags || []), ...(brief.serviceTags || [])].join(", "),
    brief,
    lead_class: (lead.lead_class || "low_signal") as LeadClass,
    created_at_iso: lead.created_at_iso,
    updated_at_iso: lead.updated_at_iso,
    last_scanned_at_iso: lead.last_scanned_at_iso || lead.updated_at_iso,
  };
}

export async function handleAdmin(
  req: Request,
  env: Env,
  _ctx: ExecutionContext,
  url: URL,
  json: (data: any, init?: ResponseInit) => Response
): Promise<Response> {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return withCors(new Response(null, { status: 204 }), origin);
  const path = url.pathname.replace(/^\/+/, "").replace(/\/+$/, "");

  if (req.method === "GET" && path === "admin/overview") return withCors(json(await getOverview(env)), origin);

  if (req.method === "GET" && path === "admin/leads") {
    const limit = Math.min(250, Math.max(1, Number(url.searchParams.get("limit") || 150)));
    const status = (url.searchParams.get("status") || "").trim();
    const leads = await listLeads(env, { status: status || undefined, limit });
    return withCors(json({ ok: true, leads: leads.map(presentLead) }), origin);
  }

  if (req.method === "POST" && path === "admin/leads") {
    const body = await req.json().catch(() => ({}));
    const websiteUrl = String(body?.websiteUrl || body?.url || "");
    if (!websiteUrl) return withCors(json({ ok: false, error: "missing_website_url" }, { status: 400 }), origin);
    return withCors(json(await runScanOnce(env, websiteUrl)), origin);
  }

  if (req.method === "GET" && path === "admin/drafts") {
    const limit = Math.min(250, Math.max(1, Number(url.searchParams.get("limit") || 150)));
    const status = (url.searchParams.get("status") || "").trim();
    const drafts = await listDrafts(env, { status: status || undefined, limit });
    const leads = await listLeads(env, { limit: 250 });
    const leadMap = new Map(leads.map((lead) => [lead.id, presentLead(lead)]));
    return withCors(json({
      ok: true,
      drafts: drafts.map((draft) => ({
        ...draft,
        body_text: draft.body,
        to_email: leadMap.get(draft.lead_id)?.contact_email || null,
        to_name: leadMap.get(draft.lead_id)?.title || null,
      })),
    }), origin);
  }

  const approveMatch = /^admin\/drafts\/([^/]+)\/approve$/.exec(path);
  if (req.method === "POST" && approveMatch) {
    const id = decodeURIComponent(approveMatch[1]);
    const drafts = await listDrafts(env, { limit: 250 });
    const draft = drafts.find((item) => item.id === id);
    if (!draft) return withCors(json({ ok: false, error: "draft_not_found" }, { status: 404 }), origin);
    await updateDraft(env, id, { status: "approved" });
    await updateLead(env, draft.lead_id, { status: "approved" });
    await logEvent(env, "draft_approved", `Draft approved: ${id}`, draft.lead_id);
    return withCors(json({ ok: true }), origin);
  }

  const rejectMatch = /^admin\/drafts\/([^/]+)\/reject$/.exec(path);
  if (req.method === "POST" && rejectMatch) {
    const id = decodeURIComponent(rejectMatch[1]);
    const drafts = await listDrafts(env, { limit: 250 });
    const draft = drafts.find((item) => item.id === id);
    if (!draft) return withCors(json({ ok: false, error: "draft_not_found" }, { status: 404 }), origin);
    await updateDraft(env, id, { status: "rejected" });
    await updateLead(env, draft.lead_id, { status: "rejected" });
    await logEvent(env, "draft_rejected", `Draft rejected: ${id}`, draft.lead_id);
    return withCors(json({ ok: true }), origin);
  }

  if (req.method === "GET" && path === "admin/events") {
    const limit = Math.min(250, Math.max(1, Number(url.searchParams.get("limit") || 150)));
    return withCors(json({ ok: true, events: await listEvents(env, limit) }), origin);
  }

  if (req.method === "GET" && path === "admin/settings") {
    const settings = await listSettings(env);
    return withCors(json({ ok: true, settings }), origin);
  }

  if (req.method === "POST" && path === "admin/settings") {
    const body = await req.json().catch(() => ({}));
    const allowed = [
      "engine_enabled",
      "ai_enabled",
      "drafting_enabled",
      "sending_enabled",
      "approval_required",
      "crawl_cap_per_day",
      "draft_cap_per_day",
      "send_cap_per_day",
      "min_score_for_draft",
      "min_score_for_send",
      "engine_paused_reason",
    ];
    for (const key of allowed) {
      if (key in body) await setSetting(env, key, String(body[key]));
    }
    await logEvent(env, "settings_update", "Settings updated.");
    return withCors(json({ ok: true, settings: await listSettings(env) }), origin);
  }

  if (req.method === "GET" && path === "admin/insights") return withCors(json(await getInsights(env)), origin);
  if (req.method === "GET" && path === "admin/runs") return withCors(json(await getRuns(env)), origin);

  if (req.method === "POST" && path === "admin/run") {
    const body = await req.json().catch(() => ({}));
    const kind = String(body?.kind || "").toLowerCase();
    if (kind === "tick") {
      await dailyTick(env);
      return withCors(json({ ok: true, message: "Tick completed." }), origin);
    }
    if (kind === "scan") {
      const target = String(body?.url || "");
      if (!target) return withCors(json({ ok: false, error: "missing_url" }, { status: 400 }), origin);
      return withCors(json(await runScanOnce(env, target)), origin);
    }
    if (kind === "send") return withCors(json({ ok: true, result: await sendApprovedBatch(env) }), origin);
    if (kind === "draft") {
      const leads = await listLeads(env, { limit: 150 });
      const lead = leads.find((item) => item.status === "qualified" || item.status === "scanned");
      if (!lead) return withCors(json({ ok: true, message: "No eligible lead found." }), origin);
      const result = await createDraftForLead(env, lead);
      return withCors(json({ ok: true, result }), origin);
    }
    return withCors(json({ ok: false, error: "unknown_kind" }, { status: 400 }), origin);
  }

  if (req.method === "POST" && path === "admin/seeds") {
    const body = await req.json().catch(() => ({}));
    const urls = Array.isArray(body?.urls) ? body.urls.map((item: any) => String(item)) : [];
    if (!urls.length) return withCors(json({ ok: false, error: "missing_urls" }, { status: 400 }), origin);
    await adminEnqueueSeeds(env, urls);
    await logEvent(env, "seeds_add", `Added ${urls.length} seed URLs.`);
    return withCors(json({ ok: true, added: urls.length }), origin);
  }

  return withCors(json({ ok: false, error: "not_found" }, { status: 404 }), origin);
}
