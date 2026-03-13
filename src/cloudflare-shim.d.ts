type ExecutionContext = { waitUntil(promise: Promise<any>): void };
type ScheduledEvent = { cron: string };

declare interface D1Result<T = Record<string, unknown>> { results?: T[]; }
declare interface D1PreparedStatement {
  bind(...args: any[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<any>;
}
declare interface D1Database { prepare(query: string): D1PreparedStatement; }
