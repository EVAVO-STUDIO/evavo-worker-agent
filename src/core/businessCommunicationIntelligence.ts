export const BUSINESS_COMMUNICATION_INTELLIGENCE_CONTRACT = "business_communication_intelligence_v1" as const;

export type CommunicationParticipant = Readonly<{
  name?: string | null;
  address?: string | null;
  role?: string | null;
  organization?: string | null;
}>;

export type CommunicationMessage = Readonly<{
  id: string;
  sentAt: string;
  sender: CommunicationParticipant;
  to: readonly CommunicationParticipant[];
  cc?: readonly CommunicationParticipant[];
  subject?: string | null;
  body: string;
  attachments?: readonly string[];
}>;

export type CommunicationIntent =
  | "reply_required"
  | "reply_optional"
  | "acknowledgement"
  | "action_required"
  | "decision_required"
  | "information_only"
  | "scheduling"
  | "commercial"
  | "support"
  | "relationship_repair"
  | "unclear";

export type CommunicationObligation = Readonly<{
  owner: "evavo" | "external" | "shared" | "unknown";
  description: string;
  dueAt: string | null;
  evidenceMessageId: string;
  confidence: number;
}>;

export type CommunicationAnalysis = Readonly<{
  contract: typeof BUSINESS_COMMUNICATION_INTELLIGENCE_CONTRACT;
  threadId: string;
  latestMessageId: string | null;
  primaryIntent: CommunicationIntent;
  replyNeeded: boolean;
  replyUrgency: "none" | "low" | "normal" | "high";
  recipientConfidence: number;
  threadConfidence: number;
  relationshipSensitivity: "normal" | "careful" | "sensitive";
  obligations: readonly CommunicationObligation[];
  unansweredQuestions: readonly string[];
  factualClaimsToVerify: readonly string[];
  attachmentChecks: readonly string[];
  toneGuidance: readonly string[];
  responseGoals: readonly string[];
  risks: readonly string[];
  uncertainties: readonly string[];
  recommendedAction: "draft_reply" | "draft_internal_note" | "ask_for_review" | "no_reply" | "defer";
}>;

const QUESTION = /\?/g;
const REQUEST = /\b(?:please|could you|can you|would you|need you to|we need|please send|please provide|please confirm|please advise|let me know|can we|could we)\b/i;
const DECISION = /\b(?:approve|approval|confirm whether|choose|decision|sign off|agree to|accept|reject)\b/i;
const SCHEDULING = /\b(?:meeting|call|calendar|schedule|availability|available|tomorrow|next week|time works|reschedule)\b/i;
const COMMERCIAL = /\b(?:quote|proposal|scope|budget|fee|cost|invoice|purchase order|po\b|contract|rate|pricing)\b/i;
const SUPPORT = /\b(?:issue|problem|error|broken|not working|support|urgent fix|bug|incident)\b/i;
const REPAIR = /\b(?:sorry|apolog|concern|disappointed|frustrat|unhappy|complaint|missed|overdue|late)\b/i;
const THANKS_ONLY = /^\s*(?:thanks|thank you|cheers|great|perfect|received|noted|sounds good)[.!\s]*$/i;
const DATEISH = /\b(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|this week|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b/i;

function clean(value: unknown, max = 1200): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, max) : null;
}

function validTimestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function participantIdentityConfidence(participant: CommunicationParticipant): number {
  let score = 0;
  if (clean(participant.address, 320)) score += 55;
  if (clean(participant.name, 160)) score += 25;
  if (clean(participant.organization, 160) || clean(participant.role, 160)) score += 20;
  return Math.min(100, score);
}

function classifyIntent(body: string): CommunicationIntent {
  if (REPAIR.test(body)) return "relationship_repair";
  if (SUPPORT.test(body)) return "support";
  if (COMMERCIAL.test(body)) return "commercial";
  if (SCHEDULING.test(body)) return "scheduling";
  if (DECISION.test(body)) return "decision_required";
  if (REQUEST.test(body)) return "action_required";
  if ((body.match(QUESTION) ?? []).length) return "reply_required";
  if (THANKS_ONLY.test(body)) return "acknowledgement";
  return "information_only";
}

function obligationOwner(body: string): CommunicationObligation["owner"] {
  if (/\b(?:you|your team|evavo|greg)\b/i.test(body)) return "evavo";
  if (/\b(?:we will|i will|we'll|i'll)\b/i.test(body)) return "external";
  return "unknown";
}

function extractObligations(message: CommunicationMessage): CommunicationObligation[] {
  const body = clean(message.body, 8000) ?? "";
  const sentences = body.split(/(?<=[.!?])\s+/).slice(0, 80);
  const results: CommunicationObligation[] = [];
  for (const sentence of sentences) {
    if (!REQUEST.test(sentence) && !/\b(?:will|need to|must|due|by end of|before)\b/i.test(sentence)) continue;
    const description = clean(sentence, 400);
    if (!description) continue;
    results.push({
      owner: obligationOwner(sentence),
      description,
      dueAt: null,
      evidenceMessageId: message.id,
      confidence: DATEISH.test(sentence) ? 82 : 68,
    });
    if (results.length >= 12) break;
  }
  return results;
}

function extractQuestions(body: string): string[] {
  return body
    .split(/(?<=[?])\s+/)
    .map((part) => clean(part, 500))
    .filter((part): part is string => Boolean(part && part.includes("?")))
    .slice(0, 12);
}

function verificationClaims(body: string): string[] {
  const claims: string[] = [];
  const sentences = body.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    if (/\b(?:\$|AUD|NZD|USD|%|deadline|due|approved|completed|sent|attached|included|confirmed|contract|invoice|quote|scope)\b/i.test(sentence)) {
      const value = clean(sentence, 400);
      if (value) claims.push(value);
    }
    if (claims.length >= 10) break;
  }
  return claims;
}

export function analyseBusinessCommunicationThread(input: Readonly<{
  threadId: string;
  messages: readonly CommunicationMessage[];
  knownRelationshipSensitive?: boolean;
  senderSuppressed?: boolean;
}>): CommunicationAnalysis {
  const valid = input.messages
    .map((message) => ({ message, timestamp: validTimestamp(message.sentAt) }))
    .filter((entry): entry is { message: CommunicationMessage; timestamp: number } => entry.timestamp !== null)
    .sort((a, b) => a.timestamp - b.timestamp);

  const latest = valid.at(-1)?.message ?? null;
  const body = clean(latest?.body, 8000) ?? "";
  const primaryIntent = latest ? classifyIntent(body) : "unclear";
  const obligations = valid.flatMap(({ message }) => extractObligations(message)).slice(-20);
  const unansweredQuestions = latest ? extractQuestions(body) : [];
  const risks: string[] = [];
  const uncertainties: string[] = [];
  const attachmentChecks: string[] = [];
  const toneGuidance: string[] = [];
  const responseGoals: string[] = [];

  if (!latest) {
    uncertainties.push("No valid dated message is available for thread analysis.");
  }

  const recipientConfidence = latest
    ? Math.min(100, Math.round((participantIdentityConfidence(latest.sender) + Math.max(0, ...latest.to.map(participantIdentityConfidence))) / 2))
    : 0;

  const threadConfidence = latest
    ? Math.max(0, Math.min(100, 65 + Math.min(20, valid.length * 3) + (body ? 10 : 0) - (recipientConfidence < 70 ? 20 : 0)))
    : 0;

  const relationshipSensitivity = input.knownRelationshipSensitive || primaryIntent === "relationship_repair"
    ? "sensitive" as const
    : primaryIntent === "commercial" || primaryIntent === "support"
      ? "careful" as const
      : "normal" as const;

  if (recipientConfidence < 70) risks.push("Recipient or sender identity is not sufficiently evidenced for confident external communication.");
  if (input.senderSuppressed) risks.push("The sender or relationship is suppressed; do not initiate or continue external contact without explicit review.");
  if (primaryIntent === "relationship_repair") risks.push("The thread contains relationship-risk language; factual acknowledgement and ownership matter more than polished sales language.");
  if (unansweredQuestions.length > 3) risks.push("Multiple questions are present; a reply must answer each one explicitly or state what remains unresolved.");

  const mentionsAttachment = /\b(?:attach|attached|attachment|enclosed|included file|see file)\b/i.test(body);
  if (mentionsAttachment) attachmentChecks.push("Verify every referenced attachment exists and is the intended current version before any send action.");
  if (latest?.attachments?.length) attachmentChecks.push(`Thread metadata reports ${latest.attachments.length} attachment(s); verify names and versions against the reply.`);

  if (relationshipSensitivity === "sensitive") {
    toneGuidance.push("Be calm, specific and accountable. Do not become defensive, overly cheerful or sales-oriented.");
  } else if (relationshipSensitivity === "careful") {
    toneGuidance.push("Be concise, competent and commercially aware without sounding scripted or pushy.");
  } else {
    toneGuidance.push("Match the other person's level of formality and keep the reply natural and proportionate.");
  }
  toneGuidance.push("Prefer plain Australian business English, normal contractions and concrete wording over generic corporate filler.");
  toneGuidance.push("Do not mirror unusual phrasing mechanically; preserve EVAVO's voice while respecting the sender's tone.");

  switch (primaryIntent) {
    case "action_required":
    case "reply_required":
      responseGoals.push("Answer the actual request directly before adding context.");
      break;
    case "decision_required":
      responseGoals.push("State the decision clearly, including any conditions or unresolved dependencies.");
      break;
    case "scheduling":
      responseGoals.push("Resolve dates, timezone and who is expected to attend before confirming anything.");
      break;
    case "commercial":
      responseGoals.push("Separate confirmed scope, assumptions, exclusions, price and next step; do not invent commercial terms.");
      break;
    case "support":
      responseGoals.push("Acknowledge the issue, state what is known, avoid premature root-cause claims and give the next concrete action.");
      break;
    case "relationship_repair":
      responseGoals.push("Address the concern itself, acknowledge any verified EVAVO responsibility and avoid performative apology language.");
      break;
    case "acknowledgement":
      responseGoals.push("Keep any reply brief; do not create unnecessary back-and-forth.");
      break;
    case "information_only":
      responseGoals.push("Do not reply unless acknowledgement, relationship context or an outstanding obligation makes a response useful.");
      break;
    default:
      responseGoals.push("Clarify the thread intent before preparing an external reply.");
  }

  const replyNeeded = ["reply_required", "action_required", "decision_required", "scheduling", "commercial", "support", "relationship_repair"].includes(primaryIntent);
  const replyUrgency = primaryIntent === "support" || primaryIntent === "relationship_repair"
    ? "high" as const
    : replyNeeded
      ? "normal" as const
      : primaryIntent === "acknowledgement"
        ? "low" as const
        : "none" as const;

  let recommendedAction: CommunicationAnalysis["recommendedAction"] = replyNeeded ? "draft_reply" : "no_reply";
  if (!latest || threadConfidence < 60) recommendedAction = "defer";
  if (input.senderSuppressed || recipientConfidence < 70 || relationshipSensitivity === "sensitive") recommendedAction = "ask_for_review";

  return {
    contract: BUSINESS_COMMUNICATION_INTELLIGENCE_CONTRACT,
    threadId: input.threadId,
    latestMessageId: latest?.id ?? null,
    primaryIntent,
    replyNeeded,
    replyUrgency,
    recipientConfidence,
    threadConfidence,
    relationshipSensitivity,
    obligations,
    unansweredQuestions,
    factualClaimsToVerify: verificationClaims(body),
    attachmentChecks,
    toneGuidance,
    responseGoals,
    risks,
    uncertainties,
    recommendedAction,
  };
}
