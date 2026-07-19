import type { Env } from "../db";
import { getAdminToken } from "../db";

const encoder = new TextEncoder();

function extractBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization || !authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length);
  if (!token || token.trim() !== token || /\s/.test(token)) return null;
  return token;
}

async function digest(value: string): Promise<Uint8Array> {
  const result = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return new Uint8Array(result);
}

async function constantTimeEqual(left: string, right: string): Promise<boolean> {
  const [leftDigest, rightDigest] = await Promise.all([digest(left), digest(right)]);
  let difference = 0;
  for (let index = 0; index < leftDigest.length; index += 1) {
    difference |= leftDigest[index] ^ rightDigest[index];
  }
  return difference === 0;
}

export async function isAdminRequestAuthorized(request: Request, env: Env): Promise<boolean> {
  const expected = getAdminToken(env);
  const provided = extractBearerToken(request);
  if (!expected || !provided) return false;
  return constantTimeEqual(provided, expected);
}
