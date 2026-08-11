import type {
  DiscordGuildMemberSnapshot,
  DiscordGuildRoleSnapshot,
} from "./guild-directory.js";

export type DiscordGatewayGuildEvent = Readonly<{
  type: "guild_created" | "guild_deleted";
  guildId: string;
  name: string;
  preferredLocale: string;
  shardId: number;
  joinedAt: string | null;
  observedAt: string;
}>;

type DiscordGatewayMemberEventBase = Readonly<{
  guildId: string;
  userId: string;
  observedAt: string;
}>;

export type DiscordGatewayMemberEvent =
  | (DiscordGatewayMemberEventBase &
      Readonly<{
        type: "guild_member_added" | "guild_member_updated";
        member: DiscordGuildMemberSnapshot;
        roles: readonly DiscordGuildRoleSnapshot[];
      }>)
  | (DiscordGatewayMemberEventBase &
      Readonly<{
        type: "guild_member_removed";
        member: DiscordGuildMemberSnapshot | null;
        roles: readonly DiscordGuildRoleSnapshot[];
      }>);

export type DiscordGatewayVoiceStateChangedEvent = Readonly<{
  type: "voice_state_changed";
  guildId: string;
  userId: string;
  providerSessionId: string | null;
  previousChannelId: string | null;
  currentChannelId: string | null;
  observedAt: string;
}>;

/**
 * Deliberately excludes message content. The only content-derived datum is a
 * lowercase SHA-256 fingerprint of the core's NFKC canonical form.
 */
export type DiscordGatewayMessageCreatedEvent = Readonly<{
  type: "message_created";
  messageId: string;
  guildId: string;
  channelId: string;
  authorUserId: string;
  roleIds: readonly string[];
  createdAt: string;
  accountCreatedAt: string;
  automated: boolean;
  moderationExempt: boolean;
  contentFingerprint: string | null;
}>;

export type DiscordGatewayNativeAutoModAction =
  | "block_message"
  | "send_alert"
  | "timeout"
  | "block_member_interaction";

export type DiscordGatewayNativeAutoModExecutedEvent = Readonly<{
  type: "native_automod_executed";
  eventId: string;
  guildId: string;
  providerRuleId: string;
  actorUserId: string;
  channelId: string | null;
  messageId: string | null;
  action: DiscordGatewayNativeAutoModAction;
  observedAt: string;
}>;

export type DiscordGatewayEvent =
  | DiscordGatewayGuildEvent
  | DiscordGatewayMemberEvent
  | DiscordGatewayVoiceStateChangedEvent
  | DiscordGatewayMessageCreatedEvent
  | DiscordGatewayNativeAutoModExecutedEvent;

export type DiscordGatewayEventListener = (
  event: DiscordGatewayEvent,
) => void | Promise<void>;

/** Generation-scoped, provider-neutral gateway event stream. */
export interface DiscordGatewayEventPort {
  subscribe(listener: DiscordGatewayEventListener): () => void;
}
