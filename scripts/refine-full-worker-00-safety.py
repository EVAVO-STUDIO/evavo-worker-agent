from pathlib import Path
import sys


ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd().resolve()
PATH = ROOT / "scripts/check-safety-gate-completeness.mjs"
source = PATH.read_text(encoding="utf-8")
source = source.replace('  "test:core": "node --test",\n', "", 1)

block = '''const coreTestCommand = String(scripts["test:core"] || "");
for (const token of [
  "--experimental-strip-types",
  "--experimental-transform-types",
  "--experimental-loader ./scripts/typescript-test-loader.mjs",
  "--test",
]) {
  if (!coreTestCommand.includes(token)) {
    errors.push(`package.json test:core must retain guarded TypeScript test token: ${token}`);
  }
}
if (scripts["test:typescript-loader:check"] !== "node scripts/check-typescript-test-loader.mjs") {
  errors.push("package.json must expose test:typescript-loader:check through the focused loader guard");
}
if (!checkLocal.includes("npm run test:typescript-loader:check")) {
  errors.push("check:local must execute test:typescript-loader:check");
}
if (checkLocal.indexOf("npm run test:typescript-loader:check") > checkLocal.indexOf("npm run test:core")) {
  errors.push("check:local must guard TypeScript test resolution before test:core");
}
'''
if block not in source:
    marker = '\nfor (const relativePath of [\n'
    if marker not in source:
        raise SystemExit("safety gate relative-path anchor is stale")
    source = source.replace(marker, f"\n{block}\nfor (const relativePath of [\n", 1)

PATH.write_text(source, encoding="utf-8")
