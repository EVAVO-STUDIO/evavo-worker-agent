import { access, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPOSITORY_ROOT = await realpath(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
);
const CANDIDATE_SUFFIXES = Object.freeze([
  ".ts",
  ".tsx",
  "/index.ts",
  "/index.tsx",
]);

function insideRepository(filePath) {
  const relative = path.relative(REPOSITORY_ROOT, filePath);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function eligibleSpecifier(specifier, parentURL) {
  return Boolean(
    parentURL &&
    parentURL.startsWith("file:") &&
    specifier.startsWith(".") &&
    !path.extname(specifier) &&
    !specifier.includes("\0") &&
    !specifier.includes("?") &&
    !specifier.includes("#")
  );
}

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (originalError) {
    if (!eligibleSpecifier(specifier, context.parentURL)) throw originalError;

    const parentPath = fileURLToPath(context.parentURL);
    const unresolvedPath = path.resolve(path.dirname(parentPath), specifier);
    if (!insideRepository(unresolvedPath)) throw originalError;

    for (const suffix of CANDIDATE_SUFFIXES) {
      const candidate = `${unresolvedPath}${suffix}`;
      if (!insideRepository(candidate)) continue;
      try {
        await access(candidate);
        const resolved = await realpath(candidate);
        if (!insideRepository(resolved)) throw originalError;
        return Object.freeze({
          url: pathToFileURL(resolved).href,
          shortCircuit: true,
        });
      } catch {
        // Try the next reviewed TypeScript source suffix.
      }
    }

    throw originalError;
  }
}
