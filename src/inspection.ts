export type DiscordGuildInventoryEntry = Readonly<{
  id: string;
  name: string;
  shardId: number;
  memberCount: number;
}>;

export type DiscordGatewayInspectionSnapshot = Readonly<{
  connected: boolean;
  applicationId: string | null;
  agentUserId: string | null;
  communityCount: number;
  userCount: number;
  partitionCount: number;
  transportLatencyMilliseconds: number | null;
  gatewayLibraryVersion: string;
  channelCount: number;
  textChannelCount: number;
  voiceChannelCount: number;
  guilds: readonly DiscordGuildInventoryEntry[];
}>;

/**
 * Synchronous, cache-only view of the currently owned gateway generation.
 * A stopped generation is reported as disconnected with an empty inventory.
 */
export interface DiscordGatewayInspectionPort {
  capture(): DiscordGatewayInspectionSnapshot;
}
