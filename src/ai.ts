import type { Env, LeadBrief, LeadClass } from "./db";
import { bump, getSetting } from "./db";

export type DraftInput = {
  companyName: string;
  websiteUrl: string;
  leadClass: LeadClass;
  brief: LeadBrief;
  primaryEmail?: string | null;
};

export type DraftResult = {
  subject: string;
  body: string;
  followup: string;
  why: string[];
  usedAI: boolean;
  source: "ai" | "template";
};

export async function isAIEnabled(env: Env): Promise<boolean> {
  const value = (await getSetting(env, "ai_enabled")) || "0";
  return value === "1" || value === "true";
}

function buildAngleLabel(input: DraftInput) {
  return input.brief.outreachAngles[0] || (input.leadClass === "ideal_client" ? "a practical website uplift angle" : "a practical partner-support angle");
}

function buildSubject(input: DraftInput) {
  if (input.leadClass === "possible_partner" || input.leadClass === "agency_peer") {
    return `${input.companyName} — overflow dev / implementation support`;
  }
  return `${input.companyName} — a quick site improvement idea`;
}

function buildTemplate(input: DraftInput): DraftResult {
  const angle = buildAngleLabel(input);
  const line1 = input.leadClass === "ideal_client"
    ? `Had a look through ${input.websiteUrl}. There are a few practical ways the site could make enquiries easier and present the work more cleanly.`
    : `Had a look through ${input.websiteUrl}. Feels like there may be room for practical overflow or implementation support on the technical side.`;

  const body = [
    `Hi ${input.companyName} team,`,
    "",
    line1,
    input.brief.groundedFacts[0] || "",
    input.brief.groundedFacts[1] || "",
    `The angle I’d raise is ${angle.toLowerCase()}.`,
    "",
    `If helpful, I can send a short, specific note with 2–3 grounded suggestions rather than a generic pitch.`,
    "",
    "Greg",
    "EVAVO",
  ]
    .filter(Boolean)
    .join("\n");

  const followup = [
    `Hi ${input.companyName} team,`,
    "",
    "Just following up on the note below.",
    input.brief.outreachAngles[1] || "Happy to send a short practical breakdown if useful.",
    "",
    "Greg",
    "EVAVO",
  ].join("\n");

  return {
    subject: buildSubject(input),
    body,
    followup,
    why: [
      `Lead class: ${input.leadClass}.`,
      ...input.brief.groundedFacts.slice(0, 3),
      `Primary angle: ${buildAngleLabel(input)}.`,
    ],
    usedAI: false,
    source: "template",
  };
}

export async function draftEmail(env: Env, input: DraftInput): Promise<DraftResult> {
  const fallback = buildTemplate(input);
  if (!(await isAIEnabled(env)) || !env.AI) return fallback;

  const model = (await getSetting(env, "ai_model")) || "@cf/meta/llama-3.1-8b-instruct";
  const system = [
    "You write short, grounded outbound emails.",
    "Use only the facts provided.",
    "Never use fake personalization, hype, or generic agency language.",
    "Avoid phrases like 'I hope this finds you well', 'just reaching out', 'unlock growth', or 'elevate your brand'.",
    "Keep the email human, plain, and practical.",
    "Return strict JSON with keys: subject, body, followup, why.",
  ].join(" ");

  const user = JSON.stringify(
    {
      company: input.companyName,
      website: input.websiteUrl,
      leadClass: input.leadClass,
      contactEmail: input.primaryEmail || null,
      brief: input.brief,
      style: {
        maxWords: 140,
        tone: input.leadClass === "ideal_client" ? "practical site review" : "practical partner-support",
        avoid: input.brief.avoidSaying,
      },
    },
    null,
    2
  );

  try {
    const result = await env.AI.run(model, {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 700,
    });

    const text = String(
      typeof result === "string"
        ? result
        : result?.response || result?.result || result?.output_text || ""
    );

    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = /\{[\s\S]*\}/.exec(text);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          parsed = null;
        }
      }
    }

    const subject = String(parsed?.subject || "").trim();
    const body = String(parsed?.body || "").trim();
    const followup = String(parsed?.followup || "").trim();
    const why = Array.isArray(parsed?.why) ? parsed.why.map((item: any) => String(item)) : fallback.why;

    if (!subject || !body) return fallback;
    await bump(env, "ai_used_today", 1);
    return { subject, body, followup: followup || fallback.followup, why, usedAI: true, source: "ai" };
  } catch {
    return fallback;
  }
}
