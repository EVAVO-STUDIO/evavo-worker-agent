import type { Env, LeadRow, DraftRow } from "../db";
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
  safeJsonParse,
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

function mapLead(lead: LeadRow) {
  const info = safeJsonParse<any>(lead.data) || lead.data || {};
  const domain = String(lead.website).replace(/^https?:\/\//i, "").replace(/\/$/, "");
  const scoreTotal = Number(info.scoreTotal || 0);

  return {
    id: lead.id,
    website_url: lead.website,
    website: lead.website,
    domain,
    title: info.title || "",
    summary: info.brief || "",
    category: info.classification || "general",
    status: lead.status,
    contact_email: info.contactEmail || null,
    contact_emails: info.contactEmail ? JSON.stringify([info.contactEmail]) : null,
    contact_page_url: null,
    has_contact_form: /contact/i.test(info.contactSummary || ""),
    score: scoreTotal,
    score_total: scoreTotal,
    score_breakdown: {
      fit: Number(info.fitScore || 0),
      contactability: Number(info.contactabilityScore || 0),
      risk: Number(info.riskScore || 0),
      total: scoreTotal,
    },
    country: null,
    region: null,
    mode: "heuristic",
    tech_stack: Array.isArray(info.techTags) ? info.techTags.join(", ") : null,
    brief: {
      summary: info.brief || "",
      siteQualitySummary: info.siteQualitySummary || "",
      serviceTags: Array.isArray(info.serviceTags) ? info.serviceTags : [],
      techTags: Array.isArray(info.techTags) ? info.techTags : [],
      outreachAngles: Array.isArray(info.outreachAngles) ? info.outreachAngles : [],
      groundedFacts: Array.isArray(info.groundedFacts) ? info.groundedFacts : [],
      avoidSaying: Array.isArray(info.avoidSaying) ? info.avoidSaying : [],
      contactSummary: info.contactSummary || "",
      confidence: scoreTotal >= 0.75 ? "high" : scoreTotal >= 0.45 ? "medium" : "low",
    },
    lead_class: info.classification || "general",
    created_at_iso: lead.created_at_iso,
    updated_at_iso: lead.updated_at_iso,
    last_scanned_at_iso: lead.updated_at_iso,
  };
}

async function mapDraft(env: Env, draft: DraftRow) {
  const lead = await env.DB.prepare(`SELECT website, data FROM leads WHERE id = ?`).bind(draft.lead_id).first<any>();
  const info = safeJsonParse<any>(lead?.data) || {};
  return {
    id: draft.id,
    lead_id: draft.lead_id,
    status: draft.status === "created" ? "queued" : draft.status,
    subject: draft.subject,
    body_text: draft.body,
    followup_text: null,
    why_json: null,
    to_name: String(lead?.website || draft.lead_id).replace(/^https?:\/\//i, "").replace(/\/$/, ""),
    to_email: info.contactEmail || null,
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

function mapEvent(event: { id: string; type: string; message: string; created_at_iso: string }) {
  return {
    id: event.id,
    type: event.type,
    message: event.message,
    lead_id: null,
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
  if (!env.ADMIN_TOKEN) return json({ ok: false, error: "admin_token_not_configured" }, { status: 500 });
  if (getBearerToken(req) !== env.ADMIN_TOKEN) return unauthorized(json);

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
    const status = url.searchParams.get("status") || undefined;
    const limit = Math.min(300, Math.max(1, Number(url.searchParams.get("limit") || 100)));
    const leads = await listLeads(env, { status: status as any, limit });
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
    const status = requested === "queued" ? "created" : requested || undefined;
    const limit = Math.min(300, Math.max(1, Number(url.searchParams.get("limit") || 100)));
    const drafts = await listDrafts(env, { status: status as any, limit });
    const out: any[] = []
    for (const draft of drafts) out.push(await mapDraft(env, draft));
    return json({ ok: true, drafts: out });
  }

  if (req.method === "POST" && parts.length === 4 && parts[0] === "admin" && parts[1] === "drafts" && parts[3] === "approve") {
    const draftId = decodeURIComponent(parts[2]);
    const draft = await env.DB.prepare(`SELECT id, lead_id FROM drafts WHERE id = ? LIMIT 1`).bind(draftId).first<any>();
    if (!draft) return json({ ok: false, error: "draft_not_found" }, { status: 404 });
    await updateDraft(env, draftId, { status: "approved" });
    await updateLead(env, draft.lead_id, { status: "approved" });
    await bump(env, "approvals_today", 1);
    await logEvent(env, "draft_approved", `Draft approved ${draftId}`);
    return json({ ok: true });
  }

  if (req.method === "POST" && parts.length === 4 && parts[0] === "admin" && parts[1] === "drafts" && parts[3] === "reject") {
    const draftId = decodeURIComponent(parts[2]);
    const draft = await env.DB.prepare(`SELECT id, lead_id FROM drafts WHERE id = ? LIMIT 1`).bind(draftId).first<any>();
    if (!draft) return json({ ok: false, error: "draft_not_found" }, { status: 404 });
    await updateDraft(env, draftId, { status: "rejected" });
    await updateLead(env, draft.lead_id, { status: "rejected" });
    await logEvent(env, "draft_rejected", `Draft rejected ${draftId}`);
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
        ai_enabled: (await getSetting(env, "ai_enabled")) || "1",
        drafting_enabled: (await getSetting(env, "drafting_enabled")) || "1",
        sending_enabled: (await getSetting(env, "sending_enabled")) || "0",
        approval_required: (await getSetting(env, "approval_required")) || "1",
        crawl_cap_per_day: String(caps.crawl),
        draft_cap_per_day: String(caps.drafts),
        send_cap_per_day: String(caps.send),
        min_score_for_draft: (await getSetting(env, "min_score_for_draft")) || "0.45",
        min_score_for_send: (await getSetting(env, "min_score_for_send")) || "0.75",
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
      const info = safeJsonParse<any>(lead.data) || lead.data || {};
      if (info.contactEmail) contactableLeads += 1;
      totalScore += Number(info.scoreTotal || 0);

      const classification = String(info.classification || "unknown");
      leadClasses[classification] = (leadClasses[classification] || 0) + 1;
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
    for (const website of urls) {
      await scanWebsiteNow(env, website);
      added += 1;
    }
    return json({ ok: true, added });
  }

  if (req.method === "POST" && path === "admin/scan") {
    const result = await runScanOnce(env);
    return json({ ok: true, ...result });
  }

  return json({ ok: false, error: "not_found" }, { status: 404 });
}
