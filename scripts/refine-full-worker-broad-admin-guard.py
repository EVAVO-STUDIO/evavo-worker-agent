from pathlib import Path
import sys


ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd().resolve()
PATH = ROOT / "scripts/check-broad-admin-write-safety.mjs"
source = PATH.read_text(encoding="utf-8")


def replace_once(old: str, new: str) -> None:
    global source
    if old not in source:
        if new in source:
            return
        raise SystemExit(f"broad-admin guard anchor is stale: {old}")
    source = source.replace(old, new, 1)


replace_once(
    '''  'pathname === "/admin/leads" && request.method === "POST"',
  "const body = await request.clone().json()",
  "if (!confirmed(body))",
  'error: "confirm_required"',
''',
    '''  "manualMetadataWriteRequiresConfirmation(pathname, request.method)",
  "readBoundedJsonObject(request.clone(), {",
  "boundedJsonFailurePayload(parsed)",
  "if (!isExplicitJsonConfirmation(parsed.value))",
  'error: "confirm_required"',
  "confirmationCoercionAllowed: false",
  "requestReceipt",
''',
)
replace_once(
    '''const authPosition = wrapper.indexOf("await isAdminRequestAuthorized(request, env)");
const optionsPosition = wrapper.indexOf('request.method === "OPTIONS"');
const bodyPosition = wrapper.indexOf("const body = await request.clone().json()");
const confirmPosition = wrapper.indexOf("if (!confirmed(body))");
const delegatePosition = wrapper.indexOf("return handleAdminImplementation(request, env, pathname, ctx, json)");
if (!(authPosition >= 0 && optionsPosition > authPosition && bodyPosition > optionsPosition && confirmPosition > bodyPosition && delegatePosition > confirmPosition)) {
  errors.push("Broad admin wrapper must authenticate before OPTIONS and confirm manual record insertion before delegation");
}
''',
    '''const authPosition = wrapper.indexOf("await isAdminRequestAuthorized(request, env)");
const optionsPosition = wrapper.indexOf('request.method === "OPTIONS"');
const scopePosition = wrapper.indexOf("if (manualMetadataWriteRequiresConfirmation(pathname, request.method))");
const bodyPosition = wrapper.indexOf("readBoundedJsonObject(request.clone(), {");
const failurePosition = wrapper.indexOf("boundedJsonFailurePayload(parsed)");
const confirmPosition = wrapper.indexOf("if (!isExplicitJsonConfirmation(parsed.value))");
const delegatePosition = wrapper.indexOf("return handleAdminImplementation(request, env, pathname, ctx, json)");
if (!(
  authPosition >= 0 &&
  optionsPosition > authPosition &&
  scopePosition > optionsPosition &&
  bodyPosition > scopePosition &&
  failurePosition > bodyPosition &&
  confirmPosition > failurePosition &&
  delegatePosition > confirmPosition
)) {
  errors.push("Broad admin wrapper must authenticate before OPTIONS, bound manual record insertion, require exact confirmation, and delegate last");
}
for (const stale of [
  "request.clone().json()",
  "const body = await request.clone().json()",
  "if (!confirmed(body))",
  "body?.confirm === 1",
  'body?.confirm === "1"',
]) {
  if (wrapper.includes(stale)) errors.push(`Protected broad admin wrapper contains stale unsafe token: ${stale}`);
}
''',
)

PATH.write_text(source, encoding="utf-8")
