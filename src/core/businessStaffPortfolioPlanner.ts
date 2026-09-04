import type { StaffPriorityDecision } from "./businessStaffPriorityEngine";
import type { StaffWorkMode } from "./businessStaffWorkMode";

export const BUSINESS_STAFF_PORTFOLIO_CONTRACT = "business_staff_portfolio_v1" as const;

export type StaffPortfolioItem = Readonly<{
  id: string;
  priority: StaffPriorityDecision;
  mode: StaffWorkMode;
  createdAt: string;
  estimatedMinutes: number;
  existingClientOrPartner: boolean;
  routineAdmin: boolean;
}>;

export type StaffPortfolioPlan = Readonly<{
  contract: typeof BUSINESS_STAFF_PORTFOLIO_CONTRACT;
  interrupts: readonly string[];
  today: readonly string[];
  queued: readonly string[];
  monitored: readonly string[];
  ignored: readonly string[];
  reasons: Readonly<Record<string, readonly string[]>>;
}>;

const DAY_MS = 86_400_000;

function ageDays(createdAt: string, now: number): number {
  const parsed = Date.parse(createdAt);
  return Number.isFinite(parsed) && parsed <= now ? Math.floor((now - parsed) / DAY_MS) : 0;
}

function fairnessBoost(item: StaffPortfolioItem, now: number): number {
  const age = ageDays(item.createdAt, now);
  if (age < 3) return 0;
  const base = Math.min(12, Math.floor(age / 2) * 2);
  if (item.routineAdmin) return Math.min(6, base);
  return base;
}

export function planStaffPortfolio(
  items: readonly StaffPortfolioItem[],
  options: Readonly<{ maxInterrupts?: number; todayBudgetMinutes?: number }> = {},
  now = Date.now(),
): StaffPortfolioPlan {
  const maxInterrupts = Math.max(1, Math.min(5, options.maxInterrupts ?? 2));
  const todayBudgetMinutes = Math.max(30, Math.min(720, options.todayBudgetMinutes ?? 240));
  const reasons: Record<string, string[]> = {};

  const ignored = items.filter((item) => item.mode === "ignore").map((item) => item.id);
  const monitored = items.filter((item) => item.mode === "monitor").map((item) => item.id);

  const interruptCandidates = items
    .filter((item) => item.mode === "interrupt_now")
    .sort((a, b) => b.priority.score - a.priority.score || a.id.localeCompare(b.id));

  const interrupts = interruptCandidates.slice(0, maxInterrupts).map((item) => item.id);
  for (const item of interruptCandidates.slice(maxInterrupts)) {
    reasons[item.id] = ["Critical work exists, but the interrupt cap prevents attention thrashing; keep it at the front of today's queue instead."];
  }

  const todayCandidates = items
    .filter((item) => item.mode === "handle_today" || (item.mode === "interrupt_now" && !interrupts.includes(item.id)))
    .map((item) => ({ item, adjusted: Math.min(100, item.priority.score + fairnessBoost(item, now)) }))
    .sort((a, b) => b.adjusted - a.adjusted || a.item.id.localeCompare(b.item.id));

  const today: string[] = [];
  let usedMinutes = 0;
  for (const { item, adjusted } of todayCandidates) {
    const duration = Math.max(1, Math.min(240, Math.round(item.estimatedMinutes)));
    const fits = usedMinutes + duration <= todayBudgetMinutes;
    if (fits || today.length === 0) {
      today.push(item.id);
      usedMinutes += duration;
      if (adjusted > item.priority.score) {
        reasons[item.id] = [...(reasons[item.id] ?? []), "Aging work received a bounded fairness boost so important obligations do not starve indefinitely."];
      }
    } else {
      reasons[item.id] = [...(reasons[item.id] ?? []), "Today's planned work budget is full; retain priority at the front of the queued work rather than overloading the day."];
    }
  }

  const selected = new Set([...interrupts, ...today, ...monitored, ...ignored]);
  const queued = items
    .filter((item) => !selected.has(item.id))
    .map((item) => ({ item, adjusted: Math.min(100, item.priority.score + fairnessBoost(item, now)) }))
    .sort((a, b) => {
      if (a.item.existingClientOrPartner !== b.item.existingClientOrPartner) {
        return a.item.existingClientOrPartner ? -1 : 1;
      }
      return b.adjusted - a.adjusted || a.item.id.localeCompare(b.item.id);
    })
    .map(({ item }) => item.id);

  return {
    contract: BUSINESS_STAFF_PORTFOLIO_CONTRACT,
    interrupts,
    today,
    queued,
    monitored,
    ignored,
    reasons,
  };
}
