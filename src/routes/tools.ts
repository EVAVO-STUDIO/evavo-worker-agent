import { Env } from "../db";

export type JsonResponse = (data: any, init?: ResponseInit) => Response;

export async function handleTools(
  _request: Request,
  _env: Env,
  _pathname: string,
  json: JsonResponse
): Promise<Response> {
  return json({ ok: true, agent: "evavo-outbound-agent", tools: [] });
}
