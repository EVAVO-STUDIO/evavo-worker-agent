// FULL REPLACEMENT FILE: src/db.ts

export type Env = {
  DB: D1Database;
};

export async function getSettings(env: Env) {
  const res = await env.DB.prepare(
    `SELECT key, value FROM settings`
  ).all();

  const obj: Record<string, string> = {};
  for (const row of res.results || []) {
    obj[row.key] = row.value;
  }
  return obj;
}

export async function setSetting(env: Env, key: string, value: string) {
  await env.DB.prepare(
    `INSERT INTO settings (key, value)
     VALUES (?1, ?2)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`
  ).bind(key, value).run();
}

export async function getEngineState(env: Env) {
  const settings = await getSettings(env);

  return {
    enabled: settings["enabled"] !== "false",
    sendingEnabled: settings["sendingEnabled"] === "true",
    pausedReason: settings["pausedReason"] || null,
  };
}
