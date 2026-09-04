export const BUSINESS_COMMUNICATION_PRE_SEND_CONTRACT = "business_communication_pre_send_v1" as const;

export type PreSendSeverity = "info" | "warning" | "blocker";

export type PreSendFinding = Readonly<{
  code: string;
  severity: PreSendSeverity;
  message: string;
}>;

export type CommunicationDraftReviewInput = Readonly<{
  channel: "email" | "chat" | "social_dm" | "contact_form";
  subject?: string | null;
  body: string;
  recipients: readonly Readonly<{ name?: string | null; address?: string | null; expected?: boolean }>[];
  expectedRecipientAddresses?: readonly string[];
  attachments?: readonly string[];
  referencedAttachmentNames?: readonly string[];
  verifiedFacts?: readonly string[];
  prohibitedClaims?: readonly string[];
  requiredPoints?: readonly string[];
  relationshipSensitive?: boolean;
  suppressionActive?: boolean;
  sendingEnabled?: boolean;
}>;

export type CommunicationDraftReview = Readonly<{
  contract: typeof BUSINESS_COMMUNICATION_PRE_SEND_CONTRACT;
  passed: boolean;
  sendAllowed: boolean;
  findings: readonly PreSendFinding[];
  checks: Readonly<{
    recipient: boolean;
    attachment: boolean;
    factual: boolean;
    completeness: boolean;
    tone: boolean;
    mechanics: boolean;
    policy: boolean;
  }>;
}>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLACEHOLDER = /\b(?:TBD|TODO|INSERT|PLACEHOLDER|XXX|\[name\]|\[company\]|\[date\]|\[link\])\b/i;
const AI_TICS = /\b(?:delve|leverage|synergy|game[- ]changer|revolutionary|seamlessly|elevate your|unlock the power|in today's fast-paced|hope this email finds you well)\b/i;
const OVERCLAIM = /\b(?:guarantee|definitely|certainly|100%|no risk|will absolutely|always|never fail)\b/i;
const PRESSURE = /\b(?:act now|limited time|urgent opportunity|don't miss out|last chance)\b/i;

function normal(value: unknown, max = 4000): string {
  return typeof value === "string" ? value.replace(/\r\n/g, "\n").trim().slice(0, max) : "";
}

function canonicalAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim().toLowerCase();
  return EMAIL.test(result) ? result : null;
}

function includesMeaningfully(body: string, point: string): boolean {
  const tokens = point.toLowerCase().split(/\W+/).filter((token) => token.length >= 4);
  if (!tokens.length) return body.toLowerCase().includes(point.toLowerCase());
  const text = body.toLowerCase();
  return tokens.filter((token) => text.includes(token)).length / tokens.length >= 0.6;
}

export function reviewBusinessCommunicationBeforeSend(input: CommunicationDraftReviewInput): CommunicationDraftReview {
  const findings: PreSendFinding[] = [];
  const body = normal(input.body, 20_000);
  const subject = normal(input.subject, 500);
  const validRecipients = input.recipients
    .map((recipient) => ({ ...recipient, address: canonicalAddress(recipient.address) }))
    .filter((recipient) => recipient.address !== null);

  let recipient = true;
  let attachment = true;
  let factual = true;
  let completeness = true;
  let tone = true;
  let mechanics = true;
  let policy = true;

  if (!validRecipients.length) {
    findings.push({ code: "recipient_missing", severity: "blocker", message: "No valid recipient address is present." });
    recipient = false;
  }

  const expected = new Set((input.expectedRecipientAddresses ?? []).map(canonicalAddress).filter((value): value is string => Boolean(value)));
  if (expected.size) {
    const actual = new Set(validRecipients.map((item) => item.address as string));
    const missing = [...expected].filter((address) => !actual.has(address));
    const unexpected = [...actual].filter((address) => !expected.has(address));
    if (missing.length || unexpected.length) {
      findings.push({
        code: "recipient_mismatch",
        severity: "blocker",
        message: `Recipient set differs from the verified expected set${missing.length ? `; missing ${missing.join(", ")}` : ""}${unexpected.length ? `; unexpected ${unexpected.join(", ")}` : ""}.`,
      });
      recipient = false;
    }
  }

  if (!body) {
    findings.push({ code: "body_empty", severity: "blocker", message: "Message body is empty." });
    completeness = false;
  }
  if (input.channel === "email" && !subject) {
    findings.push({ code: "subject_missing", severity: "warning", message: "Email subject is empty." });
    mechanics = false;
  }
  if (PLACEHOLDER.test(`${subject}\n${body}`)) {
    findings.push({ code: "placeholder_present", severity: "blocker", message: "Draft contains an unresolved placeholder or TODO marker." });
    mechanics = false;
  }

  const attachmentNames = new Set((input.attachments ?? []).map((item) => item.trim()).filter(Boolean));
  for (const referenced of input.referencedAttachmentNames ?? []) {
    if (!attachmentNames.has(referenced)) {
      findings.push({ code: "attachment_missing", severity: "blocker", message: `Referenced attachment is not present: ${referenced}` });
      attachment = false;
    }
  }
  if (/\b(?:attached|attachment|I've attached|I have attached|please find attached)\b/i.test(body) && !attachmentNames.size) {
    findings.push({ code: "attachment_claim_without_file", severity: "blocker", message: "Draft says a file is attached but no attachment is present." });
    attachment = false;
  }

  for (const claim of input.prohibitedClaims ?? []) {
    if (claim && body.toLowerCase().includes(claim.toLowerCase())) {
      findings.push({ code: "prohibited_claim", severity: "blocker", message: `Draft contains a claim that must not be made without verification: ${claim}` });
      factual = false;
    }
  }
  if (OVERCLAIM.test(body)) {
    findings.push({ code: "overclaim_language", severity: "warning", message: "Draft contains absolute or guarantee-like language that should be verified or softened." });
    factual = false;
  }

  for (const point of input.requiredPoints ?? []) {
    if (!includesMeaningfully(body, point)) {
      findings.push({ code: "required_point_missing", severity: "blocker", message: `A required response point appears to be missing: ${point}` });
      completeness = false;
    }
  }

  if (AI_TICS.test(body)) {
    findings.push({ code: "generic_ai_tone", severity: "warning", message: "Draft contains generic AI/corporate phrasing; rewrite in natural, specific language." });
    tone = false;
  }
  if (PRESSURE.test(body)) {
    findings.push({ code: "pressure_language", severity: "warning", message: "Draft contains unnecessary pressure or artificial urgency language." });
    tone = false;
  }
  if (input.relationshipSensitive && /!{2,}|\b(?:amazing|fantastic|exciting news)\b/i.test(body)) {
    findings.push({ code: "sensitive_tone_mismatch", severity: "warning", message: "Tone may be too upbeat for a sensitive relationship context." });
    tone = false;
  }

  const sentences = body.split(/[.!?]+/).map((item) => item.trim()).filter(Boolean);
  const veryLong = sentences.filter((sentence) => sentence.length > 320).length;
  if (veryLong >= 2) {
    findings.push({ code: "sentence_complexity", severity: "warning", message: "Several sentences are unusually long; simplify for natural readability." });
    mechanics = false;
  }
  if (body.length > 5000 && input.channel !== "email") {
    findings.push({ code: "channel_length", severity: "warning", message: "Message is unusually long for this channel." });
    mechanics = false;
  }

  if (input.suppressionActive) {
    findings.push({ code: "suppression_active", severity: "blocker", message: "Active suppression prevents external contact." });
    policy = false;
  }
  if (!input.sendingEnabled) {
    findings.push({ code: "sending_disabled", severity: "blocker", message: "External sending capability is disabled in the active runtime." });
    policy = false;
  }

  if (input.verifiedFacts?.length) {
    findings.push({ code: "facts_supplied", severity: "info", message: `${input.verifiedFacts.length} verified fact reference(s) were supplied for reviewer comparison.` });
  }

  const blockers = findings.filter((finding) => finding.severity === "blocker");
  const passed = blockers.length === 0;
  return {
    contract: BUSINESS_COMMUNICATION_PRE_SEND_CONTRACT,
    passed,
    sendAllowed: passed && policy,
    findings,
    checks: { recipient, attachment, factual, completeness, tone, mechanics, policy },
  };
}
