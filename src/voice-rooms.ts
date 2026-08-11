export type DiscordVoiceRoomPermission =
  | "view_channel"
  | "connect"
  | "speak"
  | "stream"
  | "use_voice_activity"
  | "send_messages"
  | "embed_links"
  | "read_message_history"
  | "manage_channels"
  | "manage_roles"
  | "move_members";

export type DiscordVoiceRoomOverwriteTarget = Readonly<{
  type: "member" | "role";
  id: string;
}>;

export type DiscordVoiceRoomPermissionOverwrite = Readonly<{
  target: DiscordVoiceRoomOverwriteTarget;
  allow: readonly DiscordVoiceRoomPermission[];
  deny: readonly DiscordVoiceRoomPermission[];
}>;

export type DiscordVoiceRoomOperationReceipt = Readonly<{
  operationId: string;
  status: "applied";
  guildId: string;
  channelId: string;
}>;

export type DiscordVoiceRoomCreateInput = Readonly<{
  operationId: string;
  guildId: string;
  parentCategoryId: string;
  name: string;
  userLimit: number;
  permissionOverwrites: readonly DiscordVoiceRoomPermissionOverwrite[];
  auditReason: string;
  signal?: AbortSignal;
}>;

export type DiscordVoiceRoomMoveMemberInput = Readonly<{
  operationId: string;
  guildId: string;
  userId: string;
  channelId: string;
  auditReason: string;
  signal?: AbortSignal;
}>;

export type DiscordVoiceRoomUpdateInput = Readonly<{
  operationId: string;
  guildId: string;
  channelId: string;
  name?: string;
  userLimit?: number;
  auditReason: string;
  signal?: AbortSignal;
}>;

export type DiscordVoiceRoomUpsertOverwriteInput = Readonly<{
  operationId: string;
  guildId: string;
  channelId: string;
  overwrite: DiscordVoiceRoomPermissionOverwrite;
  auditReason: string;
  signal?: AbortSignal;
}>;

export type DiscordVoiceRoomDeleteOverwriteInput = Readonly<{
  operationId: string;
  guildId: string;
  channelId: string;
  target: DiscordVoiceRoomOverwriteTarget;
  auditReason: string;
  signal?: AbortSignal;
}>;

export type DiscordVoiceRoomDeleteInput = Readonly<{
  operationId: string;
  guildId: string;
  channelId: string;
  auditReason: string;
  signal?: AbortSignal;
}>;

/** Technical voice-channel mutations; product workflow is intentionally absent. */
export interface DiscordVoiceRoomPort {
  createRoom(
    input: DiscordVoiceRoomCreateInput,
  ): Promise<DiscordVoiceRoomOperationReceipt>;
  moveMember(
    input: DiscordVoiceRoomMoveMemberInput,
  ): Promise<DiscordVoiceRoomOperationReceipt>;
  updateRoom(
    input: DiscordVoiceRoomUpdateInput,
  ): Promise<DiscordVoiceRoomOperationReceipt>;
  upsertPermissionOverwrite(
    input: DiscordVoiceRoomUpsertOverwriteInput,
  ): Promise<DiscordVoiceRoomOperationReceipt>;
  deletePermissionOverwrite(
    input: DiscordVoiceRoomDeleteOverwriteInput,
  ): Promise<DiscordVoiceRoomOperationReceipt>;
  deleteRoom(
    input: DiscordVoiceRoomDeleteInput,
  ): Promise<DiscordVoiceRoomOperationReceipt>;
}
