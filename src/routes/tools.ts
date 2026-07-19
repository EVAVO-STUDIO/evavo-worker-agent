import { Env, getSetting } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";

export type JsonResponse = (data: any, init?: ResponseInit) => Response;

export async function handleTools(
  request: Request,
  env: Env,
  pathname: string,
  json: JsonResponse
): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) {
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (request.method === "OPTIONS") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "GET" } });
  }

  if (pathname === "/tools/capabilities" && request.method === "GET") {
    return json({
      ok: true,
      agent: "evavo-outbound-agent",
      contractVersion: "worker_tools_v2_review_first",
      costMode: (await getSetting(env, "cost_mode")) || "free_safe",
      aiDefault: "off",
      sendingDefault: "off",
      writesRequireConfirm: true,
      scheduledExternalExecutionDisabled: true,
      manualLegacyExecutionDisabled: true,
      tools: [
        { name: "agent_health", route: "/admin/health", mode: "read", cost: "cheap" },
        { name: "agent_diagnose", route: "/admin/diagnostics", mode: "read", cost: "cheap" },
        { name: "schema_report", route: "/admin/schema", mode: "read", cost: "cheap" },
        { name: "draft_list", route: "/admin/drafts", mode: "read", cost: "cheap" },
        { name: "draft_review", route: "/admin/draft-review/:id", mode: "internal_write", cost: "cheap", requiresConfirm: true, externalExecution: false },
        { name: "strategy_scores", route: "/admin/strategy-scores", mode: "read", cost: "cheap" },
        { name: "lead_list", route: "/admin/leads", mode: "read", cost: "cheap" },
        { name: "source_list", route: "/admin/sources", mode: "read", cost: "cheap" },
        { name: "source_add", route: "/admin/sources", mode: "internal_write", cost: "cheap", requiresConfirm: true, externalExecution: false },
        { name: "source_test", route: "/admin/sources/:id/test", mode: "bounded_research", cost: "bounded_fetch", requiresConfirm: true, externalMutation: false },
        { name: "source_expand_preview", route: "/admin/sources/:id/expand-preview", mode: "bounded_research", cost: "bounded_fetch_preview", requiresConfirm: true, externalMutation: false },
        { name: "source_expand_commit", route: "/admin/sources/:id/expand-commit", mode: "bounded_research_internal_write", cost: "bounded_fetch_and_write", requiresConfirm: true, externalMutation: false },
        { name: "source_run_tiny", route: "/admin/sources/run-tiny", mode: "bounded_research_internal_write", cost: "bounded_fetch_batch", requiresConfirm: true, externalMutation: false },
        { name: "source_cooldown", route: "/admin/sources/:id/cooldown", mode: "internal_write", cost: "cheap", requiresConfirm: true, externalExecution: false },
      ],
      disabledCapabilities: [
        "legacy_tick",
        "legacy_scan",
        "ai_draft_generation",
        "email_sending",
        "social_posting",
        "form_submission",
        "browser_execution",
        "external_state_mutation",
      ],
    });
  }

  return json({ ok: false, error: "Not found" }, { status: 404 });
}
