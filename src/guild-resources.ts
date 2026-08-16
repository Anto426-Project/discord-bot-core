import type {
  DiscordGuildMemberSnapshot,
  DiscordGuildRoleSnapshot,
} from "./guild-directory.js";

export type DiscordGuildChannelKind =
  | "text"
  | "announcement"
  | "forum"
  | "media"
  | "voice"
  | "stage_voice"
  | "category"
  | "thread"
  | "other";

export type DiscordGuildChannelSnapshot = Readonly<{
  guildId: string;
  id: string;
  name: string;
  kind: DiscordGuildChannelKind;
  parentId: string | null;
  textBased: boolean;
  voiceBased: boolean;
  agentCanView: boolean;
  agentCanSendMessages: boolean;
  agentCanEmbedLinks: boolean;
  agentCanAttachFiles: boolean;
}>;

export type DiscordGuildMemberReadInput = Readonly<{
  guildId: string;
  userId: string;
  signal?: AbortSignal;
  deadlineEpochMs?: number;
}>;

export type DiscordGuildRoleReadInput = Readonly<{
  guildId: string;
  roleId: string;
  signal?: AbortSignal;
  deadlineEpochMs?: number;
}>;

export type DiscordGuildChannelReadInput = Readonly<{
  guildId: string;
  channelId: string;
  signal?: AbortSignal;
  deadlineEpochMs?: number;
}>;

export type DiscordMemberRoleMutationInput = Readonly<{
  operationId: string;
  guildId: string;
  userId: string;
  roleId: string;
  auditReason: string;
  signal?: AbortSignal;
  deadlineEpochMs?: number;
}>;

export type DiscordMemberRoleMutationReceipt = Readonly<{
  operationId: string;
  status: "satisfied";
  action: "add" | "remove";
  guildId: string;
  userId: string;
  roleId: string;
}>;

/**
 * Live Discord guild facts and provider-idempotent single-role effects.
 * Product onboarding, welcome and automatic-role policy stay in the consumer.
 */
export interface DiscordGuildResourcePort {
  readGuildMember(
    input: DiscordGuildMemberReadInput,
  ): Promise<DiscordGuildMemberSnapshot | null>;
  readGuildRole(input: DiscordGuildRoleReadInput): Promise<DiscordGuildRoleSnapshot | null>;
  readGuildChannel(
    input: DiscordGuildChannelReadInput,
  ): Promise<DiscordGuildChannelSnapshot | null>;
  addRoleToMember(
    input: DiscordMemberRoleMutationInput,
  ): Promise<DiscordMemberRoleMutationReceipt>;
  removeRoleFromMember(
    input: DiscordMemberRoleMutationInput,
  ): Promise<DiscordMemberRoleMutationReceipt>;
}
