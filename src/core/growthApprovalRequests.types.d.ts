import type { Env } from "../db";
import type {
  GrowthApprovalRequest,
  GrowthApprovalStatus,
} from "./growthApprovalRequests";

// The implementation normalises an explicit null decision note to SQL NULL.
// Expose that existing runtime behaviour to strict TypeScript callers.
declare module "./growthApprovalRequests" {
  export function updateGrowthApprovalRequestStatus(
    env: Env,
    id: string,
    status: GrowthApprovalStatus | string,
    reviewer?: string,
    decisionNote?: string | null,
  ): Promise<GrowthApprovalRequest>;
}
