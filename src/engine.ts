import type { Env, LeadBrief, LeadClass, LeadRow, ScoreBreakdown } from "./db";
import {
  addSuppression,
  bump,
  getLeadById,
  getLeadByWebsite,
  getSetting,
  insertDraft,
  insertLead,
  isSuppressed,
  listApprovedDrafts,
  listDrafts,
  listEvents,
  listLeads,
  logEvent,
  nowISO,
  safeJsonParse,
  setSetting,
  setSettings,
  updateDraft,
  updateLead,
} from "./db";
import { analyzeSite } from "./analyze";
import { draftEmail } from "./ai";
import { sendEmail } from "./email";
import {
  extractLinks,
  getDomain,
  isKnownDirectoryDomain,
  isLikelyNonBusinessPath,
  normalizeLeadCandidateUrl,
  normalizeSeedUrl,
  normalizeUrl,
  uniqueStrings,
} from "./util";

export type TodayStats = {
  leadsNewToday: number;
  draftsCreatedToday: number;
  approvalsToday: number;
  repliesToday: number;
  bouncesToday: number;
  unsubscribesToday: number;
  aiCallsToday: number;
  templateDraftsToday: number;
};

const DEFAULT_SETTINGS: Record<string, string> = {
  engine_enabled: "1",
  ai_enabled: "0",
  drafting_enabled: "1",
  sending_enabled: "0",
  approval_required: "1",
  crawl_cap_per_day: "60",
  draft_cap_per_day: "25",
  send_cap_per_day: "12",
  min_score_for_draft: "45",
  min_score_for_send: "65",
  daily_reset_iso: "",
  crawl_scanned_today: "0",
  ai_used_today: "0",
  template_drafts_today: "0",
  send_sent_today: "0",
  stat_leads_new_today: "0",
  stat_drafts_created_today: "0",
  stat_approvals_today: "0",
  stat_replies_today: "0",
  stat_bounces_today: "0",
  stat_unsubscribes_today: "0",
};

async function ensureDefaults(env: Env) {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = await getSetting(env, key);
    if (existing === null) await setSetting(env, key, value);
  }
}

async function ensureDailyReset(env: Env) {
  await ensureDefaults(env);
  const today = new Date().toISOString().slice(0, 10);
  const last = (await getSetting(env, "daily_reset_iso")) || "";
  if (last.slice(0, 10) === today) return;
  await setSettings(env, {
    daily_reset_iso: nowISO(),
    crawl_scanned_today: "0",
    ai_used_today: "0",
    template_drafts_today: "0",
    send_sent_today: "0",
    stat_leads_new_today: "0",
    stat_drafts_created_today: "0",
    stat_approvals_today: "0",
    stat_replies_today: "0",
    stat_bounces_today: "0",
    stat_unsubscribes_today: "0",
  });
}

async function settingNumber(env: Env, key: string, fallback: number) {
  const value = parseInt((await getSetting(env, key)) || "", 10);
  return Number.isFinite(value) ? value : fallback;
}

async function engineEnabled(env: Env) {
  return ((await getSetting(env, "engine_enabled")) || "1") !== "0";
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; EVAVOOutboundBot/1.0; +https://evavo.com.au)",
        accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function discoverFromSeed(env: Env, seedUrl: string): Promise<{ extracted: number; added: number }> {
  const html = await fetchText(seedUrl);
  if (!html) {
    await logEvent(env, "discover_fail", `Failed to fetch seed: ${seedUrl}`);
    return { extracted: 0, added: 0 };
  }

  const links = extractLinks(html, seedUrl)
    .map((link) => normalizeLeadCandidateUrl(link))
    .filter(Boolean);

  const deduped = uniqueStrings(links).filter((candidate) => {
    const domain = getDomain(candidate);
    if (!domain) return false;
    if (isKnownDirectoryDomain(domain)) return false;
    try {
      const path = new URL(candidate).pathname;
      if (isLikelyNonBusinessPath(path)) return false;
    } catch {
      return false;
    }
    return true;
  });

  let added = 0;
  for (const url of deduped.slice(0, 25)) {
    const existing = await getLeadByWebsite(env, url);
    if (existing) continue;
    const domain = getDomain(url);
    const company = domain.split(".")[0].replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
    await insertLead(env, {
      company_name: company,
      website_url: url,
      discovery_source: seedUrl,
      country: url.includes(".au") ? "AU" : url.includes(".nz") ? "NZ" : "UNK",
      category: "other",
      status: "new",
      signals_json: "[]",
      lead_class: "low_signal",
      all_emails_json: "[]",
      lead_brief_json: JSON.stringify({}),
      score_breakdown_json: JSON.stringify({ fit: 0, contactability: 0, opportunity: 0, risk: 0, total: 0 }),
    });
    await bump(env, "stat_leads_new_today", 1);
    added += 1;
  }

  await logEvent(env, "discover_summary", `Seed processed: extracted=${deduped.length} added=${added}`);
  return { extracted: deduped.length, added };
}

async function popSeed(env: Env): Promise<string | null> {
  const raw = safeJsonParse<string[]>((await getSetting(env, "seed_urls_json")) || "[]", []);
  if (!raw.length) return null;
  const [first, ...rest] = raw;
  await setSetting(env, "seed_urls_json", JSON.stringify(rest));
  return first;
}

export async function adminEnqueueSeeds(env: Env, urls: string[]) {
  const current = safeJsonParse<string[]>((await getSetting(env, "seed_urls_json")) || "[]", []);
  const merged = uniqueStrings([...current, ...urls.map((u) => normalizeSeedUrl(u))]).filter(Boolean);
  await setSetting(env, "seed_urls_json", JSON.stringify(merged));
}

function categoryFromBrief(brief: LeadBrief) {
  if (brief.serviceTags.includes("construction")) return "construction";
  if (brief.serviceTags.includes("web")) return "web";
  if (brief.serviceTags.includes("seo")) return "seo";
  if (brief.serviceTags.includes("branding")) return "branding";
  return "other";
}

async function scanLead(env: Env, lead: LeadRow): Promise<LeadRow> {
  const homeHtml = await fetchText(lead.website_url);
  if (!homeHtml) {
    await updateLead(env, lead.id, { status: "do_not_contact", score_total: 0, lead_class: "do_not_contact" });
    await logEvent(env, "scan_fail", `Failed to fetch homepage: ${lead.website_url}`, lead.id);
    return (await getLeadById(env, lead.id)) as LeadRow;
  }

  const guessContactHtml = homeHtml;
  let aboutHtml: string | undefined;
  let contactHtml: string | undefined;
  const links = extractLinks(homeHtml, lead.website_url);
  const aboutLink = links.find((link) => /\/about(\/|$|-)/i.test(link));
  if (aboutLink) aboutHtml = (await fetchText(aboutLink)) || undefined;
  const contactLink = links.find((link) => /contact|enquire|enquiry|get-in-touch/i.test(link));
  if (contactLink) contactHtml = (await fetchText(contactLink)) || guessContactHtml;

  const analysis = await analyzeSite(lead.website_url, homeHtml, contactHtml, aboutHtml);
  const bestEmail = analysis.bestEmail;
  const status: LeadRow["status"] = analysis.leadClass === "do_not_contact"
    ? "do_not_contact"
    : analysis.score.total >= 45 || bestEmail || analysis.hasContactForm
    ? "qualified"
    : "scanned";

  await updateLead(env, lead.id, {
    company_name: analysis.companyNameGuess || lead.company_name,
    category: categoryFromBrief(analysis.brief),
    contact_email: bestEmail,
    contact_page_url: analysis.contactPageUrl,
    has_contact_form: analysis.hasContactForm ? 1 : 0,
    signals_json: JSON.stringify(analysis.signals),
    score_fit: analysis.score.fit,
    score_contact: analysis.score.contactability,
    score_risk: analysis.score.risk,
    score_total: analysis.score.total,
    status,
    lead_class: analysis.leadClass,
    all_emails_json: JSON.stringify(analysis.allEmails),
    lead_brief_json: JSON.stringify(analysis.brief),
    score_breakdown_json: JSON.stringify(analysis.score),
    last_scanned_at_iso: nowISO(),
    country: analysis.geoHint === "New Zealand" ? "NZ" : analysis.geoHint ? "AU" : lead.country,
    region: analysis.geoHint || lead.region,
  });

  await logEvent(
    env,
    "scan_ok",
    `Scanned ${getDomain(lead.website_url)}. class=${analysis.leadClass} email=${bestEmail ? "yes" : "no"} form=${analysis.hasContactForm ? "yes" : "no"}`,
    lead.id
  );

  return (await getLeadById(env, lead.id)) as LeadRow;
}

export async function createDraftForLead(env: Env, lead: LeadRow): Promise<{ draftId: string; usedAI: boolean } | null> {
  const draftingEnabled = ((await getSetting(env, "drafting_enabled")) || "1") !== "0";
  if (!draftingEnabled) return null;

  const minScore = await settingNumber(env, "min_score_for_draft", 45);
  if ((lead.score_total || 0) < minScore) {
    await logEvent(env, "draft_skip", `Lead score below threshold (${lead.score_total}/${minScore}).`, lead.id);
    return null;
  }
  if (!lead.contact_email && !lead.has_contact_form) {
    await logEvent(env, "draft_skip", "No usable contact route detected.", lead.id);
    return null;
  }

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

  const draft = await draftEmail(env, {
    companyName: lead.company_name,
    websiteUrl: lead.website_url,
    leadClass: (lead.lead_class || "low_signal") as LeadClass,
    brief,
    primaryEmail: lead.contact_email,
  });

  const draftId = await insertDraft(env, lead.id, draft.subject, draft.body, {
    followupText: draft.followup,
    whyJson: JSON.stringify(draft.why),
    status: "queued",
  });

  if (draft.source === "template") await bump(env, "template_drafts_today", 1);
  await bump(env, "stat_drafts_created_today", 1);
  await updateLead(env, lead.id, { status: "drafted" });
  await logEvent(env, "draft_created", `Draft created (${draft.source}).`, lead.id);
  return { draftId, usedAI: draft.usedAI };
}

export async function runScanOnce(env: Env, targetUrl: string) {
  await ensureDailyReset(env);
  const url = normalizeUrl(targetUrl);
  if (!url) return { ok: false, error: "invalid_url" };

  let lead = await getLeadByWebsite(env, url);
  if (!lead) {
    const domain = getDomain(url);
    const company = domain.split(".")[0].replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
    const id = await insertLead(env, {
      company_name: company,
      website_url: url,
      discovery_source: "manual",
      country: url.includes(".au") ? "AU" : url.includes(".nz") ? "NZ" : "UNK",
      category: "other",
      status: "new",
      signals_json: "[]",
      lead_class: "low_signal",
      all_emails_json: "[]",
      lead_brief_json: JSON.stringify({}),
      score_breakdown_json: JSON.stringify({ fit: 0, contactability: 0, opportunity: 0, risk: 0, total: 0 }),
    });
    await bump(env, "stat_leads_new_today", 1);
    lead = (await getLeadById(env, id)) as LeadRow;
  }

  await bump(env, "crawl_scanned_today", 1);
  const scanned = await scanLead(env, lead);
  const draft = await createDraftForLead(env, scanned);
  return { ok: true, leadId: scanned.id, drafted: !!draft, leadClass: scanned.lead_class || "low_signal" };
}

export async function dailyTick(env: Env): Promise<void> {
  await ensureDailyReset(env);
  if (!(await engineEnabled(env))) {
    await logEvent(env, "tick_skip", "Engine disabled.");
    return;
  }

  const crawlCap = await settingNumber(env, "crawl_cap_per_day", 60);
  const currentCrawl = await settingNumber(env, "crawl_scanned_today", 0);
  if (currentCrawl < crawlCap) {
    const seed = await popSeed(env);
    if (seed) await discoverFromSeed(env, seed);
  }

  const remaining = Math.max(0, crawlCap - (await settingNumber(env, "crawl_scanned_today", 0)));
  if (remaining > 0) {
    const leads = await listLeads(env, { status: "new", limit: Math.min(5, remaining) });
    for (const lead of leads) {
      await bump(env, "crawl_scanned_today", 1);
      const scanned = await scanLead(env, lead);
      await createDraftForLead(env, scanned);
    }
  }

  await logEvent(env, "tick_ok", "Daily tick step finished.");
}

export async function sendApprovedBatch(env: Env): Promise<{ sent: number; attempted: number }> {
  const sendingEnabled = ((await getSetting(env, "sending_enabled")) || "0") !== "0";
  if (!sendingEnabled) return { sent: 0, attempted: 0 };

  const sendCap = await settingNumber(env, "send_cap_per_day", 12);
  const sentToday = await settingNumber(env, "send_sent_today", 0);
  const remaining = Math.max(0, sendCap - sentToday);
  if (remaining <= 0) return { sent: 0, attempted: 0 };

  const drafts = await listApprovedDrafts(env, remaining);
  let sent = 0;
  let attempted = 0;
  for (const draft of drafts) {
    attempted += 1;
    if (!draft.lead.contact_email || (await isSuppressed(env, draft.lead.contact_email))) {
      await updateDraft(env, draft.id, { status: "failed" });
      await logEvent(env, "send_skip", "Suppressed or missing email.", draft.lead.id);
      continue;
    }
    const result = await sendEmail(env, {
      to: draft.lead.contact_email,
      subject: draft.subject,
      bodyText: draft.body,
    });
    if (result.ok) {
      sent += 1;
      await updateDraft(env, draft.id, { status: "sent" });
      await updateLead(env, draft.lead.id, { status: "sent" });
      await logEvent(env, "send_ok", `Sent to ${draft.lead.contact_email}`, draft.lead.id);
    } else {
      await updateDraft(env, draft.id, { status: "failed" });
      await logEvent(env, "send_fail", `Failed to send: ${result.error || "unknown_error"}`, draft.lead.id);
    }
  }
  return { sent, attempted };
}

export async function getTodayStats(env: Env): Promise<TodayStats> {
  await ensureDailyReset(env);
  return {
    leadsNewToday: await settingNumber(env, "stat_leads_new_today", 0),
    draftsCreatedToday: await settingNumber(env, "stat_drafts_created_today", 0),
    approvalsToday: await settingNumber(env, "stat_approvals_today", 0),
    repliesToday: await settingNumber(env, "stat_replies_today", 0),
    bouncesToday: await settingNumber(env, "stat_bounces_today", 0),
    unsubscribesToday: await settingNumber(env, "stat_unsubscribes_today", 0),
    aiCallsToday: await settingNumber(env, "ai_used_today", 0),
    templateDraftsToday: await settingNumber(env, "template_drafts_today", 0),
  };
}

export async function getOverview(env: Env) {
  const stats = await getTodayStats(env);
  return {
    ok: true,
    caps: {
      crawl: await settingNumber(env, "crawl_cap_per_day", 60),
      drafts: await settingNumber(env, "draft_cap_per_day", 25),
      send: await settingNumber(env, "send_cap_per_day", 12),
    },
    counters: {
      day: new Date().toISOString().slice(0, 10),
      crawl_scanned: await settingNumber(env, "crawl_scanned_today", 0),
      drafts_created: stats.draftsCreatedToday,
      sends_sent: await settingNumber(env, "send_sent_today", 0),
      replies: stats.repliesToday,
      bounces: stats.bouncesToday,
      unsubscribes: stats.unsubscribesToday,
      ai_calls: stats.aiCallsToday,
      template_drafts: stats.templateDraftsToday,
      approvals: stats.approvalsToday,
    },
  };
}

export async function getInsights(env: Env) {
  const leads = await listLeads(env, { limit: 200 });
  const classes = leads.reduce<Record<string, number>>((acc, lead) => {
    acc[lead.lead_class || "low_signal"] = (acc[lead.lead_class || "low_signal"] || 0) + 1;
    return acc;
  }, {});
  const statuses = leads.reduce<Record<string, number>>((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {});
  const withDirectEmail = leads.filter((lead) => !!lead.contact_email).length;
  return {
    ok: true,
    summary: {
      totalLeads: leads.length,
      contactableLeads: withDirectEmail,
      directEmailRate: leads.length ? Math.round((withDirectEmail / leads.length) * 100) : 0,
      averageScore: leads.length ? Math.round(leads.reduce((sum, lead) => sum + (lead.score_total || 0), 0) / leads.length) : 0,
    },
    leadClasses: classes,
    statuses,
  };
}

export async function getRuns(env: Env) {
  const events = await listEvents(env, 120);
  return {
    ok: true,
    runs: events
      .filter((event) => /tick_|discover_|scan_|draft_|send_/.test(event.type))
      .slice(0, 80),
  };
}
