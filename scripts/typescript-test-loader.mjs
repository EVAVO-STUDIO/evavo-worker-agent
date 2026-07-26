import { access, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const REPOSITORY_ROOT = await realpath(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
);
const NODE_MODULES_SEGMENT = `${path.sep}node_modules${path.sep}`;
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

function eligibleRepositorySource(filePath) {
  return insideRepository(filePath) &&
    !filePath.includes(NODE_MODULES_SEGMENT) &&
    !filePath.endsWith(".d.ts");
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
    if (!eligibleRepositorySource(unresolvedPath)) throw originalError;

    for (const suffix of CANDIDATE_SUFFIXES) {
      const candidate = `${unresolvedPath}${suffix}`;
      if (!eligibleRepositorySource(candidate)) continue;
      try {
        await access(candidate);
        const resolved = await realpath(candidate);
        if (!eligibleRepositorySource(resolved)) throw originalError;
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

export async function load(url, context, nextLoad) {
  if (!url.startsWith("file:")) return nextLoad(url, context);

  const filePath = fileURLToPath(url);
  if (!/\.tsx?$/u.test(filePath) || !eligibleRepositorySource(filePath)) {
    return nextLoad(url, context);
  }

  const resolved = await realpath(filePath);
  if (!eligibleRepositorySource(resolved)) return nextLoad(url, context);
  const source = await readFile(resolved, "utf-8");
  const transformed = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      verbatimModuleSyntax: false,
      isolatedModules: true,
      sourceMap: false,
    },
    fileName: resolved,
    reportDiagnostics: false,
  });

  return Object.freeze({
    format: "module",
    source: transformed.outputText,
    shortCircuit: true,
  });
}
