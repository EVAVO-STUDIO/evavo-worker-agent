import type { Env, LeadRow, DraftRow, EventRow } from "../db";
import {
  listLeads,
  listDrafts,
  updateLead,
  updateDraft,
  getSetting,
  setSetting,
  getTodayStats,
  listEvents,
  logEvent,
  bump,
  parseLeadSignals,
  getAdminToken,
  getDraftById,
} from "../db";
import { dailyTick, runScanOnce, runDraftOnce, runSendApproved, scanWebsiteNow } from "../engine";

function badRequest(json: (data: any, init?: ResponseInit) => Response, error: string): Response {
  return json({ ok: false, error }, { status: 400 });
}

function unauthorized(json: (data: any, init?: ResponseInit) => Response): Response {
  return json({ ok: false, error: "unauthorized" }, { status: 401 });
}

function getBearerToken(req: Request): string {
  const header = req.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function confidenceForScore(score: number): "low" | "medium" | "high" {
  if (score >= 0.75) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

function mapLead(lead: LeadRow) {
  const signals = parseLeadSignals(lead);
  const domain = String(lead.website_url).replace(/^https?:\/\//i, "").replace(/\/$/, "");

  return {
    id: lead.id,
    website_url: lead.website_url,
    website: lead.website_url,
    domain,
    title: signals.title || lead.company_name || "",
    summary: signals.brief || signals.summary || "",
    category: lead.category || "general",
    status: lead.status,
    contact_email: lead.contact_email || null,
    contact_emails: lead.contact_email ? JSON.stringify([lead.contact_email]) : null,
    contact_page_url: lead.contact_page_url || null,
    has_contact_form: Boolean(lead.has_contact_form),
    score: Number(lead.score_total || 0),
    score_total: Number(lead.score_total || 0),
    score_breakdown: {
      fit: Number(lead.score_fit || 0),
      contactability: Number(lead.score_contact || 0),
      risk: Number(lead.score_risk || 0),
      total: Number(lead.score_total || 0),
    },
    country: lead.country || null,
    region: lead.region || null,
    mode: "heuristic",
    tech_stack: Array.isArray(signals.techTags) ? signals.techTags.join(", ") : null,
    brief: {
      summary: signals.brief || signals.summary || "",
      siteQualitySummary: signals.siteQualitySummary || "",
      serviceTags: Array.isArray(signals.serviceTags) ? signals.serviceTags : [],
      techTags: Array.isArray(signals.techTags) ? signals.techTags : [],
      outreachAngles: Array.isArray(signals.outreachAngles) ? signals.outreachAngles : [],
      groundedFacts: Array.isArray(signals.groundedFacts) ? signals.groundedFacts : [],
      avoidSaying: Array.isArray(signals.avoidSaying) ? signals.avoidSaying : [],
      contactSummary: signals.contactSummary || "",
      confidence: confidenceForScore(Number(lead.score_total || 0)),
    },
    lead_class: lead.category || "general",
    created_at_iso: lead.created_at_iso,
    updated_at_iso: lead.updated_at_iso,
    last_scanned_at_iso: lead.updated_at_iso,
  };
}

async function mapDraft(env: Env, draft: DraftRow) {
  const lead = await env.DB.prepare(
    `SELECT company_name, website_url, contact_email
     FROM leads
     WHERE id = ?
     LIMIT 1`
  )
    .bind(draft.lead_id)
    .first<{ company_name: string | null; website_url: string; contact_email: string | null }>();

  const displayName = lead?.company_name || String(lead?.website_url || draft.lead_id).replace(/^https?:\/\//i, "").replace(/\/$/, "");

  return {
    id: draft.id,
    lead_id: draft.lead_id,
    status: draft.status === "created" ? "queued" : draft.status,
    subject: draft.subject,
    body_text: draft.body_text,
    followup_text: draft.followup_text || null,
    why_json: draft.why_json || null,
    to_name: displayName,
    to_email: lead?.contact_email || null,
    created_at_iso: draft.created_at_iso,
    updated_at_iso: draft.updated_at_iso,
  };
}

async function getCaps(env: Env) {
  return {
    crawl: Number((await getSetting(env, "crawl_cap_per_day")) || env.CAP_CRAWL_PER_DAY || 60),
    drafts: Number((await getSetting(env, "draft_cap_per_day")) || env.CAP_DRAFTS_PER_DAY || 25),
    send: Number((await getSetting(env, "send_cap_per_day")) || env.CAP_SEND_PER_DAY || 12),
  };
}

function mapEvent(event: EventRow) {
  return {
    id: event.id,
    type: event.type,
    message: event.message,
    lead_id: event.lead_id || null,
    created_at_iso: event.created_at_iso,
  };
}

export async function handleAdmin(
  req: Request,
  env: Env,
  _ctx: ExecutionContext,
  url: URL,
  json: (data: any, init?: ResponseInit) => Response
): Promise<Response> {
  const adminToken = getAdminToken(env);
  if (!adminToken) return json({ ok: false, error: "admin_token_not_configured" }, { status: 500 });
  if (getBearerToken(req) !== adminToken) return unauthorized(json);

  const path = url.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  const parts = path.split("/");

  if (req.method === "GET" && path === "admin/overview") {
    const stats = await getTodayStats(env);
    const caps = await getCaps(env);
    const lastRunRaw = (await getSetting(env, "last_engine_run")) || null;
    let lastRun: any = null;
    if (lastRunRaw) {
      try { lastRun = JSON.parse(lastRunRaw); } catch {}
    }
    return json({
      ok: true,
      counters: {
        crawl_scanned: stats.leadsNewToday,
        drafts_created: stats.draftsCreatedToday,
        sends_sent: stats.sendsSentToday,
        approvals: stats.approvalsToday,
        replies: stats.repliesToday,
        ai_calls: Number((await getSetting(env, "ai_calls")) || 0),
        bounces: stats.bouncesToday,
        unsubscribes: stats.unsubscribesToday,
        day: new Date().toISOString().slice(0, 10),
      },
      caps,
      lastRun,
    });
  }

  if (req.method === "GET" && path === "admin/leads") {
    const status = (url.searchParams.get("status") || undefined) as any;
    const limit = Math.min(300, Math.max(1, Number(url.searchParams.get("limit") || 100)));
    const leads = await listLeads(env, { status, limit });
    return json({ ok: true, leads: leads.map(mapLead) });
  }

  if (req.method === "POST" && path === "admin/leads") {
    const body = await req.json().catch(() => ({}));
    const websiteUrl = String(body?.websiteUrl || "").trim();
    if (!websiteUrl) return badRequest(json, "missing_websiteUrl");
    const lead = await scanWebsiteNow(env, websiteUrl);
    return json({ ok: true, lead: mapLead(lead) });
  }

  if (req.method === "GET" && path === "admin/drafts") {
    const requested = String(url.searchParams.get("status") || "");
    const status = requested === "queued" ? "created" : (requested || undefined);
    const limit = Math.min(300, Math.max(1, Number(url.searchParams.get("limit") || 100)));
    const drafts = await listDrafts(env, { status: status as any, limit });
    const out = [];
    for (const draft of drafts) out.push(await mapDraft(env, draft));
    return json({ ok: true, drafts: out });
  }

  if (req.method === "POST" && parts.length === 4 && parts[0] === "admin" && parts[1] === "drafts" && parts[3] === "approve") {
    const draftId = decodeURIComponent(parts[2]);
    const draft = await getDraftById(env, draftId);
    if (!draft) return json({ ok: false, error: "draft_not_found" }, { status: 404 });
    await updateDraft(env, draftId, { status: "approved" });
    await updateLead(env, draft.lead_id, { status: "approved" });
    await bump(env, "approvals_today", 1);
    await logEvent(env, "draft_approved", `Draft approved ${draftId}`, draft.lead_id);
    return json({ ok: true });
  }

  if (req.method === "POST" && parts.length === 4 && parts[0] === "admin" && parts[1] === "drafts" && parts[3] === "reject") {
    const draftId = decodeURIComponent(parts[2]);
    const draft = await getDraftById(env, draftId);
    if (!draft) return json({ ok: false, error: "draft_not_found" }, { status: 404 });
    await updateDraft(env, draftId, { status: "rejected" });
    await updateLead(env, draft.lead_id, { status: "rejected" });
    await logEvent(env, "draft_rejected", `Draft rejected ${draftId}`, draft.lead_id);
    return json({ ok: true });
  }

  if (req.method === "GET" && path === "admin/events") {
    const limit = Math.min(300, Math.max(1, Number(url.searchParams.get("limit") || 100)));
    const events = await listEvents(env, limit);
    return json({ ok: true, events: events.map(mapEvent) });
  }

  if (req.method === "GET" && path === "admin/settings") {
    const caps = await getCaps(env);
    return json({
      ok: true,
      settings: {
        engine_enabled: (await getSetting(env, "engine_enabled")) || "1",
        ai_enabled: (await getSetting(env, "ai_enabled")) || "0",
        drafting_enabled: (await getSetting(env, "drafting_enabled")) || "1",
        sending_enabled: (await getSetting(env, "sending_enabled")) || "0",
        approval_required: (await getSetting(env, "approval_required")) || "1",
        crawl_cap_per_day: String(caps.crawl),
        draft_cap_per_day: String(caps.drafts),
        send_cap_per_day: String(caps.send),
        min_score_for_draft: (await getSetting(env, "min_score_for_draft")) || "0.45",
        min_score_for_send: (await getSetting(env, "min_score_for_send")) || "0.65",
      },
    });
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
    ];
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        await setSetting(env, key, String(body[key]));
      }
    }
    await logEvent(env, "settings_updated", "Admin settings updated");
    return json({ ok: true });
  }

  if (req.method === "GET" && path === "admin/insights") {
    const leads = await listLeads(env, { limit: 500 });
    let contactableLeads = 0;
    let totalScore = 0;
    const leadClasses: Record<string, number> = {};
    const statuses: Record<string, number> = {};

    for (const lead of leads) {
      if (lead.contact_email) contactableLeads += 1;
      totalScore += Number(lead.score_total || 0);
      const category = String(lead.category || "unknown");
      leadClasses[category] = (leadClasses[category] || 0) + 1;
      statuses[lead.status] = (statuses[lead.status] || 0) + 1;
    }

    return json({
      ok: true,
      summary: {
        totalLeads: leads.length,
        contactableLeads,
        directEmailRate: leads.length ? Number(((contactableLeads / leads.length) * 100).toFixed(1)) : 0,
        averageScore: leads.length ? Number((totalScore / leads.length).toFixed(2)) : 0,
      },
      leadClasses,
      statuses,
    });
  }

  if (req.method === "GET" && path === "admin/runs") {
    const events = await listEvents(env, 100);
    const runs = events
      .filter((event) => ["tick_ok", "tick_fail", "scan_ok", "draft_ok", "send_ok"].includes(event.type))
      .map(mapEvent);
    return json({ ok: true, runs });
  }

  if (req.method === "POST" && path === "admin/run") {
    const body = await req.json().catch(() => ({}));
    const kind = String(body?.kind || "tick");
    if (kind === "tick") {
      await dailyTick(env);
      return json({ ok: true, kind });
    }
    if (kind === "scan") {
      const result = await runScanOnce(env);
      return json({ ok: true, kind, ...result });
    }
    if (kind === "draft") {
      const result = await runDraftOnce(env);
      return json({ ok: true, kind, ...result });
    }
    if (kind === "send") {
      const result = await runSendApproved(env);
      return json({ ok: true, kind, ...result });
    }
    return badRequest(json, "unknown_kind");
  }

  if (req.method === "POST" && path === "admin/seeds") {
    const body = await req.json().catch(() => ({}));
    const urls = Array.isArray(body?.urls) ? body.urls.map((v: any) => String(v).trim()).filter(Boolean) : [];
    if (!urls.length) return badRequest(json, "missing_urls");
    let added = 0;
    for (const websiteUrl of urls) {
      await scanWebsiteNow(env, websiteUrl);
      added += 1;
    }
    return json({ ok: true, added });
  }

  return json({ ok: false, error: "not_found" }, { status: 404 });
}
