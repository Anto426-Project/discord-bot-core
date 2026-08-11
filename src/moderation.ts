export type DiscordModerationPermission =
  | "manage_messages"
  | "kick_members"
  | "ban_members";

export type DiscordModerationActorFacts = Readonly<{
  guildId: string;
  actorUserId: string;
  agentUserId: string;
  requiredPermission: DiscordModerationPermission;
  actorPresent: boolean;
  agentPresent: boolean;
  actorHasRequiredPermission: boolean;
  agentHasRequiredPermission: boolean;
}>;

export type DiscordModerationMemberFacts = DiscordModerationActorFacts &
  Readonly<{
    targetUserId: string;
    targetDisplayName: string | null;
    targetPresent: boolean;
    targetIsGuildOwner: boolean;
    targetIsActor: boolean;
    targetIsAgent: boolean;
    actorIsAboveTarget: boolean;
    agentIsAboveTarget: boolean;
  }>;

export type DiscordModerationActorFactsInput = Readonly<{
  guildId: string;
  actorUserId: string;
  requiredPermission: "kick_members" | "ban_members";
  signal?: AbortSignal;
}>;

export type DiscordModerationChannelFactsInput = Readonly<{
  guildId: string;
  channelId: string;
  actorUserId: string;
  signal?: AbortSignal;
}>;

export type DiscordModerationMemberFactsInput = Readonly<{
  guildId: string;
  actorUserId: string;
  targetUserId: string;
  requiredPermission: "kick_members" | "ban_members";
  signal?: AbortSignal;
}>;

export type DiscordModerationOperationReceipt = Readonly<{
  operationId: string;
  status: "applied";
}>;

export type DiscordMessageCleanupReceipt = DiscordModerationOperationReceipt &
  Readonly<{
    guildId: string;
    channelId: string;
    requestedCount: number;
    deletedCount: number;
    skippedCount: number;
  }>;

export type DiscordMemberModerationReceipt = DiscordModerationOperationReceipt &
  Readonly<{
    guildId: string;
    targetUserId: string;
    targetDisplayName: string;
  }>;

export type DiscordDeleteRecentMessagesInput = Readonly<{
  operationId: string;
  guildId: string;
  channelId: string;
  requestedCount: number;
  signal?: AbortSignal;
}>;

export type DiscordKickMemberInput = Readonly<{
  operationId: string;
  guildId: string;
  targetUserId: string;
  auditReason: string;
  signal?: AbortSignal;
}>;

export type DiscordBanMemberInput = DiscordKickMemberInput &
  Readonly<{
    deleteMessageSeconds: number;
  }>;

export type DiscordUnbanMemberInput = DiscordKickMemberInput;

/**
 * Technical Discord facts and effects only. Authorization, notices and all
 * product decisions belong to the consuming bot.
 */
export interface DiscordModerationPort {
  readActorFacts(
    input: DiscordModerationActorFactsInput,
  ): Promise<DiscordModerationActorFacts>;
  readChannelFacts(
    input: DiscordModerationChannelFactsInput,
  ): Promise<DiscordModerationActorFacts>;
  readMemberFacts(
    input: DiscordModerationMemberFactsInput,
  ): Promise<DiscordModerationMemberFacts>;
  deleteRecentMessages(
    input: DiscordDeleteRecentMessagesInput,
  ): Promise<DiscordMessageCleanupReceipt>;
  kickMember(input: DiscordKickMemberInput): Promise<DiscordMemberModerationReceipt>;
  banMember(input: DiscordBanMemberInput): Promise<DiscordMemberModerationReceipt>;
  unbanMember(input: DiscordUnbanMemberInput): Promise<DiscordMemberModerationReceipt>;
}
