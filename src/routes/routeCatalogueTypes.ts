export type RouteSafety = "read_only" | "confirm_required" | "settings_gated" | "public_read_only";
export type RouteSection = "cockpit" | "planner" | "sources" | "opportunities" | "drafts" | "safety" | "growth" | "public";

export type RouteCatalogueItem = {
  id: string;
  method: string;
  path: string;
  label: string;
  section: RouteSection;
  safety: RouteSafety;
  readOnly: boolean;
  requiresConfirm: boolean;
  writesTables: string[];
  callsNetwork: boolean;
  callsAI: boolean;
  canSendEmail: boolean;
  canPostSocial: boolean;
  canSubmitForms: boolean;
  costRisk: "none" | "low" | "medium" | "high";
  operatorFacing: boolean;
  operationsHubRecommended: boolean;
  description: string;
};

type RouteCatalogueInput = Omit<RouteCatalogueItem, "canPostSocial" | "canSubmitForms"> & Partial<Pick<RouteCatalogueItem, "canPostSocial" | "canSubmitForms">>;

export function route(item: RouteCatalogueInput): RouteCatalogueItem {
  return {
    canPostSocial: false,
    canSubmitForms: false,
    ...item,
  };
}
