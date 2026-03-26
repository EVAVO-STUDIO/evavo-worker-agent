import {
  Env,
  LeadRow,
  tryAcquireLock,
  releaseLock,
  listLeads,
  updateLead,
  insertDraft,
  listDrafts,
  updateDraft,
  logEvent,
  setSetting,
  getSetting,
  uuid,
  nowISO,
  bump,
  insertLead,
  safeJsonParse,
} from "./db";
import { sendEmail } from "./email";

export interface ScanResult {
  classification: string;
  fitScore: number;
  contactabilityScore: number;
  riskScore: number;
  scoreTotal: number;
  brief: string;
  contactEmail?: string;
  contactSummary: string;
  siteQualitySummary: string;
  techTags: string[];
  serviceTags: string[];
  outreachAngles: string[];
  avoidSaying: string[];
  groundedFacts: string[];
  title?: string;
  description?: string;
}

function extractEmails(html: string): string[] {
  const set = new Set<string>();
  const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  for (const email of html.match(regex) || []) {
    const lower = email.toLowerCase();
    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(lower)) continue;
    set.add(lower);
  }
  return Array.from(set);
}

async function fetchHtml(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; EVAVObot/1.0)" },
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

function classifyLead(domain: string, html: string): { classification: string; serviceTags: string[]; techTags: string[] } {
  const domainLower = domain.toLowerCase();
  const content = html.toLowerCase();
  const techTags: string[] = [];
  const serviceTags: string[] = [];

  if (/react|next\.js|jsx|reactdom/.test(content)) techTags.push("react");
  if (/vue|nuxt/.test(content)) techTags.push("vue");
  if (/angular/.test(content)) techTags.push("angular");
  if (/shopify/.test(content)) techTags.push("shopify");
  if (/wordpress|wp-content/.test(content)) techTags.push("wordpress");
  if (/squarespace/.test(content)) techTags.push("squarespace");
  if (/wix\.com/.test(content)) techTags.push("wix");
  if (/python|django|flask/.test(content)) techTags.push("python");
  if (/node\.js|express/.test(content)) techTags.push("node");
  if (/php/.test(content)) techTags.push("php");

  if (/e[- ]?commerce|cart|checkout/.test(content)) serviceTags.push("ecommerce");
  if (/design|branding|creative/.test(content)) serviceTags.push("design");
  if (/development|web developer|software/.test(content)) serviceTags.push("development");
  if (/marketing|seo|advertising/.test(content)) serviceTags.push("marketing");
  if (/agency/.test(content)) serviceTags.push("agency");

  let classification = "general";
  if (/(\.edu|\.ac\.)/.test(domainLower) || / university | school /.test(content)) classification = "education";
  else if (/(\.gov|\.gouv)/.test(domainLower) || /government/.test(content)) classification = "government";
  else if (/nonprofit|ngo/.test(content)) classification = "nonprofit";
  else if (/saas|software as a service/.test(content)) classification = "saas";
  else if (serviceTags.includes("ecommerce")) classification = "ecommerce";
  else if (serviceTags.includes("agency")) classification = "agency";

  return { classification, serviceTags, techTags };
}

async function heuristicScan(domain: string, url: string): Promise<ScanResult> {
  const html = await fetchHtml(url);
  const lowerHtml = html.toLowerCase();
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
  const description = descMatch ? descMatch[1].trim() : "";
  const { classification, serviceTags, techTags } = classifyLead(domain, lowerHtml);
  const emails = extractEmails(html);
  const contactEmail = emails.length ? emails[0] : undefined;
  const hasContactPage = /contact/.test(lowerHtml);

  let fit = 0.5;
  if (classification === "ecommerce" || classification === "saas" || classification === "agency") fit = 0.9;
  else if (classification === "education" || classification === "government" || classification === "nonprofit") fit = 0.2;

  let contactability = 0.2;
  if (contactEmail) contactability = 0.9;
  else if (hasContactPage) contactability = 0.5;

  let risk = 0.0;
  if (/\.xyz|\.top|\.click|\.info/.test(domain) || /(casino|bet|porn|download)/.test(lowerHtml)) risk = 0.8;

  const scoreTotal = fit * 0.5 + contactability * 0.3 - risk * 0.2;
  const brief = classification === "general"
    ? `General business with ${serviceTags.join(", ") || "unspecified offerings"}`
    : `${classification} company`;
  const contactSummary = contactEmail
    ? `Found contact email: ${contactEmail}`
    : hasContactPage
    ? "Contact page present but no email extracted"
    : "No obvious contact details";
  const siteQualitySummary = html ? "Site loaded successfully" : "Could not fetch site";

  const outreachAngles: string[] = [];
  if (serviceTags.includes("ecommerce")) outreachAngles.push("optimising checkout flow");
  if (techTags.includes("wordpress") || techTags.includes("wix") || techTags.includes("squarespace")) outreachAngles.push("custom re-platforming");
  if (serviceTags.includes("design")) outreachAngles.push("elevated brand identity");
  if (outreachAngles.length === 0) outreachAngles.push("modern web overhaul");

  const avoidSaying: string[] = [];
  if (classification === "nonprofit") avoidSaying.push("profit");

  const groundedFacts: string[] = [];
  if (title) groundedFacts.push(`Title: ${title}`);
  if (description) groundedFacts.push(`Description: ${description}`);

  return {
    classification,
    fitScore: Number(fit.toFixed(2)),
    contactabilityScore: Number(contactability.toFixed(2)),
    riskScore: Number(risk.toFixed(2)),
    scoreTotal: Number(scoreTotal.toFixed(2)),
    brief,
    contactEmail,
    contactSummary,
    siteQualitySummary,
    techTags,
    serviceTags,
    outreachAngles,
    avoidSaying,
    groundedFacts,
    title,
    description,
  };
}

function normaliseWebsite(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Missing website URL");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function buildEmailForLead(lead: LeadRow & { data: any }): { to: string; subject: string; body: string } {
  const data: ScanResult | undefined = lead.data as any;
  const domain = lead.website.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  const to = (data?.contactEmail || `info@${domain}`).toLowerCase();

  let subject = `Let's elevate ${domain} together`;
  if (data?.classification === "ecommerce") subject = `Idea to boost conversions on ${domain}`;
  else if (data?.classification === "saas") subject = `Design & dev support for ${domain}`;
  else if (data?.classification === "agency") subject = `Collaboration opportunity with EVAVO`;

  const lines = [
    "Hi there,",
    "",
    `We recently explored ${domain} and were impressed by your ${data?.serviceTags?.join(", ") || "work"}.`,
    data?.groundedFacts?.length ? `A couple of standout facts: ${data.groundedFacts.join("; ")}.` : "",
    "",
    `As a creative studio, EVAVO specialises in bespoke websites and digital systems. I noticed potential to ${data?.outreachAngles?.join(" and ") || "improve your online presence"}.`,
    "We'd love to share a few grounded ideas tailored to your site and goals.",
    "",
    "If you're interested, we can set up a quick call.",
    "",
    "Best regards,",
    "The EVAVO Team",
  ].filter(Boolean);

  return { to, subject, body: lines.join("\n") };
}

async function executeWithRetry<T>(task: () => Promise<T>, maxRetries = 3, initialDelayMs = 250): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await task();
    } catch (err: any) {
      attempt += 1;
      const message = String(err?.message || err);
      const temporary = /timeout|network|rate|429/i.test(message);
      if (!temporary || attempt > maxRetries) throw err;
      const delay = initialDelayMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay + Math.random() * 100));
    }
  }
}

export async function scanWebsiteNow(env: Env, websiteInput: string): Promise<LeadRow> {
  const website = normaliseWebsite(websiteInput);
  const lead = await insertLead(env, website);
  const scan = await heuristicScan(new URL(website).hostname, website);
  await updateLead(env, lead.id, { status: "scanned", data: scan });
  await bump(env, "leads_new_today", 1);
  await logEvent(env, "scan_ok", `Scanned ${website}`, {
    leadId: lead.id,
    classification: scan.classification,
    score: scan.scoreTotal,
  });
  return { ...lead, status: "scanned", data: scan, updated_at_iso: nowISO() };
}

async function runScan(env: Env, runId: string): Promise<number> {
  const leads = await listLeads(env, { status: "new", limit: 10 });
  let scanned = 0;
  for (const lead of leads) {
    try {
      const website = normaliseWebsite(lead.website);
      const scan = await heuristicScan(new URL(website).hostname, website);
      await updateLead(env, lead.id, { status: "scanned", data: scan });
      await bump(env, "leads_new_today", 1);
      await logEvent(env, "scan_ok", `Scanned ${lead.website}`, {
        runId,
        leadId: lead.id,
        classification: scan.classification,
        score: scan.scoreTotal,
      });
      scanned += 1;
    } catch (err) {
      await logEvent(env, "scan_fail", `Error scanning ${lead.website}: ${String(err)}`, { runId, leadId: lead.id });
    }
  }
  return scanned;
}

async function runDraft(env: Env, runId: string): Promise<number> {
  const minimumScore = Number((await getSetting(env, "min_score_for_draft")) || 0.45);
  const leads = await listLeads(env, { status: "scanned", limit: 5 });
  let created = 0;
  for (const lead of leads) {
    try {
      const leadWithData: LeadRow & { data: any } = { ...lead, data: safeJsonParse(lead.data) || lead.data };
      const scan: ScanResult | undefined = leadWithData.data;
      if (!scan || scan.scoreTotal < minimumScore) continue;
      const email = buildEmailForLead(leadWithData);
      const draft = await insertDraft(env, lead.id, email.subject, email.body);
      await updateLead(env, lead.id, { status: "drafted" });
      await bump(env, "drafts_created_today", 1);
      await bump(env, "ai_calls", 1);
      await logEvent(env, "draft_created", `Draft created for ${lead.website}`, {
        runId,
        leadId: lead.id,
        draftId: draft.id,
        to: email.to,
      });
      created += 1;
    } catch (err) {
      await logEvent(env, "draft_fail", `Error drafting for ${lead.website}: ${String(err)}`, { runId, leadId: lead.id });
    }
  }
  return created;
}

async function runSend(env: Env, runId: string): Promise<{ sent: number; failed: number }> {
  const sendingEnabled = ((await getSetting(env, "sending_enabled")) || "0") === "1";
  if (!sendingEnabled) {
    await logEvent(env, "send_skip", "Sending disabled, skipping send stage.", { runId });
    return { sent: 0, failed: 0 };
  }

  const drafts = await listDrafts(env, { status: "approved", limit: 5 });
  let sent = 0;
  let failed = 0;

  for (const draft of drafts) {
    try {
      const leadRow = await env.DB.prepare(`SELECT website, data FROM leads WHERE id = ?`).bind(draft.lead_id).first<any>();
      const dataObj = leadRow?.data ? JSON.parse(leadRow.data) : {};
      const domain = String(leadRow?.website || "").replace(/^https?:\/\//i, "").replace(/\/$/, "");
      const to = String(dataObj?.contactEmail || `info@${domain}`).toLowerCase();
      const res = await executeWithRetry(() => sendEmail(env, { to, subject: draft.subject, bodyText: draft.body }));
      if (res.ok) {
        await updateDraft(env, draft.id, { status: "sent" });
        await updateLead(env, draft.lead_id, { status: "sent" });
        await bump(env, "sends_sent_today", 1);
        await logEvent(env, "send_ok", "Email sent", { runId, draftId: draft.id, leadId: draft.lead_id, to });
        sent += 1;
      } else {
        await updateDraft(env, draft.id, { status: "failed" });
        await updateLead(env, draft.lead_id, { status: "failed" });
        await logEvent(env, "send_fail", res.error || "Unknown error", { runId, draftId: draft.id, leadId: draft.lead_id, to });
        failed += 1;
      }
    } catch (err) {
      await updateDraft(env, draft.id, { status: "failed" });
      await updateLead(env, draft.lead_id, { status: "failed" });
      await logEvent(env, "send_fail", String(err), { runId, draftId: draft.id, leadId: draft.lead_id });
      failed += 1;
    }
  }

  return { sent, failed };
}

export async function dailyTick(env: Env): Promise<void> {
  const engineEnabled = ((await getSetting(env, "engine_enabled")) || "1") !== "0";
  if (!engineEnabled) return;

  const lockToken = await tryAcquireLock(env, "engine-cycle", 60 * 10);
  if (!lockToken) return;

  const runId = uuid();
  const cycleStart = nowISO();
  let scanned = 0;
  let drafted = 0;
  let sendResult = { sent: 0, failed: 0 };

  try {
    await logEvent(env, "tick_ok", "Engine cycle started", { runId });
    scanned = await runScan(env, runId);
    const draftingEnabled = ((await getSetting(env, "drafting_enabled")) || "1") !== "0";
    if (draftingEnabled) drafted = await runDraft(env, runId);
    sendResult = await runSend(env, runId);
    await logEvent(env, "tick_ok", "Engine cycle completed", { runId, scanned, drafted, sent: sendResult.sent, failed: sendResult.failed });
  } catch (err) {
    await logEvent(env, "tick_fail", String(err), { runId });
  } finally {
    await releaseLock(env, "engine-cycle", lockToken);
    await setSetting(env, "last_engine_run", JSON.stringify({
      runId,
      started_at: cycleStart,
      scanned,
      drafted,
      sent: sendResult.sent,
      failed: sendResult.failed,
    }));
  }
}

export async function runScanOnce(env: Env): Promise<{ scanned: number }> {
  const lockToken = await tryAcquireLock(env, "scan-only", 60 * 5);
  if (!lockToken) return { scanned: 0 };
  const runId = uuid();
  let scanned = 0;
  try {
    scanned = await runScan(env, runId);
    await logEvent(env, "scan_ok", "Manual scan completed", { runId, scanned });
  } finally {
    await releaseLock(env, "scan-only", lockToken);
  }
  return { scanned };
}

export async function runDraftOnce(env: Env): Promise<{ drafted: number }> {
  const lockToken = await tryAcquireLock(env, "draft-only", 60 * 5);
  if (!lockToken) return { drafted: 0 };
  const runId = uuid();
  let drafted = 0;
  try {
    drafted = await runDraft(env, runId);
    await logEvent(env, "draft_ok", "Manual draft completed", { runId, drafted });
  } finally {
    await releaseLock(env, "draft-only", lockToken);
  }
  return { drafted };
}

export async function runSendApproved(env: Env): Promise<{ sent: number; failed: number }> {
  const lockToken = await tryAcquireLock(env, "send-only", 60 * 5);
  if (!lockToken) return { sent: 0, failed: 0 };
  const runId = uuid();
  let result = { sent: 0, failed: 0 };
  try {
    result = await runSend(env, runId);
    await logEvent(env, "send_ok", "Manual send completed", { runId, ...result });
  } finally {
    await releaseLock(env, "send-only", lockToken);
  }
  return result;
}
