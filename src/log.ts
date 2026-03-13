// src/log.ts
import { Env, logEvent as _logEvent } from "./db";

export async function logEvent(env: Env, type: string, message: string, leadId?: string | null) {
  return _logEvent(env, type, message, leadId);
}
