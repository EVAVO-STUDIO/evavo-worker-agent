from pathlib import Path
import sys


ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd().resolve()


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        if new in text:
            return
        raise SystemExit(f"stale replacement in {path}: {old}")
    write(path, text.replace(old, new, 1))


# The bounded request boundary now copies bytes into a plain ArrayBuffer before
# Web Crypto. Validate the reviewed helper call instead of the superseded direct
# Uint8Array digest expression.
replace_once(
    "scripts/check-bounded-json-request-safety.mjs",
    '  \'crypto.subtle.digest("SHA-256", bytes)\',',
    '''  'import { copyBytesToArrayBuffer } from "./cryptoBufferSource"',
  "copyBytesToArrayBuffer(bytes)",''',
)


# Core tests execute through the guarded TypeScript loader so extensionless TS
# imports are deterministic. Preserve those protections rather than requiring
# the retired raw node --test command.
replace_once(
    "scripts/check-bounded-json-request-safety.mjs",
    '''if (packageJson.scripts?.["test:core"] !== "node --test") {
  errors.push("package.json must expose test:core as node --test");
}
''',
    '''const coreTestCommand = String(packageJson.scripts?.["test:core"] || "");
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
''',
)
