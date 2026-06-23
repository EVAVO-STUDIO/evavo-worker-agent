import { Env, getSetting } from "../db";

export type JsonResponse = (data: any, init?: ResponseInit) => Response;

export async function handleTools(
  request: Request,
  env: Env,
  pathname: string,
  json: JsonResponse
): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });

  if (pathname === "/tools/capabilities" && request.method === "GET") {
    return json({
      ok: true,
      agent: "evavo-outbound-agent",
      costMode: (await getSetting(env, "cost_mode")) || "free_safe",
      aiDefault: (await getSetting(env, "ai_enabled")) === "1" ? "enabled" : "off",
      sendingDefault: (await getSetting(env, "sending_enabled")) === "1" ? "enabled" : "off",
      writesRequireConfirm: true,
      tools: [
        { name: "agent_health", route: "/admin/health", mode: "read", cost: "cheap" },
        { name: "agent_diagnose", route: "/admin/diagnostics", mode: "read", cost: "cheap" },
        { name: "schema_report", route: "/admin/schema", mode: "read", cost: "cheap" },
        { name: "draft_list", route: "/admin/drafts", mode: "read", cost: "cheap" },
        { name: "draft_review", route: "/admin/draft-review/:id", mode: "write", cost: "cheap", requiresConfirm: true },
        { name: "strategy_scores", route: "/admin/strategy-scores", mode: "read", cost: "cheap" },
        { name: "lead_list", route: "/admin/leads", mode: "read", cost: "cheap" },
        { name: "source_list", route: "/admin/sources", mode: "read", cost: "cheap" },
        { name: "source_add", route: "/admin/sources", mode: "write", cost: "cheap", requiresConfirm: true },
        { name: "source_test", route: "/admin/sources/:id/test", mode: "write", cost: "bounded_fetch", requiresConfirm: true },
        { name: "source_expand_preview", route: "/admin/sources/:id/expand-preview", mode: "write", cost: "bounded_fetch_preview", requiresConfirm: true },
        { name: "source_expand_commit", route: "/admin/sources/:id/expand-commit", mode: "write", cost: "bounded_fetch_and_write", requiresConfirm: true },
        { name: "source_cooldown", route: "/admin/sources/:id/cooldown", mode: "write", cost: "cheap", requiresConfirm: true },
      ],
    });
  }

  return json({ ok: false, error: "Not found" }, { status: 404 });
}
