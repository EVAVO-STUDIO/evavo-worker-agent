import {
  Env,
  LeadRow,
  DraftRow,
  LeadStatus,
  DraftStatus,
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
} from "./db";
import { sendEmail } from "./email";

/**
 * Internal representation of a scanned lead. The fields defined here are
 * persisted in the lead.data column and later used to craft personalised
 * outreach. These values are derived from heuristics rather than AI and
 * should be kept lightweight to minimise processing time.
 */
export interface ScanResult {
  classification: string;
  /** Relative fit (0–1) indicating how attractive this lead is to EVAVO */
  fitScore: number;
  /** Likelihood of finding a usable contact (0–1) */
  contactabilityScore: number;
  /** Riskiness of the lead (0–1), higher is more risky */
  riskScore: number;
  /** Weighted combination of the above scores */
  scoreTotal: number;
  /** A one‑sentence summary of why this lead is interesting */
  brief: string;
  /** First email address discovered on the site, lower case */
  contactEmail?: string;
  /** Short description of how the contact information was sourced */
  contactSummary: string;
  /** Evaluation of the site quality (load speed, design, etc.) */
  siteQualitySummary: string;
  /** Extracted technology tags (frameworks, CMS, languages) */
  techTags: string[];
  /** Service tags based on the company offering (design, ecommerce, etc.) */
  serviceTags: string[];
  /** Suggested angles for outreach based on the site */
  outreachAngles: string[];
  /** Phrases/topics to avoid mentioning in copy */
  avoidSaying: string[];
  /** Facts grounded in the website used to craft the email */
  groundedFacts: string[];
  /** Raw title of the page */
  title?: string;
  /** Raw meta description of the page */
  description?: string;
}

/**
 * Extract email addresses from an HTML document. Filters obvious false positives
 * such as placeholder images or encoded addresses. Returns unique lower‑case
 * values.
 */
function extractEmails(html: string): string[] {
  const set = new Set<string>();
  const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = html.match(regex) || [];
  for (const email of matches) {
    const lower = email.toLowerCase();
    // discard obvious image file names or html attributes
    if (/(\.jpg|\.jpeg|\.png|\.gif|\.webp)$/i.test(lower)) continue;
    set.add(lower);
  }
  return Array.from(set);
}

/**
 * Fetch the HTML for a given URL. Follows redirects and returns empty string
 * on network errors. Adds a basic User‑Agent header to avoid being blocked
 * by common bot filters.
 */
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

/**
 * Categorise a lead based on its domain and HTML content. Returns a
 * classification and associated tags. This is a simple heuristic; more
 * sophisticated models could replace this function in future.
 */
function classifyLead(domain: string, html: string): { classification: string; serviceTags: string[]; techTags: string[] } {
  const domainLower = domain.toLowerCase();
  const content = html.toLowerCase();
  const techTags: string[] = [];
  const serviceTags: string[] = [];
  // technology tags
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
  // service tags
  if (/e[- ]?commerce|cart|checkout/.test(content)) serviceTags.push("ecommerce");
  if (/design|branding|creative/.test(content)) serviceTags.push("design");
  if (/development|web developer|software/.test(content)) serviceTags.push("development");
  if (/marketing|seo|advertising/.test(content)) serviceTags.push("marketing");
  if (/agency/.test(content)) serviceTags.push("agency");
  // classification heuristics
  let classification = "general";
  if (/(\.edu|\.ac\.)/.test(domainLower) || / university | school /.test(content)) {
    classification = "education";
  } else if (/(\.gov|\.gouv)/.test(domainLower) || /government/.test(content)) {
    classification = "government";
  } else if (/nonprofit|ngo/.test(content)) {
    classification = "nonprofit";
  } else if (/saas|software as a service/.test(content)) {
    classification = "saas";
  } else if (serviceTags.includes("ecommerce")) {
    classification = "ecommerce";
  } else if (serviceTags.includes("agency")) {
    classification = "agency";
  }
  return { classification, serviceTags, techTags };
}

/**
 * Perform a heuristic scan of a lead. Fetches the website, extracts metadata,
 * classifies the site and computes scores. Returns an object that is stored
 * in the lead data column. If the fetch fails, sensible defaults are used.
 */
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
  // scoring heuristics
  let fit = 0.5;
  // high fit for ecommerce and saas
  if (classification === "ecommerce" || classification === "saas" || classification === "agency") fit = 0.9;
  else if (classification === "education" || classification === "government" || classification === "nonprofit") fit = 0.2;
  // contactability
  let contactability = 0.2;
  if (contactEmail) contactability = 0.9;
  else if (hasContactPage) contactability = 0.5;
  // risk based on TLD and spam words
  let risk = 0.0;
  if (/\.xyz|\.top|\.click|\.info/.test(domain) || /(casino|bet|porn|download)/.test(lowerHtml)) {
    risk = 0.8;
  }
  const scoreTotal = fit * 0.5 + contactability * 0.3 - risk * 0.2;
  // compose summaries
  const brief = classification === "general"
    ? `General business with ${serviceTags.join(", ") || "unspecified offerings"}`
    : `${classification} company`;
  const contactSummary = contactEmail
    ? `Found contact email: ${contactEmail}`
    : hasContactPage
    ? "Contact page present but no email extracted"
    : "No obvious contact details";
  const siteQualitySummary = html ? "Site loaded successfully" : "Could not fetch site";
  // outreach angles: propose design/dev improvements
  const outreachAngles: string[] = [];
  if (serviceTags.includes("ecommerce")) outreachAngles.push("optimising checkout flow");
  if (techTags.includes("wordpress") || techTags.includes("wix") || techTags.includes("squarespace")) outreachAngles.push("custom re‑platforming");
  if (serviceTags.includes("design")) outreachAngles.push("elevated brand identity");
  if (outreachAngles.length === 0) outreachAngles.push("modern web overhaul");
  const avoidSaying: string[] = [];
  if (classification === "nonprofit") avoidSaying.push("profit");
  // grounded facts from title/description
  const facts: string[] = [];
  if (title) facts.push(`Title: ${title}`);
  if (description) facts.push(`Description: ${description}`);
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
    groundedFacts: facts,
    title,
    description,
  };
}

/**
 * Build a personalised subject and body for a lead based on its scan result. It
 * uses the classification, tags and grounded facts to create compelling
 * outreach copy. Returns the subject, body and fallback email if available.
 */
function buildEmailForLead(lead: LeadRow & { data: any }): { to: string; subject: string; body: string } {
  const data: ScanResult | undefined = lead.data as any;
  const domain = lead.website.replace(/https?:\/\//, "").replace(/\/$/, "");
  const to = (data?.contactEmail || "info@" + domain).toLowerCase();
  // Subject
  let subject: string;
  if (data?.classification === "ecommerce") {
    subject = `Idea to boost conversions on ${domain}`;
  } else if (data?.classification === "saas") {
    subject = `Design & dev support for ${domain}`;
  } else if (data?.classification === "agency") {
    subject = `Collaboration opportunity with EVAVO`;
  } else {
    subject = `Let's elevate ${domain} together`;
  }
  // Body
  const lines: string[] = [];
  lines.push(`Hi there,`);
  lines.push("");
  lines.push(`We recently explored ${domain} and were impressed by your ${data?.serviceTags?.join(", ") || "work"}.`);
  if (data?.groundedFacts?.length) {
    lines.push(`A couple of standout facts: ${data.groundedFacts.join("; ")}.`);
  }
  lines.push("");
  lines.push(`As a creative studio, EVAVO specialises in crafting bespoke websites and digital experiences. I noticed potential to ${data?.outreachAngles?.join(" and ") || "improve your online presence"}.`);
  lines.push("We'd love to share ideas tailored to your needs and discuss how we could help you achieve your goals.");
  lines.push("");
  lines.push("If you're interested, let's schedule a quick call to chat. Looking forward to connecting!");
  lines.push("");
  lines.push("Best regards,");
  lines.push("The EVAVO Team");
  const body = lines.join("\n");
  return { to, subject, body };
}

/**
 * Engine orchestrates the discovery, drafting and sending pipeline. It uses a
 * simple locking mechanism to ensure only one instance runs at a time and
 * performs each stage sequentially with retry/backoff semantics. Each run
 * generates a unique runId for traceability.
 */

/**
 * Execute an asynchronous task with retry semantics. If the task throws an
 * error that appears temporary (identified heuristically), the task will be
 * retried with exponential backoff. Permanent errors are immediately
 * propagated to the caller.
 */
async function executeWithRetry<T>(
  task: () => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 250
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await task();
    } catch (err: any) {
      attempt++;
      const message = String(err?.message || err);
      const temporary = /timeout|network|rate/i.test(message);
      if (!temporary || attempt > maxRetries) {
        throw err;
      }
      const delay = initialDelayMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay + Math.random() * 100));
    }
  }
}

/**
 * Scan new leads. In this simplified implementation the scan stage simply
 * updates the lead status to 'scanned'. A real implementation would fetch
 * the target website and extract relevant information.
 */
async function runScan(env: Env, runId: string): Promise<number> {
  const leads = await listLeads(env, { status: "new", limit: 10 });
  let scanned = 0;
  for (const lead of leads) {
    try {
      // Derive domain; ensure protocol for fetch
      const url = lead.website.startsWith("http") ? lead.website : `https://${lead.website}`;
      const domain = new URL(url).hostname;
      const scan = await heuristicScan(domain, url);
      // Persist scan result in data column and update status
      await updateLead(env, lead.id, { status: "scanned", data: scan });
      await logEvent(env, "scan_ok", `Scanned ${lead.website}`, { runId, leadId: lead.id, classification: scan.classification, score: scan.scoreTotal });
      scanned++;
    } catch (err) {
      // Mark as failed scan but keep in new status to retry later
      await logEvent(env, "scan_fail", `Error scanning ${lead.website}: ${String(err)}`, { runId, leadId: lead.id });
    }
  }
  return scanned;
}

/**
 * Draft emails for scanned leads. This simplified implementation creates a
 * generic subject/body for each scanned lead and immediately persists the
 * draft. Real implementations should call into an LLM or template engine.
 */
async function runDraft(env: Env, runId: string): Promise<number> {
  const leads = await listLeads(env, { status: "scanned", limit: 5 });
  let created = 0;
  for (const lead of leads) {
    try {
      // Fetch full data for lead to generate personalised email
      const row = await env.DB.prepare(`SELECT data FROM leads WHERE id = ?`).bind(lead.id).first<any>();
      const dataObj: any = row?.data ? JSON.parse(row.data) : undefined;
      const leadWithData: LeadRow & { data: any } = { ...lead, data: dataObj };
      const email = buildEmailForLead(leadWithData);
      const draft = await insertDraft(env, lead.id, email.subject, email.body);
      // store the to field in draft? not persisted in schema; but we use contact email in send stage
      await updateLead(env, lead.id, { status: "drafted" });
      await logEvent(env, "draft_created", `Draft created for ${lead.website}`, { runId, leadId: lead.id, draftId: draft.id, to: email.to });
      created++;
    } catch (err) {
      await logEvent(env, "draft_fail", `Error drafting for ${lead.website}: ${String(err)}`, { runId, leadId: lead.id });
    }
  }
  return created;
}

/**
 * Send approved drafts. Only drafts with status 'approved' are eligible for
 * sending. After a successful send the draft is marked 'sent' and the
 * associated lead is marked 'sent'. Failures are logged and status updated to
 * 'failed'.
 */
async function runSend(env: Env, runId: string): Promise<{ sent: number; failed: number }> {
  const drafts = await listDrafts(env, { status: "approved", limit: 5 });
  let sent = 0;
  let failed = 0;
  for (const draft of drafts) {
    try {
      // Retrieve lead to determine email address
      const leadRow = await env.DB.prepare(`SELECT website, data FROM leads WHERE id = ?`).bind(draft.lead_id).first<any>();
      let to = "";
      if (leadRow) {
        const dataObj = leadRow.data ? JSON.parse(leadRow.data) : undefined;
        to = (dataObj?.contactEmail || ("info@" + leadRow.website.replace(/https?:\/\//, "").replace(/\/$/, ""))).toLowerCase();
      }
      // Send email
      const res = await executeWithRetry(() => sendEmail(env, { to, subject: draft.subject, bodyText: draft.body }));
      if (res.ok) {
        await updateDraft(env, draft.id, { status: "sent" });
        await updateLead(env, draft.lead_id, { status: "sent" });
        await logEvent(env, "send_ok", `Email sent`, { runId, leadId: draft.lead_id, draftId: draft.id, to });
        sent++;
      } else {
        await updateDraft(env, draft.id, { status: "failed" });
        await updateLead(env, draft.lead_id, { status: "failed" });
        await logEvent(env, "send_fail", res.error || `Unknown error`, { runId, leadId: draft.lead_id, draftId: draft.id, to });
        failed++;
      }
    } catch (err) {
      await updateDraft(env, draft.id, { status: "failed" });
      await updateLead(env, draft.lead_id, { status: "failed" });
      await logEvent(env, "send_fail", String(err), { runId, leadId: draft.lead_id, draftId: draft.id });
      failed++;
    }
  }
  return { sent, failed };
}

/**
 * Perform a full engine cycle of scan → draft → send. The cycle is
 * idempotent; any leads/drafts not in the expected status are ignored. A
 * distributed lock ensures only one cycle runs concurrently. The result of
 * each cycle is written to settings for introspection via the public API.
 */
export async function dailyTick(env: Env): Promise<void> {
  const lockToken = await tryAcquireLock(env, "engine-cycle", 60 * 10); // 10 min TTL
  if (!lockToken) {
    // Another instance is running; skip silently to avoid contention
    return;
  }
  const runId = uuid();
  const cycleStart = nowISO();
  let scanned = 0;
  let drafted = 0;
  let sendResult = { sent: 0, failed: 0 };
  try {
    await logEvent(env, "tick_ok", `Engine cycle started`, { runId });
    scanned = await runScan(env, runId);
    drafted = await runDraft(env, runId);
    sendResult = await runSend(env, runId);
    await logEvent(env, "tick_ok", `Engine cycle completed`, { runId, scanned, drafted, sent: sendResult.sent, failed: sendResult.failed });
  } catch (err) {
    await logEvent(env, "tick_fail", String(err), { runId });
  } finally {
    await releaseLock(env, "engine-cycle", lockToken);
    // Persist summary for status endpoint
    await setSetting(env, "last_engine_run", JSON.stringify({ runId, started_at: cycleStart, scanned, drafted, sent: sendResult.sent, failed: sendResult.failed }));
  }
}

/**
 * Expose API for manual triggering of scan only. Useful for admin to run just
 * discovery logic without drafting or sending.
 */
export async function runScanOnce(env: Env): Promise<{ scanned: number }> {
  const lockToken = await tryAcquireLock(env, "scan-only", 60 * 5);
  if (!lockToken) {
    return { scanned: 0 };
  }
  const runId = uuid();
  let scanned = 0;
  try {
    scanned = await runScan(env, runId);
    await logEvent(env, "scan_ok", `Manual scan completed`, { runId, scanned });
  } finally {
    await releaseLock(env, "scan-only", lockToken);
  }
  return { scanned };
}
