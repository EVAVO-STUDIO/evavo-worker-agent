// Cloudflare Workers implement the URLSearchParams iterable methods at runtime.
// TypeScript's WebWorker lib omits them unless DOM.Iterable is also loaded, but
// loading the full DOM surface would incorrectly make browser-only globals look
// available in Worker source. Keep this declaration deliberately narrow.
interface URLSearchParams {
  entries(): IterableIterator<[string, string]>;
  keys(): IterableIterator<string>;
  values(): IterableIterator<string>;
  [Symbol.iterator](): IterableIterator<[string, string]>;
}
