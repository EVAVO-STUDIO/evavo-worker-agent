export const BUSINESS_RELATIONSHIP_CONTEXT_RESOLUTION_PLAN_CONTRACT = "business_relationship_context_resolution_plan_v2" as const;

export type RelationshipContextSource =
  | "gmail"
  | "calendar"
  | "operations_core"
  | "docs_suite"
  | "support_agent"
  | "brain_memory"
  | "identity_directory"
  | "human_review";

export type RelationshipContextResolutionItem = Readonly<{
  issue: string;
  source: RelationshipContextSource;
  purpose: string;
  blocking: boolean;
  evidenceRequired: boolean;
}>;

export type RelationshipContextResolutionPlan = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_CONTEXT_RESOLUTION_PLAN_CONTRACT;
  relationshipId: string;
  ready: boolean;
  items: readonly RelationshipContextResolutionItem[];
  orderedSources: readonly RelationshipContextSource[];
  blockingIssues: readonly string[];
}>;

function route(issue: string): RelationshipContextResolutionItem {
  const text = issue.toLowerCase();
  if (/^identity:|identity|sender|person|recipient/.test(text)) {
    return { issue, source: "identity_directory", purpose: "Resolve the exact person, address and relationship identity before external communication.", blocking: true, evidenceRequired: true };
  }
  if (/^gmail:|thread|email|communication|message/.test(text)) {
    return { issue, source: "gmail", purpose: "Read the canonical Gmail thread and derive the current live communication state.", blocking: true, evidenceRequired: true };
  }
  if (/^calendar:|calendar|meeting|availability|time slot|schedule/.test(text)) {
    return { issue, source: "calendar", purpose: "Check authoritative calendar availability before proposing or confirming a time.", blocking: true, evidenceRequired: true };
  }
  if (/^document:|document|attachment|artifact|version|file|controlling/.test(text)) {
    return { issue, source: "docs_suite", purpose: "Resolve the exact canonical document/version and content identity before claiming review or attaching it.", blocking: true, evidenceRequired: true };
  }
  if (/^operations:|operations core|project|scope|delivery|commercial|price|pricing|invoice|payment|contract|role|hiring/.test(text)) {
    return { issue, source: "operations_core", purpose: "Retrieve canonical project, commercial, hiring or operational truth rather than infer it from correspondence.", blocking: true, evidenceRequired: true };
  }
  if (/^support:|support|incident|ticket|service|complaint/.test(text)) {
    return { issue, source: "support_agent", purpose: "Retrieve current support/service state and relationship-risk context.", blocking: true, evidenceRequired: true };
  }
  if (/^memory:|history|prior|memory|previous|decision|preference/.test(text)) {
    return { issue, source: "brain_memory", purpose: "Retrieve relevant durable history, prior decisions and evidence-backed relationship memory.", blocking: false, evidenceRequired: true };
  }
  if (/conflict|contradict|disagree|uncertain/.test(text)) {
    return { issue, source: "human_review", purpose: "Resolve conflicting evidence explicitly when no single canonical source can settle it safely.", blocking: true, evidenceRequired: true };
  }
  return { issue, source: "brain_memory", purpose: "Retrieve additional evidence-backed context and determine the canonical owner before acting.", blocking: true, evidenceRequired: true };
}

const SOURCE_ORDER: readonly RelationshipContextSource[] = [
  "identity_directory",
  "gmail",
  "operations_core",
  "docs_suite",
  "support_agent",
  "calendar",
  "brain_memory",
  "human_review",
];

export function buildRelationshipContextResolutionPlan(input: Readonly<{
  relationshipId: string;
  missingContext?: readonly string[];
  conflicts?: readonly string[];
  mustVerify?: readonly string[];
}>): RelationshipContextResolutionPlan {
  const relationshipId = input.relationshipId.trim();
  if (!relationshipId) throw new Error("RELATIONSHIP_CONTEXT_PLAN_RELATIONSHIP_REQUIRED");
  const issues = [...new Set([...(input.missingContext ?? []), ...(input.conflicts ?? []), ...(input.mustVerify ?? [])].map((item) => item.trim()).filter(Boolean))];
  const items = issues.map(route);
  const sourceSet = new Set(items.map((item) => item.source));
  const orderedSources = SOURCE_ORDER.filter((source) => sourceSet.has(source));
  const blockingIssues = items.filter((item) => item.blocking).map((item) => item.issue);
  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_CONTEXT_RESOLUTION_PLAN_CONTRACT,
    relationshipId,
    ready: blockingIssues.length === 0,
    items: Object.freeze(items),
    orderedSources: Object.freeze(orderedSources),
    blockingIssues: Object.freeze(blockingIssues),
  });
}
