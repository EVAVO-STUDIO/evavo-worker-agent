import type { Env } from "./db";

export type SendInput = {
  to: string;
  subject: string;
  bodyText: string;
};

/**
 * Send an email using the MailChannels API. If the worker is not configured
 * with the necessary API key and from address, this function returns an
 * appropriate error. Network errors are surfaced to the caller.
 */
export async function sendEmail(
  env: Env,
  input: SendInput
): Promise<{ ok: boolean; error?: string }> {
  const to = (input.to || "").trim();
  if (!to) return { ok: false, error: "missing_to" };
  if (!env.MAILCHANNELS_API_KEY || !env.FROM_EMAIL) {
    return { ok: false, error: "mail_not_configured" };
  }
  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: env.FROM_EMAIL, name: env.BRAND_NAME || "EVAVO" },
    reply_to: env.REPLY_TO_EMAIL ? { email: env.REPLY_TO_EMAIL } : undefined,
    subject: input.subject,
    content: [{ type: "text/plain", value: input.bodyText }],
  };
  try {
    const res = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.MAILCHANNELS_API_KEY,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return { ok: false, error: await res.text().catch(() => `mail_error_${res.status}`) };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: String(err?.message || err) };
  }
}