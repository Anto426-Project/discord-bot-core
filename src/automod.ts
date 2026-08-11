export type DiscordAutoModOperationReceipt = Readonly<{
  operationId: string;
  status: "applied";
}>;

export type DiscordBotAutoModDeleteMessageInput = Readonly<{
  operationId: string;
  guildId: string;
  channelId: string;
  messageId: string;
  signal?: AbortSignal;
}>;

export type DiscordBotAutoModTimeoutMemberInput = Readonly<{
  operationId: string;
  guildId: string;
  userId: string;
  durationSeconds: number;
  auditReason: string;
  signal?: AbortSignal;
}>;

export interface DiscordBotAutoModPort {
  deleteMessage(
    input: DiscordBotAutoModDeleteMessageInput,
  ): Promise<DiscordAutoModOperationReceipt>;
  timeoutMember(
    input: DiscordBotAutoModTimeoutMemberInput,
  ): Promise<DiscordAutoModOperationReceipt>;
}

export type DiscordNativeAutoModEventType = "message_send" | "member_update";
export type DiscordNativeAutoModKeywordPreset =
  | "profanity"
  | "sexual_content"
  | "slurs";

export type DiscordNativeAutoModTrigger =
  | Readonly<{
      type: "keyword" | "member_profile";
      keywordFilter: readonly string[];
      regexPatterns: readonly string[];
      allowList: readonly string[];
    }>
  | Readonly<{ type: "spam" }>
  | Readonly<{
      type: "keyword_preset";
      presets: readonly DiscordNativeAutoModKeywordPreset[];
      allowList: readonly string[];
    }>
  | Readonly<{
      type: "mention_spam";
      mentionTotalLimit: number;
      raidProtectionEnabled: boolean;
    }>;

export type DiscordNativeAutoModAction =
  | Readonly<{ type: "block_message"; customMessage?: string }>
  | Readonly<{ type: "send_alert"; channelId: string }>
  | Readonly<{ type: "timeout"; durationSeconds: number }>
  | Readonly<{ type: "block_member_interaction" }>;

export type DiscordNativeAutoModRulePlan = Readonly<{
  name: string;
  eventType: DiscordNativeAutoModEventType;
  trigger: DiscordNativeAutoModTrigger;
  actions: readonly DiscordNativeAutoModAction[];
  enabled: boolean;
  exemptRoleIds: readonly string[];
  exemptChannelIds: readonly string[];
}>;

export type DiscordNativeAutoModRuleSnapshot = Readonly<{
  providerRuleId: string;
  creatorUserId: string;
  managedByCurrentApplication: boolean;
  rule: DiscordNativeAutoModRulePlan;
}>;

export type DiscordNativeAutoModListInput = Readonly<{
  guildId: string;
  signal?: AbortSignal;
}>;

export type DiscordNativeAutoModReadInput = Readonly<{
  guildId: string;
  providerRuleId: string;
  signal?: AbortSignal;
}>;

export type DiscordNativeAutoModCreateInput = Readonly<{
  operationId: string;
  guildId: string;
  rule: DiscordNativeAutoModRulePlan;
  auditReason: string;
  signal?: AbortSignal;
}>;

export type DiscordNativeAutoModUpdateInput = DiscordNativeAutoModCreateInput &
  Readonly<{ providerRuleId: string }>;

export type DiscordNativeAutoModDeleteInput = Readonly<{
  operationId: string;
  guildId: string;
  providerRuleId: string;
  auditReason: string;
  signal?: AbortSignal;
}>;

export type DiscordNativeAutoModMutationReceipt = DiscordAutoModOperationReceipt &
  Readonly<{
    guildId: string;
    providerRuleId: string;
  }>;

/** Native provider CRUD only; reconciliation and rule ownership stay outside. */
export interface DiscordNativeAutoModPort {
  listRules(
    input: DiscordNativeAutoModListInput,
  ): Promise<readonly DiscordNativeAutoModRuleSnapshot[]>;
  readRule(
    input: DiscordNativeAutoModReadInput,
  ): Promise<DiscordNativeAutoModRuleSnapshot | null>;
  createRule(
    input: DiscordNativeAutoModCreateInput,
  ): Promise<DiscordNativeAutoModMutationReceipt>;
  updateRule(
    input: DiscordNativeAutoModUpdateInput,
  ): Promise<DiscordNativeAutoModMutationReceipt>;
  deleteRule(
    input: DiscordNativeAutoModDeleteInput,
  ): Promise<DiscordNativeAutoModMutationReceipt>;
}
