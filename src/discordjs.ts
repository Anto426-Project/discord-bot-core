import {
  ActivityType,
  BaseInteraction,
  ChannelType,
  Client,
  DiscordAPIError,
  Events,
  GatewayIntentBits,
  HTTPError,
  MessageFlags,
  Partials,
  PermissionFlagsBits,
  REST,
  RateLimitError,
  Routes,
  version as discordJsVersion,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildMember,
  type Interaction,
  type RepliableInteraction,
  type Role,
  type User,
} from "discord.js";

import type { DiscordApplicationCommandBody } from "./command-model.js";
import {
  fingerprintDiscordChatInputCommand,
  type DiscordApplicationCommandsRestPort,
  type DiscordCommandPublicationScope,
  type DiscordRemoteApplicationCommand,
} from "./command-publisher.js";
import type {
  DiscordModalPlan,
  DiscordTextInputComponent,
} from "./components.js";
import {
  discordModal,
  discordTextInput,
} from "./components.js";
import type {
  DiscordChannelMessageDelivery,
  DiscordDeliveryReceipt,
  DiscordDirectMessageDelivery,
  DiscordMessageDeliveryPort,
} from "./delivery.js";
import { DiscordCoreError } from "./errors.js";
import type {
  DiscordGatewayIdentity,
  DiscordGatewayLifecycleEvent,
  DiscordGatewayLifecycleListener,
  DiscordGatewayRuntimePort,
} from "./gateway.js";
import type {
  DiscordGuildDirectoryPort,
  DiscordGuildMemberListInput,
  DiscordGuildMemberPage,
  DiscordGuildMemberSnapshot,
  DiscordGuildPermission,
  DiscordGuildRoleListInput,
  DiscordGuildRoleSnapshot,
} from "./guild-directory.js";
import { parseDiscordSnowflake } from "./identifiers.js";
import type {
  DiscordGatewayInspectionPort,
  DiscordGatewayInspectionSnapshot,
  DiscordGuildInventoryEntry,
} from "./inspection.js";
import type {
  DiscordChatInputInteraction,
  DiscordCommandOptionsPort,
  DiscordEditableInteractionMessagePlan,
  DiscordInteraction,
  DiscordInteractionBase,
  DiscordInteractionBot,
  DiscordInteractionGuild,
  DiscordInteractionListener,
  DiscordInteractionMessagePlan,
  DiscordInteractionResponder,
  DiscordInteractionUser,
  DiscordModalFieldsPort,
  DiscordResponseVisibility,
} from "./interactions.js";
import {
  createSafeDiscordMessage,
  encodeSafeDiscordActionRows,
  encodeSafeDiscordEmbeds,
} from "./payload.js";
import type {
  DiscordPresenceActivityType,
  DiscordPresencePlan,
  DiscordPresencePort,
  DiscordPresenceStatus,
} from "./presence.js";
import type {
  DiscordGuildProfile,
  DiscordGuildProfileReadInput,
  DiscordImageAsset,
  DiscordImageFormat,
  DiscordImageSize,
  DiscordMemberProfile,
  DiscordMemberProfileReadInput,
  DiscordProfileQueryPort,
  DiscordProfileReadMode,
  DiscordUserProfile,
  DiscordUserProfileReadInput,
} from "./profiles.js";

export type DiscordPrivilegedGatewayIntent =
  | "GuildMembers"
  | "GuildPresences"
  | "MessageContent";

export const DISCORD_GATEWAY_INTENTS = [
  "Guilds",
  "GuildMembers",
  "GuildModeration",
  "GuildExpressions",
  "GuildIntegrations",
  "GuildWebhooks",
  "GuildInvites",
  "GuildVoiceStates",
  "GuildPresences",
  "GuildMessages",
  "GuildMessageReactions",
  "GuildMessageTyping",
  "DirectMessages",
  "DirectMessageReactions",
  "DirectMessageTyping",
  "MessageContent",
  "GuildScheduledEvents",
  "AutoModerationConfiguration",
  "AutoModerationExecution",
  "GuildMessagePolls",
  "DirectMessagePolls",
] as const;

export type DiscordGatewayIntent = (typeof DISCORD_GATEWAY_INTENTS)[number];

export type DiscordGatewayPartial =
  | "channel"
  | "guild_member"
  | "guild_scheduled_event"
  | "message"
  | "reaction"
  | "soundboard_sound"
  | "thread_member"
  | "user";

const PRIVILEGED_INTENTS = new Set<DiscordGatewayIntent>([
  "GuildMembers",
  "GuildPresences",
  "MessageContent",
]);

const INTENT_BITS: Readonly<Record<DiscordGatewayIntent, number>> = Object.freeze({
  Guilds: GatewayIntentBits.Guilds,
  GuildMembers: GatewayIntentBits.GuildMembers,
  GuildModeration: GatewayIntentBits.GuildModeration,
  GuildExpressions: GatewayIntentBits.GuildExpressions,
  GuildIntegrations: GatewayIntentBits.GuildIntegrations,
  GuildWebhooks: GatewayIntentBits.GuildWebhooks,
  GuildInvites: GatewayIntentBits.GuildInvites,
  GuildVoiceStates: GatewayIntentBits.GuildVoiceStates,
  GuildPresences: GatewayIntentBits.GuildPresences,
  GuildMessages: GatewayIntentBits.GuildMessages,
  GuildMessageReactions: GatewayIntentBits.GuildMessageReactions,
  GuildMessageTyping: GatewayIntentBits.GuildMessageTyping,
  DirectMessages: GatewayIntentBits.DirectMessages,
  DirectMessageReactions: GatewayIntentBits.DirectMessageReactions,
  DirectMessageTyping: GatewayIntentBits.DirectMessageTyping,
  MessageContent: GatewayIntentBits.MessageContent,
  GuildScheduledEvents: GatewayIntentBits.GuildScheduledEvents,
  AutoModerationConfiguration: GatewayIntentBits.AutoModerationConfiguration,
  AutoModerationExecution: GatewayIntentBits.AutoModerationExecution,
  GuildMessagePolls: GatewayIntentBits.GuildMessagePolls,
  DirectMessagePolls: GatewayIntentBits.DirectMessagePolls,
});

const PARTIALS: Readonly<Record<DiscordGatewayPartial, number>> = Object.freeze({
  channel: Partials.Channel,
  guild_member: Partials.GuildMember,
  message: Partials.Message,
  reaction: Partials.Reaction,
  user: Partials.User,
  guild_scheduled_event: Partials.GuildScheduledEvent,
  thread_member: Partials.ThreadMember,
  soundboard_sound: Partials.SoundboardSound,
});

export interface NodeDiscordGatewayOptions {
  readonly botToken: string;
  readonly intents: readonly DiscordGatewayIntent[];
  readonly acknowledgedPrivilegedIntents?: readonly DiscordPrivilegedGatewayIntent[];
  readonly partials?: readonly DiscordGatewayPartial[];
  readonly closeTimeoutMs?: number;
  readonly waitGuildTimeoutMs?: number;
  readonly startupTimeoutMs?: number;
  readonly listenerTimeoutMs?: number;
  readonly queryTimeoutMs?: number;
  readonly maximumConcurrentQueries?: number;
}

type NodeDiscordClientOptions = Readonly<{
  intents: readonly DiscordGatewayIntent[];
  acknowledgedPrivilegedIntents?: readonly DiscordPrivilegedGatewayIntent[];
  partials?: readonly DiscordGatewayPartial[];
  closeTimeoutMs?: number;
  waitGuildTimeoutMs?: number;
}>;

const boundedInteger = (
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  label: string,
): number => {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < minimum || resolved > maximum) {
    throw new RangeError(`${label} must be an integer from ${minimum} to ${maximum}.`);
  }
  return resolved;
};

const isAbortRequested = (signal: AbortSignal | undefined): boolean => signal?.aborted === true;

/**
 * Creates the private provider client with closed mention defaults. Privileged gateway
 * intents must be acknowledged individually by the owning product; the core
 * never silently enables a privileged profile for a smaller bot.
 */
const createClient = (options: NodeDiscordClientOptions): Client => {
  if (options.intents.length < 1 || options.intents.length > 32) {
    throw new RangeError("Discord gateway intent profile must contain from 1 to 32 intents.");
  }
  const acknowledged = new Set(options.acknowledgedPrivilegedIntents ?? []);
  const unique = new Set<DiscordGatewayIntent>();
  const intents: number[] = [];
  for (const intent of options.intents) {
    if (unique.has(intent)) {
      throw new TypeError("Discord gateway intent profile cannot contain duplicates.");
    }
    const bit = INTENT_BITS[intent];
    if (PRIVILEGED_INTENTS.has(intent) && !acknowledged.has(intent as DiscordPrivilegedGatewayIntent)) {
      throw new DiscordCoreError(
        "DISCORD_INVALID_INPUT",
        "A privileged Discord gateway intent was not explicitly acknowledged.",
        false,
      );
    }
    unique.add(intent);
    intents.push(bit);
  }
  for (const intent of acknowledged) {
    if (!unique.has(intent)) {
      throw new DiscordCoreError(
        "DISCORD_INVALID_INPUT",
        "A privileged intent acknowledgement does not match the configured profile.",
        false,
      );
    }
  }
  const partials = options.partials?.map((partial) => PARTIALS[partial]);
  return new Client({
    intents,
    allowedMentions: { parse: [], users: [], roles: [], repliedUser: false },
    enforceNonce: true,
    failIfNotExists: false,
    closeTimeout: boundedInteger(options.closeTimeoutMs, 5_000, 1_000, 30_000, "closeTimeoutMs"),
    waitGuildTimeout: boundedInteger(
      options.waitGuildTimeoutMs,
      15_000,
      1_000,
      60_000,
      "waitGuildTimeoutMs",
    ),
    ...(partials === undefined ? {} : { partials: Object.freeze(partials) }),
  });
};

const boundedDataArray = <T>(
  value: readonly T[],
  minimum: number,
  maximum: number,
  label: string,
): readonly T[] => {
  if (
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    value.length < minimum ||
    value.length > maximum
  ) {
    throw new DiscordCoreError("DISCORD_PAYLOAD_REJECTED", `${label} is invalid.`, false);
  }
  const result: T[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new DiscordCoreError(
        "DISCORD_PAYLOAD_REJECTED",
        `${label} must be a dense data array.`,
        false,
      );
    }
    result.push(descriptor.value as T);
  }
  return Object.freeze(result);
};

const MAXIMUM_CACHED_GUILDS = 100_000;
const MAXIMUM_GUILD_ROLES = 500;
const MAXIMUM_MEMBER_PAGE_SIZE = 1_000;
const MAXIMUM_MEMBER_ROLE_IDS = 500;
const MAXIMUM_GUILD_MEMBERS = 100_000_000;

const responseBoundedInteger = (
  value: unknown,
  minimum: number,
  maximum: number,
  label: string,
): number => {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", `${label} is invalid.`, false);
  }
  return value as number;
};

const responseBoolean = (value: unknown, label: string): boolean => {
  if (typeof value !== "boolean") {
    throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", `${label} is invalid.`, false);
  }
  return value;
};

const responseSnowflake = (value: unknown, label: string): string => {
  if (typeof value !== "string") {
    throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", `${label} is invalid.`, false);
  }
  try {
    return parseDiscordSnowflake(value, label);
  } catch {
    throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", `${label} is invalid.`, false);
  }
};

const responseTextValue = (
  value: unknown,
  minimum: number,
  maximum: number,
  label: string,
): string => {
  if (
    typeof value !== "string" ||
    value.length < minimum ||
    value.length > maximum ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  ) {
    throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", `${label} is invalid.`, false);
  }
  return value;
};

const responseNullableTextValue = (
  value: unknown,
  maximum: number,
  label: string,
): string | null =>
  value === null
    ? null
    : responseTextValue(value, 0, maximum, label);

const responseTimestamp = (value: unknown, label: string): string => {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", `${label} is invalid.`, false);
  }
  const timestamp = value.toISOString();
  if (Date.parse(timestamp) !== value.getTime()) {
    throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", `${label} is invalid.`, false);
  }
  return timestamp;
};

const responseNullableTimestamp = (value: unknown, label: string): string | null =>
  value === null ? null : responseTimestamp(value, label);

const IMAGE_FORMATS = Object.freeze([
  "png",
  "jpg",
  "webp",
] as const satisfies readonly DiscordImageFormat[]);
const IMAGE_SIZES = Object.freeze([
  512,
  1_024,
  4_096,
] as const satisfies readonly DiscordImageSize[]);
const DISCORD_ASSET_HOSTS = new Set(["cdn.discordapp.com", "media.discordapp.net"]);

const responseAssetUrl = (
  value: unknown,
  format: DiscordImageFormat,
  size: DiscordImageSize,
): string => {
  if (typeof value !== "string" || value.length < 1 || value.length > 2_048) {
    throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord asset URL is invalid.", false);
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord asset URL is invalid.", false);
  }
  if (
    parsed.protocol !== "https:" ||
    !DISCORD_ASSET_HOSTS.has(parsed.hostname) ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.port !== "" ||
    parsed.hash !== "" ||
    !parsed.pathname.toLowerCase().endsWith(`.${format}`) ||
    parsed.searchParams.get("size") !== String(size) ||
    [...parsed.searchParams.keys()].some((key) => key !== "size")
  ) {
    throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord asset URL is invalid.", false);
  }
  return parsed.toString();
};

const materializeImageAsset = (
  render: (format: DiscordImageFormat, size: DiscordImageSize) => string | null,
): DiscordImageAsset | null => {
  const urls: Partial<Record<
    DiscordImageFormat,
    Readonly<Record<DiscordImageSize, string>>
  >> = {};
  let present: boolean | null = null;
  for (const format of IMAGE_FORMATS) {
    const sizes = {} as Record<DiscordImageSize, string>;
    for (const size of IMAGE_SIZES) {
      const rendered = render(format, size);
      const hasValue = rendered !== null;
      present ??= hasValue;
      if (present !== hasValue) {
        throw new DiscordCoreError(
          "DISCORD_RESPONSE_INVALID",
          "Discord asset variants are inconsistent.",
          false,
        );
      }
      if (rendered !== null) sizes[size] = responseAssetUrl(rendered, format, size);
    }
    if (present === true) urls[format] = Object.freeze(sizes);
  }
  return present === true
    ? Object.freeze({ urls: Object.freeze(urls) })
    : null;
};

const materializeDefaultUserImageAsset = (value: unknown): DiscordImageAsset => {
  if (typeof value !== "string" || value.length < 1 || value.length > 2_048) {
    throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord asset URL is invalid.", false);
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord asset URL is invalid.", false);
  }
  if (
    parsed.protocol !== "https:" ||
    !DISCORD_ASSET_HOSTS.has(parsed.hostname) ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.port !== "" ||
    parsed.hash !== "" ||
    !/^\/embed\/avatars\/[0-9]+\.png$/u.test(parsed.pathname) ||
    [...parsed.searchParams.keys()].some((key) => key !== "size")
  ) {
    throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord asset URL is invalid.", false);
  }
  const sizes = {} as Record<DiscordImageSize, string>;
  for (const size of IMAGE_SIZES) {
    const rendered = new URL(parsed);
    rendered.searchParams.set("size", String(size));
    sizes[size] = responseAssetUrl(rendered.toString(), "png", size);
  }
  return Object.freeze({
    urls: Object.freeze({ png: Object.freeze(sizes) }),
  });
};

const userImageAsset = (user: User): DiscordImageAsset => {
  if (user.avatar === null) {
    return materializeDefaultUserImageAsset(user.defaultAvatarURL);
  }
  const asset = materializeImageAsset((format, size) =>
    user.displayAvatarURL({ extension: format, size, forceStatic: true }),
  );
  if (asset === null) {
    throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord user avatar is unavailable.", false);
  }
  return asset;
};

const GUILD_PERMISSION_FLAGS = Object.freeze([
  ["administrator", PermissionFlagsBits.Administrator],
  ["manage_guild", PermissionFlagsBits.ManageGuild],
  ["manage_roles", PermissionFlagsBits.ManageRoles],
  ["moderate_members", PermissionFlagsBits.ModerateMembers],
  ["ban_members", PermissionFlagsBits.BanMembers],
  ["kick_members", PermissionFlagsBits.KickMembers],
] as const satisfies readonly (readonly [DiscordGuildPermission, bigint])[]);

const roleSnapshot = (role: Role, expectedGuildId: string): DiscordGuildRoleSnapshot => {
  const guildId = responseSnowflake(role.guild.id, "Discord role guild id");
  if (guildId !== expectedGuildId) {
    throw new DiscordCoreError(
      "DISCORD_RESPONSE_INVALID",
      "Discord role belongs to another guild.",
      false,
    );
  }
  const permissions: DiscordGuildPermission[] = [];
  for (const [permission, flag] of GUILD_PERMISSION_FLAGS) {
    if (role.permissions.has(flag)) permissions.push(permission);
  }
  const id = responseSnowflake(role.id, "Discord role id");
  return Object.freeze({
    guildId,
    id,
    name: responseTextValue(role.name, 1, 100, "Discord role name"),
    colorValue: responseBoundedInteger(role.color, 0, 0xff_ff_ff, "Discord role color"),
    position: responseBoundedInteger(role.position, 0, MAXIMUM_GUILD_ROLES, "Discord role position"),
    managed: responseBoolean(role.managed, "Discord role managed flag"),
    everyone: id === guildId,
    editable: responseBoolean(role.editable, "Discord role editable flag"),
    permissions: Object.freeze(permissions),
  });
};

const memberRoleIds = (member: GuildMember, expectedGuildId: string): readonly string[] => {
  if (member.guild.id !== expectedGuildId) {
    throw new DiscordCoreError(
      "DISCORD_RESPONSE_INVALID",
      "Discord member role collection is invalid.",
      false,
    );
  }
  if (member.roles.cache.size > MAXIMUM_MEMBER_ROLE_IDS) {
    throw new DiscordCoreError(
      "DISCORD_RESPONSE_TOO_LARGE",
      "Discord member role collection exceeds its limit.",
      false,
    );
  }
  const ids: string[] = [];
  const unique = new Set<string>();
  for (const [cacheId, role] of member.roles.cache) {
    const id = responseSnowflake(role.id, "Discord member role id");
    const guildId = responseSnowflake(role.guild.id, "Discord member role guild id");
    if (cacheId !== id || guildId !== expectedGuildId || unique.has(id)) {
      throw new DiscordCoreError(
        "DISCORD_RESPONSE_INVALID",
        "Discord member role collection is inconsistent.",
        false,
      );
    }
    unique.add(id);
    ids.push(id);
  }
  ids.sort((left, right) => left.localeCompare(right, "en"));
  return Object.freeze(ids);
};

const memberSnapshot = (
  member: GuildMember,
  expectedGuildId: string,
): DiscordGuildMemberSnapshot => {
  const guildId = responseSnowflake(member.guild.id, "Discord member guild id");
  if (guildId !== expectedGuildId) {
    throw new DiscordCoreError(
      "DISCORD_RESPONSE_INVALID",
      "Discord member belongs to another guild.",
      false,
    );
  }
  return Object.freeze({
    guildId,
    userId: responseSnowflake(member.id, "Discord member user id"),
    username: responseTextValue(member.user.username, 1, 80, "Discord member username"),
    displayName: responseTextValue(member.displayName, 1, 128, "Discord member display name"),
    avatarHash: responseNullableTextValue(member.user.avatar, 256, "Discord member avatar hash"),
    nickname: responseNullableTextValue(member.nickname, 128, "Discord member nickname"),
    joinedAt: responseNullableTimestamp(member.joinedAt, "Discord member join timestamp"),
    bot: responseBoolean(member.user.bot, "Discord member bot flag"),
    roleIds: memberRoleIds(member, guildId),
  });
};

const inventoryEntry = (guild: Guild): DiscordGuildInventoryEntry =>
  Object.freeze({
    id: responseSnowflake(guild.id, "Discord guild id"),
    name: responseTextValue(guild.name, 1, 100, "Discord guild name"),
    shardId: responseBoundedInteger(guild.shardId, 0, 4_095, "Discord guild shard id"),
    memberCount: responseBoundedInteger(
      guild.memberCount,
      0,
      MAXIMUM_GUILD_MEMBERS,
      "Discord guild member count",
    ),
  });

const userProfile = (user: User): DiscordUserProfile =>
  Object.freeze({
    id: responseSnowflake(user.id, "Discord user id"),
    username: responseTextValue(user.username, 1, 80, "Discord username"),
    displayName: responseTextValue(user.displayName, 1, 128, "Discord user display name"),
    tag: responseTextValue(user.tag, 1, 128, "Discord user tag"),
    bot: responseBoolean(user.bot, "Discord user bot flag"),
    createdAt: responseTimestamp(user.createdAt, "Discord user creation timestamp"),
    avatar: userImageAsset(user),
  });

const memberProfile = (member: GuildMember, expectedGuildId: string): DiscordMemberProfile => {
  const snapshot = memberSnapshot(member, expectedGuildId);
  if (member.roles.cache.size > MAXIMUM_GUILD_ROLES) {
    throw new DiscordCoreError(
      "DISCORD_RESPONSE_TOO_LARGE",
      "Discord member role profile exceeds its limit.",
      false,
    );
  }
  const roles = [...member.roles.cache.values()]
    .map((role) => roleSnapshot(role, snapshot.guildId))
    .sort((left, right) => left.id.localeCompare(right.id, "en"));
  if (
    roles.length !== snapshot.roleIds.length ||
    roles.some((role, index) => role.id !== snapshot.roleIds[index])
  ) {
    throw new DiscordCoreError(
      "DISCORD_RESPONSE_INVALID",
      "Discord member role profile is inconsistent.",
      false,
    );
  }
  return Object.freeze({
    guildId: snapshot.guildId,
    userId: snapshot.userId,
    displayName: snapshot.displayName,
    nickname: snapshot.nickname,
    joinedAt: snapshot.joinedAt,
    roles: Object.freeze(roles),
  });
};

const guildProfile = (guild: Guild): DiscordGuildProfile => {
  const inventory = inventoryEntry(guild);
  return Object.freeze({
    ...inventory,
    ownerId: responseSnowflake(guild.ownerId, "Discord guild owner id"),
    description: responseNullableTextValue(guild.description, 4_096, "Discord guild description"),
    premiumTier: responseBoundedInteger(guild.premiumTier, 0, 3, "Discord guild premium tier"),
    premiumSubscriptionCount: responseBoundedInteger(
      guild.premiumSubscriptionCount ?? 0,
      0,
      MAXIMUM_GUILD_MEMBERS,
      "Discord guild premium subscription count",
    ),
    createdAt: responseTimestamp(guild.createdAt, "Discord guild creation timestamp"),
    icon: materializeImageAsset((format, size) =>
      guild.iconURL({ extension: format, size, forceStatic: true }),
    ),
    banner: materializeImageAsset((format, size) =>
      guild.bannerURL({ extension: format, size, forceStatic: true }),
    ),
    splash: materializeImageAsset((format, size) =>
      guild.splashURL({ extension: format, size, forceStatic: true }),
    ),
  });
};

const PRESENCE_ACTIVITY_TYPES: Readonly<Record<DiscordPresenceActivityType, ActivityType>> =
  Object.freeze({
    playing: ActivityType.Playing,
    listening: ActivityType.Listening,
    watching: ActivityType.Watching,
    streaming: ActivityType.Streaming,
    competing: ActivityType.Competing,
  });

const PRESENCE_STATUSES = new Set<DiscordPresenceStatus>([
  "online",
  "idle",
  "dnd",
  "invisible",
]);

const TEXT_CHANNEL_TYPES = new Set<ChannelType>([
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildForum,
  ChannelType.GuildMedia,
]);

const VOICE_CHANNEL_TYPES = new Set<ChannelType>([
  ChannelType.GuildVoice,
  ChannelType.GuildStageVoice,
]);

const isProviderNotFoundError = (error: unknown): boolean => {
  if (error instanceof DiscordAPIError) {
    return error.status === 404 || error.code === 10_004 || error.code === 10_007 || error.code === 10_013;
  }
  if (error === null || typeof error !== "object") return false;
  const status = Reflect.get(error, "status");
  const code = Reflect.get(error, "code");
  return status === 404 || code === 10_004 || code === 10_007 || code === 10_013;
};

const profileReadMode = (value: unknown): DiscordProfileReadMode => {
  const resolved = value ?? "cache_or_fetch";
  if (resolved !== "cache" && resolved !== "cache_or_fetch" && resolved !== "provider") {
    throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Discord profile read mode is invalid.", false);
  }
  return resolved;
};

const inputPageLimit = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > MAXIMUM_MEMBER_PAGE_SIZE) {
    throw new DiscordCoreError(
      "DISCORD_INVALID_INPUT",
      `Discord member page limit must be an integer from 1 to ${MAXIMUM_MEMBER_PAGE_SIZE}.`,
      false,
    );
  }
  return value as number;
};

const inputDataProperty = (
  input: unknown,
  key: string,
  label: string,
  optional = false,
): unknown => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new DiscordCoreError("DISCORD_INVALID_INPUT", `${label} is invalid.`, false);
  }
  const descriptor = Object.getOwnPropertyDescriptor(input, key);
  if (descriptor === undefined) {
    if (optional) return undefined;
    throw new DiscordCoreError("DISCORD_INVALID_INPUT", `${label} is invalid.`, false);
  }
  if (!("value" in descriptor)) {
    throw new DiscordCoreError("DISCORD_INVALID_INPUT", `${label} is invalid.`, false);
  }
  return descriptor.value;
};

const inputSnowflake = (value: unknown, label: string): string => {
  if (typeof value !== "string") {
    throw new DiscordCoreError("DISCORD_INVALID_INPUT", `${label} is invalid.`, false);
  }
  return parseDiscordSnowflake(value, label);
};

const inputAbortSignal = (value: unknown, label: string): AbortSignal | undefined => {
  if (value === undefined) return undefined;
  if (!(value instanceof AbortSignal)) {
    throw new DiscordCoreError("DISCORD_INVALID_INPUT", `${label} is invalid.`, false);
  }
  return value;
};

const encodeTextInput = (
  component: DiscordTextInputComponent,
): Readonly<Record<string, unknown>> =>
  Object.freeze({
    type: 4,
    custom_id: component.customId,
    label: component.label,
    style: component.style === "short" ? 1 : 2,
    required: component.required,
    ...(component.minimumLength === undefined ? {} : { min_length: component.minimumLength }),
    ...(component.maximumLength === undefined ? {} : { max_length: component.maximumLength }),
    ...(component.placeholder === undefined ? {} : { placeholder: component.placeholder }),
    ...(component.value === undefined ? {} : { value: component.value }),
  });

const encodeModal = (modal: DiscordModalPlan): Readonly<Record<string, unknown>> => {
  const sourceRows = boundedDataArray(modal.rows, 1, 5, "Discord modal rows");
  const safeModal = discordModal({
    customId: modal.customId,
    title: modal.title,
    inputs: sourceRows.map((row) => discordTextInput(row.component)),
  });
  return Object.freeze({
    custom_id: safeModal.customId,
    title: safeModal.title,
    components: safeModal.rows.map((row) =>
      Object.freeze({ type: 1, components: Object.freeze([encodeTextInput(row.component)]) }),
    ),
  });
};

const encodeInteractionMessage = (
  plan: DiscordInteractionMessagePlan | DiscordEditableInteractionMessagePlan,
  allowVisibility: boolean,
): Readonly<Record<string, unknown>> => {
  if (
    plan.content !== undefined &&
    (typeof plan.content !== "string" || plan.content.length < 1 || plan.content.length > 2_000)
  ) {
    throw new DiscordCoreError(
      "DISCORD_PAYLOAD_REJECTED",
      "Discord interaction content must contain between 1 and 2000 characters.",
      false,
    );
  }
  const embeds = encodeSafeDiscordEmbeds(plan.embeds);
  const components = encodeSafeDiscordActionRows(plan.components);
  if (plan.content === undefined && embeds.length === 0 && (components?.length ?? 0) === 0) {
    throw new DiscordCoreError("DISCORD_PAYLOAD_REJECTED", "Discord response is empty.", false);
  }
  const visibility = "visibility" in plan ? plan.visibility : undefined;
  if (visibility !== undefined && visibility !== "public" && visibility !== "ephemeral") {
    throw new DiscordCoreError(
      "DISCORD_PAYLOAD_REJECTED",
      "Discord response visibility is invalid.",
      false,
    );
  }
  if (!allowVisibility && visibility !== undefined) {
    throw new DiscordCoreError(
      "DISCORD_PAYLOAD_REJECTED",
      "Discord editable response cannot change visibility.",
      false,
    );
  }
  return Object.freeze({
    ...(plan.content === undefined ? {} : { content: plan.content }),
    ...(embeds.length === 0 ? {} : { embeds }),
    ...(components === undefined ? {} : { components }),
    allowed_mentions: Object.freeze({
      parse: Object.freeze([]),
      users: Object.freeze([]),
      roles: Object.freeze([]),
      replied_user: false,
    }),
    ...(visibility === "ephemeral" ? { flags: MessageFlags.Ephemeral } : {}),
  });
};

class NodeDiscordInteractionResponder implements DiscordInteractionResponder {
  readonly #interaction: RepliableInteraction;

  public constructor(interaction: RepliableInteraction) {
    this.#interaction = interaction;
  }

  public get replied(): boolean {
    return this.#interaction.replied;
  }

  public get deferred(): boolean {
    return this.#interaction.deferred;
  }

  public async reply(plan: DiscordInteractionMessagePlan): Promise<void> {
    await this.#perform(() =>
      this.#interaction.reply(encodeInteractionMessage(plan, true) as never),
    );
  }

  public async deferReply(visibility: DiscordResponseVisibility = "public"): Promise<void> {
    await this.#perform(() =>
      this.#interaction.deferReply(
        visibility === "ephemeral" ? { flags: MessageFlags.Ephemeral } : {},
      ),
    );
  }

  public async editReply(plan: DiscordEditableInteractionMessagePlan): Promise<void> {
    await this.#perform(() =>
      this.#interaction.editReply(encodeInteractionMessage(plan, false) as never),
    );
  }

  public async followUp(plan: DiscordInteractionMessagePlan): Promise<void> {
    await this.#perform(() =>
      this.#interaction.followUp(encodeInteractionMessage(plan, true) as never),
    );
  }

  public async deferUpdate(): Promise<void> {
    const interaction = this.#interaction;
    if (!interaction.isMessageComponent() && !interaction.isModalSubmit()) {
      throw new DiscordCoreError(
        "DISCORD_INVALID_INPUT",
        "This Discord interaction cannot defer a component update.",
        false,
      );
    }
    await this.#perform(() => interaction.deferUpdate());
  }

  public async update(plan: DiscordEditableInteractionMessagePlan): Promise<void> {
    const interaction = this.#interaction;
    if (!interaction.isMessageComponent()) {
      throw new DiscordCoreError(
        "DISCORD_INVALID_INPUT",
        "This Discord interaction cannot update its source message.",
        false,
      );
    }
    await this.#perform(() =>
      interaction.update(encodeInteractionMessage(plan, false) as never),
    );
  }

  public async showModal(modal: DiscordModalPlan): Promise<void> {
    const interaction = this.#interaction;
    if (!interaction.isCommand() && !interaction.isMessageComponent()) {
      throw new DiscordCoreError(
        "DISCORD_INVALID_INPUT",
        "This Discord interaction cannot open a modal.",
        false,
      );
    }
    await this.#perform(() => interaction.showModal(encodeModal(modal) as never));
  }

  async #perform(operation: () => Promise<unknown>): Promise<void> {
    try {
      await operation();
    } catch (error: unknown) {
      // DiscordAPIError includes the provider URL and request body. Interaction
      // URLs contain a bearer-equivalent interaction token, so the raw SDK
      // error must never cross the adapter boundary.
      throw providerFailure(error);
    }
  }
}

const interactionUser = (interaction: RepliableInteraction): DiscordInteractionUser =>
  Object.freeze({
    id: parseDiscordSnowflake(interaction.user.id, "Discord interaction user id"),
    username: interaction.user.username,
    globalName: interaction.user.globalName,
    avatarUrl: interaction.user.displayAvatarURL(),
  });

const interactionGuild = (interaction: RepliableInteraction): DiscordInteractionGuild | null =>
  interaction.guild === null
    ? null
    : Object.freeze({
        id: parseDiscordSnowflake(interaction.guild.id, "Discord interaction guild id"),
        name: interaction.guild.name,
        iconUrl: interaction.guild.iconURL(),
      });

const interactionBot = (interaction: RepliableInteraction): DiscordInteractionBot => {
  const bot = interaction.client.user;
  if (bot === null) {
    throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord bot identity is unavailable.", false);
  }
  return Object.freeze({
    id: parseDiscordSnowflake(bot.id, "Discord bot user id"),
    username: bot.username,
    globalName: bot.globalName,
    avatarUrl: bot.displayAvatarURL(),
  });
};

const interactionBase = (interaction: RepliableInteraction): DiscordInteractionBase =>
  Object.freeze({
    id: parseDiscordSnowflake(interaction.id, "Discord interaction id"),
    locale: interaction.locale,
    channelId:
      interaction.channelId === null
        ? null
        : parseDiscordSnowflake(interaction.channelId, "Discord interaction channel id"),
    user: interactionUser(interaction),
    guild: interactionGuild(interaction),
    bot: interactionBot(interaction),
    createdAt: interaction.createdAt.toISOString(),
    responder: new NodeDiscordInteractionResponder(interaction),
  });

const commandOptions = (interaction: ChatInputCommandInteraction): DiscordCommandOptionsPort =>
  Object.freeze({
    getBoolean: (name: string, required?: boolean) => interaction.options.getBoolean(name, required),
    getUser: (name: string, required?: boolean) => {
      const user = interaction.options.getUser(name, required);
      return user === null
        ? null
        : Object.freeze({
            id: parseDiscordSnowflake(user.id, "Discord option user id"),
            username: user.username,
            globalName: user.globalName,
            avatarUrl: user.displayAvatarURL(),
          });
    },
    getSubcommand: (required?: boolean) =>
      required === undefined
        ? interaction.options.getSubcommand()
        : interaction.options.getSubcommand(required),
    getString: (name: string, required?: boolean) => interaction.options.getString(name, required),
    getInteger: (name: string, required?: boolean) => interaction.options.getInteger(name, required),
    getNumber: (name: string, required?: boolean) => interaction.options.getNumber(name, required),
    getChannelId: (name: string, required?: boolean) =>
      interaction.options.getChannel(name, required)?.id ?? null,
    getRoleId: (name: string, required?: boolean) =>
      interaction.options.getRole(name, required)?.id ?? null,
  });

const normalizeInteraction = (interaction: Interaction): DiscordInteraction | null => {
  if (!interaction.isRepliable()) return null;
  const base = interactionBase(interaction);
  if (interaction.isChatInputCommand()) {
    return Object.freeze({
      ...base,
      kind: "chat_input",
      commandName: interaction.commandName,
      options: commandOptions(interaction),
    }) satisfies DiscordChatInputInteraction;
  }
  if (interaction.isButton()) {
    return Object.freeze({ ...base, kind: "button", customId: interaction.customId });
  }
  if (interaction.isStringSelectMenu()) {
    return Object.freeze({
      ...base,
      kind: "string_select",
      customId: interaction.customId,
      values: Object.freeze([...interaction.values]),
    });
  }
  if (interaction.isUserSelectMenu()) {
    return Object.freeze({
      ...base,
      kind: "user_select",
      customId: interaction.customId,
      userIds: Object.freeze([...interaction.values]),
    });
  }
  if (interaction.isModalSubmit()) {
    const fields: DiscordModalFieldsPort = Object.freeze({
      getText: (customId: string): string => interaction.fields.getTextInputValue(customId),
    });
    return Object.freeze({
      ...base,
      kind: "modal_submit",
      customId: interaction.customId,
      fields,
    });
  }
  return null;
};

/**
 * Converts a provider-owned Node interaction into the stable core DTO.
 *
 * The unknown input is intentional: consumers may forward an object received by
 * their provider adapter without importing or exposing any provider SDK type. A
 * structural lookalike is rejected because accepting one would let untrusted
 * objects execute arbitrary getters and methods inside the provider boundary.
 */
export const normalizeNodeDiscordInteraction = (value: unknown): DiscordInteraction | null => {
  try {
    if (!(value instanceof BaseInteraction)) return null;
    return normalizeInteraction(value as Interaction);
  } catch (error: unknown) {
    throw providerFailure(error);
  }
};

const NODE_DISCORD_PROVIDER_EXTENSION_PROTOCOL = Symbol(
  "node-discord-provider-extension",
);

type NodeDiscordProviderExtensionProtocol = Readonly<{
  key: string;
  bindProviderClient(providerClient: unknown, generation: number): void;
  releaseProviderClient(generation: number, signal: AbortSignal): Promise<void>;
}>;

type RegisteredNodeDiscordProviderExtension = {
  readonly owner: object;
  readonly protocol: NodeDiscordProviderExtensionProtocol;
  boundGeneration: number | null;
  releaseOperation: Promise<void> | null;
  releaseFailed: boolean;
  removing: boolean;
};

export interface NodeDiscordProviderExtensionHostPort {
  registerProviderExtension(extension: unknown): Promise<() => Promise<void>>;
}

export interface NodeDiscordProviderExtensionOptions {
  readonly key: string;
  bindProviderClient(providerClient: unknown, generation: number): void;
  releaseProviderClient(generation: number, signal: AbortSignal): Promise<void>;
}

const providerExtensionProtocol = (
  extension: unknown,
): Readonly<{
  owner: object;
  protocol: NodeDiscordProviderExtensionProtocol;
}> => {
  if (extension === null || typeof extension !== "object") {
    throw new DiscordCoreError(
      "DISCORD_INVALID_INPUT",
      "Discord provider extension is invalid.",
      false,
    );
  }
  const descriptor = Object.getOwnPropertyDescriptor(
    extension,
    NODE_DISCORD_PROVIDER_EXTENSION_PROTOCOL,
  );
  if (descriptor === undefined || !("value" in descriptor)) {
    throw new DiscordCoreError(
      "DISCORD_INVALID_INPUT",
      "Discord provider extension protocol is missing.",
      false,
    );
  }
  const protocol: unknown = descriptor.value;
  if (protocol === null || typeof protocol !== "object") {
    throw new DiscordCoreError(
      "DISCORD_INVALID_INPUT",
      "Discord provider extension protocol is invalid.",
      false,
    );
  }
  const keyDescriptor = Object.getOwnPropertyDescriptor(protocol, "key");
  const bindDescriptor = Object.getOwnPropertyDescriptor(protocol, "bindProviderClient");
  const releaseDescriptor = Object.getOwnPropertyDescriptor(protocol, "releaseProviderClient");
  if (
    keyDescriptor === undefined ||
    !("value" in keyDescriptor) ||
    typeof keyDescriptor.value !== "string" ||
    !/^[a-z][a-z0-9.-]{2,127}$/u.test(keyDescriptor.value) ||
    bindDescriptor === undefined ||
    !("value" in bindDescriptor) ||
    typeof bindDescriptor.value !== "function" ||
    releaseDescriptor === undefined ||
    !("value" in releaseDescriptor) ||
    typeof releaseDescriptor.value !== "function"
  ) {
    throw new DiscordCoreError(
      "DISCORD_INVALID_INPUT",
      "Discord provider extension protocol is invalid.",
      false,
    );
  }
  return Object.freeze({
    owner: extension,
    protocol: Object.freeze({
      key: keyDescriptor.value,
      bindProviderClient: bindDescriptor.value as NodeDiscordProviderExtensionProtocol["bindProviderClient"],
      releaseProviderClient:
        releaseDescriptor.value as NodeDiscordProviderExtensionProtocol["releaseProviderClient"],
    }),
  });
};

/**
 * Creates the opaque bridge understood by the Node runtime. The private Symbol
 * and protocol shape remain owned here; companion packages expose ordinary
 * callbacks and do not need to duplicate this implementation detail.
 */
export const createNodeDiscordProviderExtension = (
  options: NodeDiscordProviderExtensionOptions,
): unknown => {
  if (options === null || typeof options !== "object") {
    throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Discord provider extension is invalid.", false);
  }
  const keyDescriptor = Object.getOwnPropertyDescriptor(options, "key");
  const bindDescriptor = Object.getOwnPropertyDescriptor(options, "bindProviderClient");
  const releaseDescriptor = Object.getOwnPropertyDescriptor(options, "releaseProviderClient");
  if (
    keyDescriptor === undefined ||
    !("value" in keyDescriptor) ||
    typeof keyDescriptor.value !== "string" ||
    !/^[a-z][a-z0-9.-]{2,127}$/u.test(keyDescriptor.value) ||
    bindDescriptor === undefined ||
    !("value" in bindDescriptor) ||
    typeof bindDescriptor.value !== "function" ||
    releaseDescriptor === undefined ||
    !("value" in releaseDescriptor) ||
    typeof releaseDescriptor.value !== "function"
  ) {
    throw new DiscordCoreError(
      "DISCORD_INVALID_INPUT",
      "Discord provider extension callbacks are invalid.",
      false,
    );
  }
  const key = keyDescriptor.value;
  const bind = bindDescriptor.value as NodeDiscordProviderExtensionOptions["bindProviderClient"];
  const release = releaseDescriptor.value as NodeDiscordProviderExtensionOptions["releaseProviderClient"];
  const protocol: NodeDiscordProviderExtensionProtocol = Object.freeze({
    key,
    bindProviderClient: (providerClient, generation) => bind(providerClient, generation),
    releaseProviderClient: (generation, signal) => release(generation, signal),
  });
  const extension = Object.create(null) as Record<PropertyKey, unknown>;
  Object.defineProperty(extension, NODE_DISCORD_PROVIDER_EXTENSION_PROTOCOL, {
    value: protocol,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return Object.freeze(extension);
};

export class NodeDiscordGatewayAdapter
  implements
    DiscordGatewayRuntimePort,
    NodeDiscordProviderExtensionHostPort,
    DiscordGatewayInspectionPort,
    DiscordGuildDirectoryPort,
    DiscordProfileQueryPort,
    DiscordPresencePort
{
  #client: Client;
  readonly #clientFactory: () => Client;
  readonly #botToken: string;
  readonly #listeners = new Set<DiscordGatewayLifecycleListener>();
  readonly #interactionListeners = new Set<DiscordInteractionListener>();
  readonly #startupTimeoutMs: number;
  readonly #shutdownTimeoutMs: number;
  readonly #listenerTimeoutMs: number;
  readonly #queryTimeoutMs: number;
  readonly #maximumConcurrentQueries: number;
  readonly #providerExtensions = new Map<string, RegisteredNodeDiscordProviderExtension>();
  readonly #inFlightQueries = new Map<number, number>();
  #clientGeneration = 1;
  #queryAbortController = new AbortController();
  #extensionsFrozen = false;
  #startPromise: Promise<DiscordGatewayIdentity> | null = null;
  #providerLoginPromise: Promise<void> | null = null;
  #startupController: AbortController | null = null;
  #stopPromise: Promise<void> | null = null;
  #stopRequested = false;

  public constructor(options: NodeDiscordGatewayOptions) {
    this.#botToken = validatedToken(options.botToken);
    const clientOptions: NodeDiscordClientOptions = Object.freeze({
      intents: Object.freeze([...options.intents]),
      ...(options.acknowledgedPrivilegedIntents === undefined
        ? {}
        : {
            acknowledgedPrivilegedIntents: Object.freeze([
              ...options.acknowledgedPrivilegedIntents,
            ]),
          }),
      ...(options.partials === undefined
        ? {}
        : { partials: Object.freeze([...options.partials]) }),
      ...(options.closeTimeoutMs === undefined
        ? {}
        : { closeTimeoutMs: options.closeTimeoutMs }),
      ...(options.waitGuildTimeoutMs === undefined
        ? {}
        : { waitGuildTimeoutMs: options.waitGuildTimeoutMs }),
    });
    this.#clientFactory = () => createClient(clientOptions);
    this.#client = this.#clientFactory();
    this.#startupTimeoutMs = boundedInteger(
      options.startupTimeoutMs,
      30_000,
      1_000,
      120_000,
      "startupTimeoutMs",
    );
    this.#shutdownTimeoutMs = boundedInteger(
      options.closeTimeoutMs,
      5_000,
      1_000,
      30_000,
      "closeTimeoutMs",
    );
    this.#listenerTimeoutMs = boundedInteger(
      options.listenerTimeoutMs,
      5_000,
      100,
      30_000,
      "listenerTimeoutMs",
    );
    this.#queryTimeoutMs = boundedInteger(
      options.queryTimeoutMs,
      10_000,
      100,
      30_000,
      "queryTimeoutMs",
    );
    this.#maximumConcurrentQueries = boundedInteger(
      options.maximumConcurrentQueries,
      64,
      1,
      256,
      "maximumConcurrentQueries",
    );
    this.#attachClient(this.#client);
  }

  #attachClient(client: Client): void {
    client.on(Events.ClientReady, (readyClient) => {
      if (this.#client !== client || this.#stopRequested) return;
      void this.#emit({ type: "ready", identity: this.#identity(readyClient) });
    });
    client.on(Events.ShardResume, (shardId) => {
      if (this.#client !== client || this.#stopRequested) return;
      void this.#emit({ type: "shard_resumed", shardId });
    });
    client.on(Events.ShardDisconnect, (closeEvent, shardId) => {
      if (this.#client !== client || this.#stopRequested) return;
      void this.#emit({
        type: "shard_disconnected",
        shardId,
        closeCode: Number.isInteger(closeEvent.code) ? closeEvent.code : null,
      });
    });
    client.on(Events.ShardReconnecting, (shardId) => {
      if (this.#client !== client || this.#stopRequested) return;
      void this.#emit({ type: "shard_reconnecting", shardId });
    });
    client.on(Events.Error, () => {
      if (this.#client !== client || this.#stopRequested) return;
      void this.#emit({ type: "provider_error", code: "DISCORD_GATEWAY_ERROR" });
    });
    client.on(Events.InteractionCreate, (interaction) => {
      if (this.#client !== client || this.#stopRequested) return;
      const normalized = normalizeInteraction(interaction);
      if (normalized !== null) void this.#emitInteraction(normalized);
    });
  }

  async #replaceStoppedClient(): Promise<void> {
    const client = this.#clientFactory();
    this.#client = client;
    this.#clientGeneration += 1;
    this.#queryAbortController = new AbortController();
    this.#attachClient(client);
    try {
      this.#bindProviderExtensions(client, this.#clientGeneration);
    } catch (error: unknown) {
      await this.#releaseProviderExtensions(this.#clientGeneration).catch(() => undefined);
      await client.destroy().catch(() => undefined);
      throw error instanceof DiscordCoreError ? error : providerFailure(error);
    }
  }

  public async start(signal?: AbortSignal): Promise<DiscordGatewayIdentity> {
    if (isAbortRequested(signal)) {
      throw new DiscordCoreError("DISCORD_CANCELLED", "Discord gateway startup was cancelled.", false);
    }
    if (this.#stopPromise !== null) await this.#stopPromise;
    if (isAbortRequested(signal)) {
      throw new DiscordCoreError("DISCORD_CANCELLED", "Discord gateway startup was cancelled.", false);
    }
    this.#extensionsFrozen = true;
    if (this.#client.isReady() && !this.#stopRequested) {
      this.#assertProviderExtensionsReady();
      return this.#identity(this.#client);
    }

    let shared = this.#startPromise;
    if (shared === null) {
      const controller = new AbortController();
      const pending = this.#startSharedGeneration(controller.signal);
      shared = pending;
      this.#startupController = controller;
      this.#startPromise = pending;
      void pending.then(
        () => this.#clearStartup(pending, controller),
        () => this.#clearStartup(pending, controller),
      );
    }
    return this.#awaitStartupForCaller(shared, signal);
  }

  async #startSharedGeneration(signal: AbortSignal): Promise<DiscordGatewayIdentity> {
    if (this.#providerLoginPromise !== null) {
      throw new DiscordCoreError(
        "DISCORD_CIRCUIT_OPEN",
        "A previous Discord gateway login has not settled.",
        true,
      );
    }
    /*
     * Provider clients are generation-scoped: discord.js Client.destroy()
     * permanently tears down that instance. Restart therefore creates a
     * fresh internal client while preserving the stable product-facing port.
     * This entire transition belongs to the published shared start promise,
     * so concurrent starts cannot create competing client generations.
     */
    if (this.#stopRequested) {
      await this.#replaceStoppedClient();
      if (signal.aborted) {
        throw new DiscordCoreError(
          "DISCORD_CANCELLED",
          "Discord gateway startup was cancelled.",
          false,
        );
      }
      this.#assertProviderExtensionsReady();
      this.#stopRequested = false;
    } else {
      this.#assertProviderExtensionsReady();
    }
    return this.#startOnce(signal);
  }

  public async stop(): Promise<void> {
    if (this.#stopPromise !== null) return this.#stopPromise;

    this.#extensionsFrozen = true;
    const startup = this.#startPromise;
    const providerLogin = this.#providerLoginPromise;
    this.#stopRequested = true;
    this.#queryAbortController.abort();
    this.#inFlightQueries.delete(this.#clientGeneration);
    this.#startupController?.abort();
    const stopping = (async (): Promise<void> => {
      if (startup !== null) {
        try {
          await startup;
        } catch {
          // Startup failure is reported to its caller. Shutdown still owns the
          // final provider cleanup and must not expose the raw SDK error.
        }
      }
      await this.#shutdownProviderLogin(providerLogin);
    })();
    this.#stopPromise = stopping;
    try {
      await stopping;
    } finally {
      if (this.#stopPromise === stopping) this.#stopPromise = null;
    }
  }

  async #startOnce(signal: AbortSignal): Promise<DiscordGatewayIdentity> {
    if (this.#client.isReady()) return this.#identity(this.#client);

    let ready!: () => void;
    const readyPromise = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const onReady = (): void => ready();
    this.#client.once(Events.ClientReady, onReady);

    let rejectTimeout!: (error: DiscordCoreError) => void;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      rejectTimeout = reject;
    });
    const timeout = setTimeout(
      () =>
        rejectTimeout(
          new DiscordCoreError(
            "DISCORD_TIMEOUT",
            "Discord gateway did not become ready before its deadline.",
            true,
          ),
        ),
      this.#startupTimeoutMs,
    );

    let rejectCancellation!: (error: DiscordCoreError) => void;
    const cancellationPromise = new Promise<never>((_resolve, reject) => {
      rejectCancellation = reject;
    });
    const onAbort = (): void =>
      rejectCancellation(
        new DiscordCoreError("DISCORD_CANCELLED", "Discord gateway startup was cancelled.", false),
      );
    signal.addEventListener("abort", onAbort, { once: true });

    const providerLogin = this.#beginProviderLogin();
    try {
      await Promise.race([
        (async () => {
          await providerLogin;
          if (!this.#client.isReady()) await readyPromise;
        })(),
        timeoutPromise,
        cancellationPromise,
      ]);
      return this.#identity(this.#client);
    } catch (error: unknown) {
      this.#stopRequested = true;
      if (!signal.aborted) {
        await this.#shutdownProviderLogin(providerLogin);
      }
      if (error instanceof DiscordCoreError) throw error;
      throw providerFailureForSignal(error, signal);
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
      this.#client.off(Events.ClientReady, onReady);
    }
  }

  async #awaitStartupForCaller(
    startup: Promise<DiscordGatewayIdentity>,
    signal: AbortSignal | undefined,
  ): Promise<DiscordGatewayIdentity> {
    if (signal === undefined) return startup;
    if (signal.aborted) {
      throw new DiscordCoreError("DISCORD_CANCELLED", "Discord gateway startup was cancelled.", false);
    }

    let rejectCancellation!: (error: DiscordCoreError) => void;
    const cancellation = new Promise<never>((_resolve, reject) => {
      rejectCancellation = reject;
    });
    const onAbort = (): void =>
      rejectCancellation(
        new DiscordCoreError("DISCORD_CANCELLED", "Discord gateway startup was cancelled.", false),
      );
    signal.addEventListener("abort", onAbort, { once: true });
    try {
      return await Promise.race([startup, cancellation]);
    } finally {
      signal.removeEventListener("abort", onAbort);
    }
  }

  #clearStartup(
    startup: Promise<DiscordGatewayIdentity>,
    controller: AbortController,
  ): void {
    if (this.#startPromise === startup) this.#startPromise = null;
    if (this.#startupController === controller) this.#startupController = null;
  }

  #beginProviderLogin(): Promise<void> {
    if (this.#providerLoginPromise !== null) {
      throw new DiscordCoreError(
        "DISCORD_CIRCUIT_OPEN",
        "A Discord gateway login is already active.",
        true,
      );
    }
    let login: Promise<string>;
    try {
      login = this.#client.login(this.#botToken);
    } catch (error: unknown) {
      login = Promise.reject(error);
    }
    const providerLogin = login.then(() => undefined);
    this.#providerLoginPromise = providerLogin;
    void providerLogin.then(
      () => this.#clearProviderLogin(providerLogin),
      () => this.#clearProviderLogin(providerLogin),
    );
    return providerLogin;
  }

  #clearProviderLogin(providerLogin: Promise<void>): void {
    if (this.#providerLoginPromise === providerLogin) this.#providerLoginPromise = null;
  }

  async #shutdownProviderLogin(providerLogin: Promise<void> | null): Promise<void> {
    let failure: DiscordCoreError | null = null;
    const recordFailure = (error: unknown): void => {
      failure ??= error instanceof DiscordCoreError ? error : providerFailure(error);
    };

    try {
      await this.#releaseProviderExtensions(this.#clientGeneration);
    } catch (error: unknown) {
      recordFailure(error);
    }

    try {
      await this.#client.destroy();
    } catch (error: unknown) {
      recordFailure(error);
    }

    if (providerLogin !== null) {
      try {
        await this.#awaitProviderLoginSettlement(providerLogin);
      } catch (error: unknown) {
        recordFailure(error);
      }
      try {
        // A provider login may settle and emit Ready after the first destroy.
        // A final awaited destroy closes that late session before stop returns.
        await this.#client.destroy();
      } catch (error: unknown) {
        recordFailure(error);
      }
    }

    if (failure !== null) throw failure;
  }

  async #awaitProviderLoginSettlement(providerLogin: Promise<void>): Promise<void> {
    let rejectTimeout!: (error: DiscordCoreError) => void;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      rejectTimeout = reject;
    });
    const timeout = setTimeout(
      () =>
        rejectTimeout(
          new DiscordCoreError(
            "DISCORD_TIMEOUT",
            "Discord gateway login did not settle during shutdown.",
            true,
          ),
        ),
      this.#shutdownTimeoutMs,
    );
    try {
      await Promise.race([
        providerLogin.catch(() => undefined),
        timeoutPromise,
      ]);
    } finally {
      clearTimeout(timeout);
    }
  }

  public isReady(): boolean {
    return this.#client.isReady();
  }

  public subscribeLifecycle(listener: DiscordGatewayLifecycleListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  public subscribeInteractions(listener: DiscordInteractionListener): () => void {
    if (!this.#interactionListeners.has(listener) && this.#interactionListeners.size > 0) {
      throw new DiscordCoreError(
        "DISCORD_INVALID_INPUT",
        "Discord gateway accepts one interaction router per runtime.",
        false,
      );
    }
    this.#interactionListeners.add(listener);
    return () => this.#interactionListeners.delete(listener);
  }

  public capture(): DiscordGatewayInspectionSnapshot {
    const client = this.#client;
    const connected = !this.#stopRequested && client.isReady();
    if (!connected) {
      return Object.freeze({
        connected: false,
        applicationId: null,
        agentUserId: null,
        communityCount: 0,
        userCount: 0,
        partitionCount: 0,
        transportLatencyMilliseconds: null,
        gatewayLibraryVersion: discordJsVersion,
        channelCount: 0,
        textChannelCount: 0,
        voiceChannelCount: 0,
        guilds: Object.freeze([]),
      });
    }
    if (client.guilds.cache.size > MAXIMUM_CACHED_GUILDS) {
      throw new DiscordCoreError(
        "DISCORD_RESPONSE_TOO_LARGE",
        "Discord guild inventory exceeds its limit.",
        false,
      );
    }
    const guilds: DiscordGuildInventoryEntry[] = [];
    const ids = new Set<string>();
    let userCount = 0;
    let channelCount = 0;
    let textChannelCount = 0;
    let voiceChannelCount = 0;
    for (const [cacheId, guild] of client.guilds.cache) {
      const entry = inventoryEntry(guild);
      if (cacheId !== entry.id || ids.has(entry.id)) {
        throw new DiscordCoreError(
          "DISCORD_RESPONSE_INVALID",
          "Discord guild inventory is inconsistent.",
          false,
        );
      }
      ids.add(entry.id);
      guilds.push(entry);
      userCount += entry.memberCount;
      channelCount += guild.channels.cache.size;
      for (const channel of guild.channels.cache.values()) {
        if (TEXT_CHANNEL_TYPES.has(channel.type)) textChannelCount += 1;
        if (VOICE_CHANNEL_TYPES.has(channel.type)) voiceChannelCount += 1;
      }
      for (const [value, label] of [
        [userCount, "Discord aggregate member count"],
        [channelCount, "Discord aggregate channel count"],
        [textChannelCount, "Discord aggregate text channel count"],
        [voiceChannelCount, "Discord aggregate voice channel count"],
      ] as const) {
        responseBoundedInteger(value, 0, MAXIMUM_GUILD_MEMBERS, label);
      }
    }
    guilds.sort((left, right) => left.id.localeCompare(right.id, "en"));
    const user = client.user;
    const application = client.application;
    const latency = client.ws.ping;
    return Object.freeze({
      connected: true,
      applicationId:
        application === null
          ? null
          : responseSnowflake(application.id, "Discord application id"),
      agentUserId:
        user === null ? null : responseSnowflake(user.id, "Discord bot user id"),
      communityCount: guilds.length,
      userCount,
      partitionCount: responseBoundedInteger(
        client.ws.shards.size,
        0,
        4_096,
        "Discord shard count",
      ),
      transportLatencyMilliseconds:
        Number.isFinite(latency) && latency >= 0 && latency <= 1_000_000
          ? latency
          : null,
      gatewayLibraryVersion: responseTextValue(
        discordJsVersion,
        1,
        64,
        "Discord gateway library version",
      ),
      channelCount,
      textChannelCount,
      voiceChannelCount,
      guilds: Object.freeze(guilds),
    });
  }

  public async listRoles(
    input: DiscordGuildRoleListInput,
  ): Promise<readonly DiscordGuildRoleSnapshot[]> {
    const guildId = inputSnowflake(
      inputDataProperty(input, "guildId", "Discord guild role-list input"),
      "Discord guild id",
    );
    const signal = inputAbortSignal(
      inputDataProperty(input, "signal", "Discord guild role-list signal", true),
      "Discord guild role-list signal",
    );
    return this.#runCurrentClientOperation(signal, async (client) => {
      const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
      if (guild.id !== guildId) {
        throw new DiscordCoreError(
          "DISCORD_RESPONSE_INVALID",
          "Discord guild response does not match the requested guild.",
          false,
        );
      }
      const collection = await guild.roles.fetch();
      if (collection.size > MAXIMUM_GUILD_ROLES) {
        throw new DiscordCoreError(
          "DISCORD_RESPONSE_TOO_LARGE",
          "Discord guild role collection exceeds its limit.",
          false,
        );
      }
      const roles: DiscordGuildRoleSnapshot[] = [];
      const ids = new Set<string>();
      for (const [collectionId, role] of collection) {
        const snapshot = roleSnapshot(role, guildId);
        if (collectionId !== snapshot.id || ids.has(snapshot.id)) {
          throw new DiscordCoreError(
            "DISCORD_RESPONSE_INVALID",
            "Discord guild role collection is inconsistent.",
            false,
          );
        }
        ids.add(snapshot.id);
        roles.push(snapshot);
      }
      roles.sort((left, right) => left.id.localeCompare(right.id, "en"));
      return Object.freeze(roles);
    });
  }

  public async listMembers(input: DiscordGuildMemberListInput): Promise<DiscordGuildMemberPage> {
    const guildId = inputSnowflake(
      inputDataProperty(input, "guildId", "Discord guild member-list input"),
      "Discord guild id",
    );
    const limit = inputPageLimit(
      inputDataProperty(input, "limit", "Discord guild member-list input"),
    );
    const afterValue = inputDataProperty(
      input,
      "after",
      "Discord guild member-list cursor",
      true,
    );
    const after = afterValue === undefined
      ? null
      : inputSnowflake(afterValue, "Discord member page cursor");
    const signal = inputAbortSignal(
      inputDataProperty(input, "signal", "Discord guild member-list signal", true),
      "Discord guild member-list signal",
    );
    return this.#runCurrentClientOperation(signal, async (client) => {
      const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
      if (guild.id !== guildId) {
        throw new DiscordCoreError(
          "DISCORD_RESPONSE_INVALID",
          "Discord guild response does not match the requested guild.",
          false,
        );
      }
      const collection = await guild.members.list({
        limit,
        ...(after === null ? {} : { after }),
        cache: false,
      });
      if (collection.size > limit || collection.size > MAXIMUM_MEMBER_PAGE_SIZE) {
        throw new DiscordCoreError(
          "DISCORD_RESPONSE_TOO_LARGE",
          "Discord guild member page exceeds its requested limit.",
          false,
        );
      }
      const members: DiscordGuildMemberSnapshot[] = [];
      let previous: string | null = after;
      const ids = new Set<string>();
      for (const [collectionId, providerMember] of collection) {
        const member = memberSnapshot(providerMember, guildId);
        if (
          collectionId !== member.userId ||
          ids.has(member.userId) ||
          (previous !== null && BigInt(member.userId) <= BigInt(previous))
        ) {
          throw new DiscordCoreError(
            "DISCORD_RESPONSE_INVALID",
            "Discord guild member page is not a strictly advancing sequence.",
            false,
          );
        }
        ids.add(member.userId);
        previous = member.userId;
        members.push(member);
      }
      const nextAfter = members.length === limit ? (members.at(-1)?.userId ?? null) : null;
      if (nextAfter !== null && nextAfter === after) {
        throw new DiscordCoreError(
          "DISCORD_RESPONSE_INVALID",
          "Discord guild member page cursor did not advance.",
          false,
        );
      }
      return Object.freeze({
        guildId,
        limit,
        after,
        members: Object.freeze(members),
        nextAfter,
      });
    });
  }

  public async readUser(input: DiscordUserProfileReadInput): Promise<DiscordUserProfile | null> {
    const userId = inputSnowflake(
      inputDataProperty(input, "userId", "Discord user-profile input"),
      "Discord user id",
    );
    const mode = profileReadMode(
      inputDataProperty(input, "mode", "Discord user-profile mode", true),
    );
    const signal = inputAbortSignal(
      inputDataProperty(input, "signal", "Discord user-profile signal", true),
      "Discord user-profile signal",
    );
    return this.#runCurrentClientOperation(signal, async (client) => {
      try {
        const cached = client.users.cache.get(userId);
        if (mode === "cache") return cached === undefined ? null : userProfile(cached);
        const user =
          mode === "cache_or_fetch" && cached !== undefined
            ? cached
            : await client.users.fetch(userId, { cache: true, force: mode === "provider" });
        return userProfile(user);
      } catch (error: unknown) {
        if (isProviderNotFoundError(error)) return null;
        throw error;
      }
    });
  }

  public async readMember(
    input: DiscordMemberProfileReadInput,
  ): Promise<DiscordMemberProfile | null> {
    const guildId = inputSnowflake(
      inputDataProperty(input, "guildId", "Discord member-profile input"),
      "Discord guild id",
    );
    const userId = inputSnowflake(
      inputDataProperty(input, "userId", "Discord member-profile input"),
      "Discord member user id",
    );
    const mode = profileReadMode(
      inputDataProperty(input, "mode", "Discord member-profile mode", true),
    );
    const signal = inputAbortSignal(
      inputDataProperty(input, "signal", "Discord member-profile signal", true),
      "Discord member-profile signal",
    );
    return this.#runCurrentClientOperation(signal, async (client) => {
      try {
        const cachedGuild = client.guilds.cache.get(guildId);
        const cachedMember = cachedGuild?.members.cache.get(userId);
        if (mode === "cache") {
          return cachedMember === undefined ? null : memberProfile(cachedMember, guildId);
        }
        if (mode === "cache_or_fetch" && cachedMember !== undefined) {
          return memberProfile(cachedMember, guildId);
        }
        const guild = cachedGuild ?? await client.guilds.fetch(guildId);
        if (guild.id !== guildId) {
          throw new DiscordCoreError(
            "DISCORD_RESPONSE_INVALID",
            "Discord guild response does not match the requested guild.",
            false,
          );
        }
        const member = await guild.members.fetch({
          user: userId,
          cache: true,
          force: mode === "provider",
        });
        return memberProfile(member, guildId);
      } catch (error: unknown) {
        if (isProviderNotFoundError(error)) return null;
        throw error;
      }
    });
  }

  public async readGuild(input: DiscordGuildProfileReadInput): Promise<DiscordGuildProfile | null> {
    const guildId = inputSnowflake(
      inputDataProperty(input, "guildId", "Discord guild-profile input"),
      "Discord guild id",
    );
    const mode = profileReadMode(
      inputDataProperty(input, "mode", "Discord guild-profile mode", true),
    );
    const signal = inputAbortSignal(
      inputDataProperty(input, "signal", "Discord guild-profile signal", true),
      "Discord guild-profile signal",
    );
    return this.#runCurrentClientOperation(signal, async (client) => {
      try {
        const cached = client.guilds.cache.get(guildId);
        if (mode === "cache") return cached === undefined ? null : guildProfile(cached);
        const guild =
          mode === "cache_or_fetch" && cached !== undefined
            ? cached
            : await client.guilds.fetch({
                guild: guildId,
                cache: true,
                force: mode === "provider",
                withCounts: true,
              });
        if (guild.id !== guildId) {
          throw new DiscordCoreError(
            "DISCORD_RESPONSE_INVALID",
            "Discord guild response does not match the requested guild.",
            false,
          );
        }
        return guildProfile(guild);
      } catch (error: unknown) {
        if (isProviderNotFoundError(error)) return null;
        throw error;
      }
    });
  }

  public async apply(plan: DiscordPresencePlan): Promise<void> {
    const textValue = inputDataProperty(plan, "text", "Discord presence plan");
    if (typeof textValue !== "string") {
      throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Discord presence text is invalid.", false);
    }
    const text = textValue.trim();
    if (
      text.length === 0 ||
      [...text].length > 128 ||
      /[\u0000-\u001f\u007f]/u.test(text)
    ) {
      throw new DiscordCoreError(
        "DISCORD_INVALID_INPUT",
        "Discord presence text must contain between 1 and 128 characters.",
        false,
      );
    }
    const activityValue = inputDataProperty(plan, "activityType", "Discord presence plan");
    const statusValue = inputDataProperty(plan, "status", "Discord presence plan");
    if (
      typeof activityValue !== "string" ||
      !Object.prototype.hasOwnProperty.call(PRESENCE_ACTIVITY_TYPES, activityValue) ||
      typeof statusValue !== "string" ||
      !PRESENCE_STATUSES.has(statusValue as DiscordPresenceStatus)
    ) {
      throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Discord presence is invalid.", false);
    }
    const activityType = activityValue as DiscordPresenceActivityType;
    const status = statusValue as DiscordPresenceStatus;
    const signal = inputAbortSignal(
      inputDataProperty(plan, "signal", "Discord presence signal", true),
      "Discord presence signal",
    );
    await this.#runCurrentClientOperation(signal, (client) => {
      const user = client.user;
      if (user === null) {
        throw new DiscordCoreError(
          "DISCORD_CIRCUIT_OPEN",
          "Discord presence is unavailable before gateway readiness.",
          true,
        );
      }
      user.setPresence({
        status,
        activities: [{ name: text, type: PRESENCE_ACTIVITY_TYPES[activityType] }],
      });
    });
  }

  public async clear(signal?: AbortSignal): Promise<void> {
    const validatedSignal = inputAbortSignal(signal, "Discord presence signal");
    await this.#runCurrentClientOperation(validatedSignal, (client) => {
      const user = client.user;
      if (user === null) {
        throw new DiscordCoreError(
          "DISCORD_CIRCUIT_OPEN",
          "Discord presence is unavailable before gateway readiness.",
          true,
        );
      }
      user.setPresence({ activities: [] });
    });
  }

  async #runCurrentClientOperation<T>(
    signal: AbortSignal | undefined,
    operation: (client: Client) => T | Promise<T>,
  ): Promise<T> {
    if (signal?.aborted === true) {
      throw new DiscordCoreError("DISCORD_CANCELLED", "Discord operation was cancelled.", false);
    }
    const client = this.#client;
    const generation = this.#clientGeneration;
    const lifecycleSignal = this.#queryAbortController.signal;
    if (this.#stopRequested || lifecycleSignal.aborted || !client.isReady()) {
      throw new DiscordCoreError(
        "DISCORD_CIRCUIT_OPEN",
        "Discord gateway is not ready for this operation.",
        true,
      );
    }
    const currentCount = this.#inFlightQueries.get(generation) ?? 0;
    if (currentCount >= this.#maximumConcurrentQueries) {
      throw new DiscordCoreError(
        "DISCORD_CIRCUIT_OPEN",
        "Discord concurrent query capacity was exceeded.",
        true,
      );
    }
    this.#inFlightQueries.set(generation, currentCount + 1);
    const providerOperation = Promise.resolve()
      .then(() => operation(client))
      .finally(() => {
        const count = this.#inFlightQueries.get(generation);
        if (count === undefined) return;
        if (count <= 1) this.#inFlightQueries.delete(generation);
        else this.#inFlightQueries.set(generation, count - 1);
      });

    let rejectBoundary!: (error: DiscordCoreError) => void;
    const boundary = new Promise<never>((_resolve, reject) => {
      rejectBoundary = reject;
    });
    const onCallerAbort = (): void =>
      rejectBoundary(new DiscordCoreError("DISCORD_CANCELLED", "Discord operation was cancelled.", false));
    const onLifecycleAbort = (): void =>
      rejectBoundary(new DiscordCoreError("DISCORD_CANCELLED", "Discord gateway generation stopped.", false));
    signal?.addEventListener("abort", onCallerAbort, { once: true });
    lifecycleSignal.addEventListener("abort", onLifecycleAbort, { once: true });
    const timeout = setTimeout(
      () =>
        rejectBoundary(
          new DiscordCoreError(
            "DISCORD_TIMEOUT",
            "Discord operation exceeded its deadline.",
            true,
          ),
        ),
      this.#queryTimeoutMs,
    );
    try {
      const result = await Promise.race([providerOperation, boundary]);
      if (
        this.#client !== client ||
        this.#clientGeneration !== generation ||
        this.#stopRequested ||
        lifecycleSignal.aborted ||
        !client.isReady()
      ) {
        throw new DiscordCoreError(
          "DISCORD_CANCELLED",
          "Discord gateway generation changed during the operation.",
          false,
        );
      }
      return result;
    } catch (error: unknown) {
      if (error instanceof DiscordCoreError) throw error;
      if (isAbortRequested(signal) || isAbortRequested(lifecycleSignal)) {
        throw new DiscordCoreError("DISCORD_CANCELLED", "Discord operation was cancelled.", false);
      }
      throw providerFailure(error);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onCallerAbort);
      lifecycleSignal.removeEventListener("abort", onLifecycleAbort);
    }
  }

  public registerProviderExtension(
    extension: unknown,
  ): Promise<() => Promise<void>> {
    if (this.#extensionsFrozen) {
      throw new DiscordCoreError(
        "DISCORD_INVALID_INPUT",
        "Discord provider extensions must be registered before the gateway lifecycle begins.",
        false,
      );
    }
    if (this.#providerExtensions.size >= 8) {
      throw new DiscordCoreError(
        "DISCORD_INVALID_INPUT",
        "Discord provider extension capacity was exceeded.",
        false,
      );
    }
    const parsed = providerExtensionProtocol(extension);
    if (this.#providerExtensions.has(parsed.protocol.key)) {
      throw new DiscordCoreError(
        "DISCORD_INVALID_INPUT",
        "Discord provider extension key is already registered.",
        false,
      );
    }
    const registered: RegisteredNodeDiscordProviderExtension = {
      owner: parsed.owner,
      protocol: parsed.protocol,
      boundGeneration: null,
      releaseOperation: null,
      releaseFailed: false,
      removing: false,
    };
    this.#providerExtensions.set(registered.protocol.key, registered);
    try {
      this.#bindProviderExtension(
        registered,
        this.#client,
        this.#clientGeneration,
      );
    } catch (error: unknown) {
      registered.removing = true;
      const failure = error instanceof DiscordCoreError
        ? error
        : new DiscordCoreError(
            "DISCORD_INVALID_INPUT",
            "Discord provider extension configuration is invalid.",
            false,
          );
      return this.#releaseProviderExtension(registered).then(
        () => {
          throw failure;
        },
        () => {
          // A failed rollback remains registered and quarantined. A later stop
          // retries it; the gateway never silently loses lifecycle ownership.
          throw failure;
        },
      );
    }

    let disposal: Promise<void> | null = null;
    const dispose = (): Promise<void> => {
      if (disposal !== null) return disposal;
      if (this.#providerExtensions.get(registered.protocol.key) !== registered) {
        disposal = Promise.resolve();
        return disposal;
      }
      registered.removing = true;
      if (
        registered.boundGeneration === null &&
        registered.releaseOperation === null
      ) {
        this.#providerExtensions.delete(registered.protocol.key);
        disposal = Promise.resolve();
        return disposal;
      }
      disposal = this.#releaseProviderExtension(registered).catch((error: unknown) => {
        disposal = null;
        throw error;
      });
      return disposal;
    };
    return Promise.resolve(dispose);
  }

  #bindProviderExtensions(client: Client, generation: number): void {
    for (const registered of this.#providerExtensions.values()) {
      if (
        registered.removing ||
        registered.releaseOperation !== null ||
        registered.releaseFailed ||
        registered.boundGeneration !== null
      ) {
        throw new DiscordCoreError(
          "DISCORD_CIRCUIT_OPEN",
          "A Discord provider extension from the previous generation is not released.",
          true,
        );
      }
    }
    for (const registered of this.#providerExtensions.values()) {
      this.#bindProviderExtension(registered, client, generation);
    }
  }

  #assertProviderExtensionsReady(): void {
    for (const registered of this.#providerExtensions.values()) {
      if (
        registered.removing ||
        registered.releaseOperation !== null ||
        registered.releaseFailed ||
        registered.boundGeneration !== this.#clientGeneration
      ) {
        throw new DiscordCoreError(
          "DISCORD_CIRCUIT_OPEN",
          "A Discord provider extension is not ready for the current gateway generation.",
          true,
        );
      }
    }
  }

  #bindProviderExtension(
    registered: RegisteredNodeDiscordProviderExtension,
    client: Client,
    generation: number,
  ): void {
    registered.boundGeneration = generation;
    try {
      const result = registered.protocol.bindProviderClient(client, generation) as unknown;
      if (result !== undefined) {
        void Promise.resolve(result).catch(() => undefined);
        throw new DiscordCoreError(
          "DISCORD_INVALID_INPUT",
          "Discord provider extension bind callbacks must complete synchronously.",
          false,
        );
      }
    } catch (error: unknown) {
      throw error instanceof DiscordCoreError
        ? error
        : new DiscordCoreError(
            "DISCORD_INVALID_INPUT",
            "Discord provider extension configuration is invalid.",
            false,
          );
    }
  }

  async #releaseProviderExtensions(generation: number): Promise<void> {
    const failures = await Promise.allSettled(
      [...this.#providerExtensions.values()]
        .filter((registered) => registered.boundGeneration === generation)
        .map((registered) => this.#releaseProviderExtension(registered)),
    );
    if (failures.some((result) => result.status === "rejected")) {
      throw new DiscordCoreError(
        "DISCORD_PROVIDER_FAILURE",
        "A Discord provider extension did not stop cleanly.",
        true,
      );
    }
  }

  async #releaseProviderExtension(
    registered: RegisteredNodeDiscordProviderExtension,
  ): Promise<void> {
    const generation = registered.boundGeneration;
    if (generation === null) return;
    let release = registered.releaseOperation;
    let controller: AbortController | null = null;
    if (release === null) {
      controller = new AbortController();
      registered.releaseFailed = false;
      const operation = Promise.resolve().then(() =>
        registered.protocol.releaseProviderClient(generation, controller!.signal),
      );
      let tracked!: Promise<void>;
      tracked = operation.then(
        () => {
          if (registered.releaseOperation !== tracked) return;
          registered.releaseOperation = null;
          registered.releaseFailed = false;
          if (registered.boundGeneration === generation) {
            registered.boundGeneration = null;
          }
          if (
            registered.removing &&
            this.#providerExtensions.get(registered.protocol.key) === registered
          ) {
            this.#providerExtensions.delete(registered.protocol.key);
          }
        },
        (error: unknown) => {
          if (registered.releaseOperation === tracked) {
            registered.releaseOperation = null;
            registered.releaseFailed = true;
          }
          throw error;
        },
      );
      registered.releaseOperation = tracked;
      release = tracked;
    }

    let rejectTimeout!: (error: DiscordCoreError) => void;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      rejectTimeout = reject;
    });
    const timeout = setTimeout(() => {
      controller?.abort();
      rejectTimeout(
        new DiscordCoreError(
          "DISCORD_TIMEOUT",
          "Discord provider extension shutdown exceeded its deadline.",
          true,
        ),
      );
    }, this.#shutdownTimeoutMs);
    try {
      await Promise.race([release, timeoutPromise]);
    } catch (error: unknown) {
      throw error instanceof DiscordCoreError ? error : providerFailure(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  public toJSON(): Readonly<{ component: "node-discord-gateway-adapter" }> {
    return Object.freeze({ component: "node-discord-gateway-adapter" });
  }

  async #emit(event: DiscordGatewayLifecycleEvent): Promise<void> {
    await Promise.allSettled(
      [...this.#listeners].map((listener) =>
        this.#deliverBounded(() => listener(event)),
      ),
    );
  }

  async #emitInteraction(interaction: DiscordInteraction): Promise<void> {
    const listener = this.#interactionListeners.values().next().value;
    if (listener === undefined) return;
    try {
      await this.#deliverBounded(() => listener(interaction));
    } catch {
      // Interaction errors are isolated from the provider event emitter. The
      // product router owns response/error presentation through the responder.
    }
  }

  async #deliverBounded(deliver: () => void | Promise<void>): Promise<void> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.resolve().then(deliver),
        new Promise<void>((resolve) => {
          timeout = setTimeout(resolve, this.#listenerTimeoutMs);
        }),
      ]);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  }

  #identity(client: Client): DiscordGatewayIdentity {
    const applicationId = client.application?.id;
    if (applicationId === undefined || client.user === null) {
      throw new DiscordCoreError(
        "DISCORD_RESPONSE_INVALID",
        "Discord gateway identity is incomplete.",
        false,
      );
    }
    return Object.freeze({
      userId: parseDiscordSnowflake(client.user.id, "Discord bot user id"),
      username: client.user.username,
      applicationId: parseDiscordSnowflake(applicationId, "Discord application id"),
    });
  }
}

export interface NodeDiscordRestOptions {
  readonly botToken: string;
  readonly timeoutMs?: number;
  readonly retries?: number;
  readonly globalRequestsPerSecond?: number;
  readonly invalidRequestWarningInterval?: number;
}

const validatedToken = (value: string): string => {
  const normalized = value.trim();
  if (
    normalized.length < 20 ||
    normalized.length > 512 ||
    /[\s\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new TypeError("Discord bot token is invalid.");
  }
  return normalized;
};

const responseRecord = (value: unknown): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new DiscordCoreError(
      "DISCORD_RESPONSE_INVALID",
      "Discord response shape is invalid.",
      false,
    );
  }
  return value as Record<string, unknown>;
};

const responseString = (record: Record<string, unknown>, key: string, label: string): string => {
  const value = record[key];
  if (typeof value !== "string") {
    throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", `${label} is invalid.`, false);
  }
  return value;
};

const providerStatus = (error: unknown): number | null =>
  error instanceof DiscordAPIError || error instanceof HTTPError ? error.status : null;

const providerFailure = (error: unknown): DiscordCoreError => {
  if (error instanceof DiscordCoreError) return error;
  if (error instanceof RateLimitError) {
    return new DiscordCoreError(
      "DISCORD_RATE_LIMITED",
      "Discord rate limit policy rejected the request.",
      true,
      429,
    );
  }
  const status = providerStatus(error);
  return new DiscordCoreError(
    status === null ? "DISCORD_NETWORK_FAILURE" : "DISCORD_PROVIDER_FAILURE",
    "Discord provider request failed.",
    status === null || status >= 500,
    status,
  );
};

const providerFailureForSignal = (error: unknown, signal: AbortSignal | undefined): DiscordCoreError =>
  signal?.aborted === true
    ? new DiscordCoreError(
        "DISCORD_CANCELLED",
        "Discord provider request was cancelled.",
        false,
        null,
        null,
        error,
      )
    : providerFailure(error);

const directMessageFailureForSignal = (
  error: unknown,
  signal: AbortSignal | undefined,
): DiscordCoreError => {
  if (signal?.aborted === true) return providerFailureForSignal(error, signal);
  if (error instanceof DiscordAPIError && error.code === 50_007) {
    return new DiscordCoreError(
      "DISCORD_RECIPIENT_UNREACHABLE",
      "Discord recipient cannot receive direct messages.",
      false,
      error.status,
    );
  }
  return providerFailure(error);
};

const commandCollectionRoute = (scope: DiscordCommandPublicationScope): `/${string}` =>
  scope.kind === "global"
    ? Routes.applicationCommands(parseDiscordSnowflake(scope.applicationId, "Discord application id"))
    : Routes.applicationGuildCommands(
        parseDiscordSnowflake(scope.applicationId, "Discord application id"),
        parseDiscordSnowflake(scope.guildId, "Discord guild id"),
      );

const commandItemRoute = (
  scope: DiscordCommandPublicationScope,
  providerCommandId: string,
): `/${string}` => {
  const applicationId = parseDiscordSnowflake(scope.applicationId, "Discord application id");
  const commandId = parseDiscordSnowflake(providerCommandId, "Discord command id");
  return scope.kind === "global"
    ? Routes.applicationCommand(applicationId, commandId)
    : Routes.applicationGuildCommand(
        applicationId,
        parseDiscordSnowflake(scope.guildId, "Discord guild id"),
        commandId,
      );
};

const normalizeRemoteApplicationCommand = (
  value: unknown,
  scope: DiscordCommandPublicationScope,
): DiscordRemoteApplicationCommand => {
  const record = responseRecord(value);
  const id = parseDiscordSnowflake(
    responseString(record, "id", "Discord application command id"),
    "Discord application command id",
  );
  const name = responseString(record, "name", "Discord application command name").trim();
  const type = record["type"];
  if (name.length < 1 || name.length > 32 || !Number.isSafeInteger(type)) {
    throw new DiscordCoreError(
      "DISCORD_RESPONSE_INVALID",
      "Discord application command response is malformed.",
      false,
    );
  }
  const kind =
    type === 1 ? "chat_input" : type === 2 ? "user" : type === 3 ? "message" : "unknown";
  return Object.freeze({
    id,
    name,
    kind,
    fingerprint:
      kind === "chat_input" ? fingerprintDiscordChatInputCommand(record, scope.kind) : null,
  });
};

/**
 * Safe facade over the provider REST SDK. The internal SDK owns shared/global
 * bucket coordination, route queues and Retry-After waits; bot products never
 * depend on the provider library directly.
 */
export class NodeDiscordRestAdapter
  implements DiscordApplicationCommandsRestPort, DiscordMessageDeliveryPort
{
  readonly #rest: REST;

  public constructor(options: NodeDiscordRestOptions) {
    const rest = new REST({
      version: "10",
      timeout: boundedInteger(options.timeoutMs, 15_000, 100, 30_000, "timeoutMs"),
      retries: boundedInteger(options.retries, 3, 0, 5, "retries"),
      globalRequestsPerSecond: boundedInteger(
        options.globalRequestsPerSecond,
        50,
        1,
        50,
        "globalRequestsPerSecond",
      ),
      invalidRequestWarningInterval: boundedInteger(
        options.invalidRequestWarningInterval,
        250,
        0,
        10_000,
        "invalidRequestWarningInterval",
      ),
      userAgentAppendix: "DiscordBot (https://github.com/Anto426-Project/discord-bot-core, 0.1.0)",
    });
    rest.setToken(validatedToken(options.botToken));
    this.#rest = rest;
  }

  public toJSON(): Readonly<{ component: "node-discord-rest-adapter" }> {
    return Object.freeze({ component: "node-discord-rest-adapter" });
  }

  public async listApplicationCommands(
    scope: DiscordCommandPublicationScope,
    signal?: AbortSignal,
  ): Promise<readonly DiscordRemoteApplicationCommand[]> {
    let response: unknown;
    try {
      response = await this.#rest.get(commandCollectionRoute(scope), {
        query: new URLSearchParams({ with_localizations: "true" }),
        ...(signal === undefined ? {} : { signal }),
      });
    } catch (error: unknown) {
      throw providerFailureForSignal(error, signal);
    }
    if (!Array.isArray(response) || response.length > 200) {
      throw new DiscordCoreError(
        "DISCORD_RESPONSE_INVALID",
        "Discord application command list response is invalid.",
        false,
      );
    }
    const ids = new Set<string>();
    const typedNames = new Set<string>();
    return Object.freeze(
      response.map((entry) => {
        const command = normalizeRemoteApplicationCommand(entry, scope);
        const typedName = `${command.kind}:${command.name}`;
        if (ids.has(command.id) || typedNames.has(typedName)) {
          throw new DiscordCoreError(
            "DISCORD_RESPONSE_INVALID",
            "Discord application command list contains duplicates.",
            false,
          );
        }
        ids.add(command.id);
        typedNames.add(typedName);
        return command;
      }),
    );
  }

  public async createApplicationCommand(
    scope: DiscordCommandPublicationScope,
    command: DiscordApplicationCommandBody,
    signal?: AbortSignal,
  ): Promise<DiscordRemoteApplicationCommand> {
    try {
      const response = await this.#rest.post(commandCollectionRoute(scope), {
        body: command,
        ...(signal === undefined ? {} : { signal }),
      });
      return normalizeRemoteApplicationCommand(response, scope);
    } catch (error: unknown) {
      throw providerFailureForSignal(error, signal);
    }
  }

  public async updateApplicationCommand(
    scope: DiscordCommandPublicationScope,
    providerCommandId: string,
    command: DiscordApplicationCommandBody,
    signal?: AbortSignal,
  ): Promise<DiscordRemoteApplicationCommand> {
    try {
      const response = await this.#rest.patch(commandItemRoute(scope, providerCommandId), {
        body: command,
        ...(signal === undefined ? {} : { signal }),
      });
      return normalizeRemoteApplicationCommand(response, scope);
    } catch (error: unknown) {
      throw providerFailureForSignal(error, signal);
    }
  }

  public async deleteApplicationCommand(
    scope: DiscordCommandPublicationScope,
    providerCommandId: string,
    signal?: AbortSignal,
  ): Promise<"deleted" | "already_absent"> {
    try {
      await this.#rest.delete(commandItemRoute(scope, providerCommandId), {
        ...(signal === undefined ? {} : { signal }),
      });
      return "deleted";
    } catch (error: unknown) {
      if (providerStatus(error) === 404) return "already_absent";
      throw providerFailureForSignal(error, signal);
    }
  }

  public async sendChannelMessage(
    input: DiscordChannelMessageDelivery,
  ): Promise<DiscordDeliveryReceipt> {
    const channelId = parseDiscordSnowflake(input.channelId, "Discord channel id");
    return this.sendMessageToChannel(channelId, input.message, input.signal, false);
  }

  private async sendMessageToChannel(
    channelId: string,
    message: DiscordChannelMessageDelivery["message"],
    signal: AbortSignal | undefined,
    classifyRecipientUnreachable: boolean,
  ): Promise<DiscordDeliveryReceipt> {
    let response: unknown;
    try {
      response = await this.#rest.post(Routes.channelMessages(channelId), {
        body: createSafeDiscordMessage(message, channelId),
        ...(signal === undefined ? {} : { signal }),
      });
    } catch (error: unknown) {
      throw classifyRecipientUnreachable
        ? directMessageFailureForSignal(error, signal)
        : providerFailureForSignal(error, signal);
    }
    return this.deliveryReceipt(response, channelId);
  }

  public async sendDirectMessage(
    input: DiscordDirectMessageDelivery,
  ): Promise<DiscordDeliveryReceipt> {
    const recipientId = parseDiscordSnowflake(input.recipientId, "Discord recipient id");
    let response: unknown;
    try {
      response = await this.#rest.post(Routes.userChannels(), {
        body: Object.freeze({ recipient_id: recipientId }),
        ...(input.signal === undefined ? {} : { signal: input.signal }),
      });
    } catch (error: unknown) {
      throw directMessageFailureForSignal(error, input.signal);
    }
    const channelId = parseDiscordSnowflake(
      responseString(responseRecord(response), "id", "Discord DM channel id"),
      "Discord DM channel id",
    );
    return this.sendMessageToChannel(channelId, input.message, input.signal, true);
  }

  private deliveryReceipt(value: unknown, expectedChannelId: string): DiscordDeliveryReceipt {
    const record = responseRecord(value);
    const channelId = parseDiscordSnowflake(
      responseString(record, "channel_id", "Discord message channel id"),
      "Discord message channel id",
    );
    if (channelId !== expectedChannelId) {
      throw new DiscordCoreError(
        "DISCORD_RESPONSE_INVALID",
        "Discord message receipt does not match its destination.",
        false,
      );
    }
    return Object.freeze({
      messageId: parseDiscordSnowflake(
        responseString(record, "id", "Discord message id"),
        "Discord message id",
      ),
      channelId,
    });
  }
}

export interface NodeDiscordRuntimeOptions {
  readonly botToken: string;
  readonly gateway: Omit<NodeDiscordGatewayOptions, "botToken">;
  readonly rest?: Omit<NodeDiscordRestOptions, "botToken">;
}

export type NodeDiscordRuntimeServices = Readonly<{
  gateway: DiscordGatewayRuntimePort;
  extensions: NodeDiscordProviderExtensionHostPort;
  inspection: DiscordGatewayInspectionPort;
  guilds: DiscordGuildDirectoryPort;
  profiles: DiscordProfileQueryPort;
  presence: DiscordPresencePort;
  commands: DiscordApplicationCommandsRestPort;
  messages: DiscordMessageDeliveryPort;
}>;

/**
 * Composes one SDK-owned gateway and one SDK-owned REST coordinator behind
 * stable core ports. Products never receive either provider client.
 */
export const createNodeDiscordRuntime = (
  options: NodeDiscordRuntimeOptions,
): NodeDiscordRuntimeServices => {
  const gateway = new NodeDiscordGatewayAdapter({
    ...options.gateway,
    botToken: options.botToken,
  });
  const rest = new NodeDiscordRestAdapter({
    ...(options.rest ?? {}),
    botToken: options.botToken,
  });
  return Object.freeze({
    gateway,
    extensions: gateway,
    inspection: gateway,
    guilds: gateway,
    profiles: gateway,
    presence: gateway,
    commands: rest,
    messages: rest,
  });
};
