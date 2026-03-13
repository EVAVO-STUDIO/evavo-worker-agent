declare interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = any>(): Promise<T | null>;
  run(): Promise<any>;
  all<T = any>(): Promise<{ results?: T[] }>;
}

declare interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

declare interface ScheduledEvent {
  cron: string;
  scheduledTime?: number;
}
declare interface ExecutionContext { waitUntil(promise: Promise<any>): void; }
