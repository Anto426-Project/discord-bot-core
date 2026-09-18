import type { DiscordGuildRoleSnapshot } from "./guild-directory.js";

export type DiscordImageFormat = "png" | "jpg" | "webp";
export type DiscordImageSize = 512 | 1024 | 4096;

/**
 * Closed CDN projection. Every provider-supported format is materialized at
 * all supported sizes while the provider object is inside the adapter, so no
 * SDK object or callback crosses this boundary. Discord default avatars expose
 * only PNG; custom assets normally expose every declared format.
 */
export type DiscordImageAsset = Readonly<{
  urls: Readonly<
    Partial<Record<DiscordImageFormat, Readonly<Record<DiscordImageSize, string>>>>
  >;
}>;

export type DiscordUserProfile = Readonly<{
  id: string;
  username: string;
  displayName: string;
  tag: string;
  bot: boolean;
  createdAt: string;
  avatar: DiscordImageAsset;
  banner: DiscordImageAsset | null;
  accentColor: number | null;
}>;

export type DiscordMemberProfile = Readonly<{
  guildId: string;
  userId: string;
  displayName: string;
  nickname: string | null;
  joinedAt: string | null;
  roles: readonly DiscordGuildRoleSnapshot[];
}>;

export type DiscordGuildProfile = Readonly<{
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  shardId: number;
  memberCount: number;
  premiumTier: number;
  premiumSubscriptionCount: number;
  createdAt: string;
  rulesChannelId: string | null;
  icon: DiscordImageAsset | null;
  banner: DiscordImageAsset | null;
  splash: DiscordImageAsset | null;
}>;

export type DiscordProfileReadMode = "cache" | "cache_or_fetch" | "provider";

export type DiscordUserProfileReadInput = Readonly<{
  userId: string;
  mode?: DiscordProfileReadMode;
  signal?: AbortSignal;
}>;

export type DiscordMemberProfileReadInput = Readonly<{
  guildId: string;
  userId: string;
  mode?: DiscordProfileReadMode;
  signal?: AbortSignal;
}>;

export type DiscordGuildProfileReadInput = Readonly<{
  guildId: string;
  mode?: DiscordProfileReadMode;
  signal?: AbortSignal;
}>;

export interface DiscordProfileQueryPort {
  readUser(input: DiscordUserProfileReadInput): Promise<DiscordUserProfile | null>;
  readMember(input: DiscordMemberProfileReadInput): Promise<DiscordMemberProfile | null>;
  readGuild(input: DiscordGuildProfileReadInput): Promise<DiscordGuildProfile | null>;
}
