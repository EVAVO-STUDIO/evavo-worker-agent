import type { Env } from "./db";
import { bump } from "./db";

export type SendInput = {
  to: string;
  subject: string;
  bodyText: string;
};

export async function sendEmail(env: Env, input: SendInput): Promise<{ ok: boolean; error?: string }> {
  const to = (input.to || "").trim();
  if (!to) return { ok: false, error: "missing_to" };

  if (!env.MAILCHANNELS_API_KEY || !env.FROM_EMAIL) {
    return { ok: false, error: "mail_not_configured" };
  }

  const res = await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.MAILCHANNELS_API_KEY,
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: env.FROM_EMAIL, name: env.BRAND_NAME || "EVAVO" },
      reply_to: env.REPLY_TO_EMAIL ? { email: env.REPLY_TO_EMAIL } : undefined,
      subject: input.subject,
      content: [{ type: "text/plain", value: input.bodyText }],
    }),
  }).catch((error: any) => ({ ok: false, status: 0, text: async () => String(error?.message || error) } as Response));

  if (!res.ok) {
    return { ok: false, error: await res.text().catch(() => `mail_error_${res.status}`) };
  }

  await bump(env, "send_sent_today", 1);
  return { ok: true };
}
