export type BusinessAutopilotSafety = {
  readOnly: boolean;
  internalMetadataOnly: boolean;
  externalStateChange: boolean;
  callsAI: boolean;
  callsNetwork: boolean;
  canSendEmail: boolean;
  canPostSocial: boolean;
  canCommentSocial: boolean;
  canSubmitForms: boolean;
  canExecuteBrowserActions: boolean;
  canBuyAds: boolean;
  canMutateExternalSystems: boolean;
};

export type BusinessAutopilotExecutionLevel =
  | 'level_0_read_only_intelligence'
  | 'level_1_draft_only'
  | 'level_2_approval_required_execution'
  | 'level_3_rules_approved_internal_actions'
  | 'level_4_capped_campaign_mode'
  | 'level_5_broad_external_autonomy_blocked';

export const BUSINESS_AUTOPILOT_BLOCKED_EXTERNAL_ACTIONS = [
  'send_email',
  'post_social',
  'comment_social',
  'submit_form',
  'log_in',
  'buy_ads',
  'purchase',
  'book_meeting_with_external_party',
  'mutate_external_system',
  'execute_browser_action',
  'bypass_robots_policy',
  'scrape_private_or_login_content',
  'ignore_suppression',
  'ignore_unsubscribe',
] as const;

export const BUSINESS_AUTOPILOT_EXECUTION_LEVELS: BusinessAutopilotExecutionLevel[] = [
  'level_0_read_only_intelligence',
  'level_1_draft_only',
  'level_2_approval_required_execution',
  'level_3_rules_approved_internal_actions',
  'level_4_capped_campaign_mode',
  'level_5_broad_external_autonomy_blocked',
];

export function businessAutopilotReadSafety(): BusinessAutopilotSafety {
  return {
    readOnly: true,
    internalMetadataOnly: true,
    externalStateChange: false,
    callsAI: false,
    callsNetwork: false,
    canSendEmail: false,
    canPostSocial: false,
    canCommentSocial: false,
    canSubmitForms: false,
    canExecuteBrowserActions: false,
    canBuyAds: false,
    canMutateExternalSystems: false,
  };
}

export function businessAutopilotMetadataWriteSafety(): BusinessAutopilotSafety {
  return {
    readOnly: false,
    internalMetadataOnly: true,
    externalStateChange: false,
    callsAI: false,
    callsNetwork: false,
    canSendEmail: false,
    canPostSocial: false,
    canCommentSocial: false,
    canSubmitForms: false,
    canExecuteBrowserActions: false,
    canBuyAds: false,
    canMutateExternalSystems: false,
  };
}

export function assertBusinessAutopilotReadSafety(safety: BusinessAutopilotSafety): boolean {
  return safety.readOnly === true
    && safety.internalMetadataOnly === true
    && safety.externalStateChange === false
    && safety.callsAI === false
    && safety.callsNetwork === false
    && safety.canSendEmail === false
    && safety.canPostSocial === false
    && safety.canCommentSocial === false
    && safety.canSubmitForms === false
    && safety.canExecuteBrowserActions === false
    && safety.canBuyAds === false
    && safety.canMutateExternalSystems === false;
}

export function assertBusinessAutopilotMetadataWriteSafety(safety: BusinessAutopilotSafety): boolean {
  return safety.readOnly === false
    && safety.internalMetadataOnly === true
    && safety.externalStateChange === false
    && safety.callsAI === false
    && safety.callsNetwork === false
    && safety.canSendEmail === false
    && safety.canPostSocial === false
    && safety.canCommentSocial === false
    && safety.canSubmitForms === false
    && safety.canExecuteBrowserActions === false
    && safety.canBuyAds === false
    && safety.canMutateExternalSystems === false;
}

export function businessAutopilotActionBlocks() {
  return [...BUSINESS_AUTOPILOT_BLOCKED_EXTERNAL_ACTIONS];
}
