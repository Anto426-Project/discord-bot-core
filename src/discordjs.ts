import { createHash } from "node:crypto";

import {
  ActivityType,
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleKeywordPresetType,
  AutoModerationRuleTriggerType,
  BaseInteraction,
  ChannelType,
  Client,
  DiscordAPIError,
  Events,
  GatewayIntentBits,
  HTTPError,
  MessageFlags,
  OverwriteType,
  Partials,
  PermissionFlagsBits,
  REST,
  RateLimitError,
  Routes,
  version as discordJsVersion,
  type ChatInputCommandInteraction,
  type AutoModerationActionExecution,
  type AutoModerationRule,
  type AutoModerationRuleCreateOptions,
  type Guild,
  type GuildBasedChannel,
  type GuildMember,
  type GuildTextBasedChannel,
  type Interaction,
  type Message,
  type OverwriteData,
  type PartialGuildMember,
  type PermissionOverwriteOptions,
  type RepliableInteraction,
  type Role,
  type User,
  type VoiceState,
} from "discord.js";

import type {
  DiscordAutoModOperationReceipt,
  DiscordBotAutoModDeleteMessageInput,
  DiscordBotAutoModPort,
  DiscordBotAutoModTimeoutMemberInput,
  DiscordNativeAutoModAction,
  DiscordNativeAutoModCreateInput,
  DiscordNativeAutoModDeleteInput,
  DiscordNativeAutoModEventType,
  DiscordNativeAutoModKeywordPreset,
  DiscordNativeAutoModListInput,
  DiscordNativeAutoModMutationReceipt,
  DiscordNativeAutoModPort,
  DiscordNativeAutoModReadInput,
  DiscordNativeAutoModRulePlan,
  DiscordNativeAutoModRuleSnapshot,
  DiscordNativeAutoModTrigger,
  DiscordNativeAutoModUpdateInput,
} from "./automod.js";

import type { DiscordApplicationCommandBody } from "./command-model.js";
import {
  fingerprintDiscordChatInputCommand,
  type DiscordApplicationCommandsRestPort,
  type DiscordCommandPublicationScope,
  type DiscordRemoteApplicationCommand,
} from "./command-publisher.js";
import type {
  DiscordGatewayEvent,
  DiscordGatewayEventListener,
  DiscordGatewayEventPort,
  DiscordGatewayMessageCreatedEvent,
  DiscordGatewayNativeAutoModAction,
} from "./gateway-events.js";
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
  DiscordGatewayRuntimeCondition,
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
import type {
  DiscordGuildChannelKind,
  DiscordGuildChannelReadInput,
  DiscordGuildChannelSnapshot,
  DiscordGuildMemberReadInput,
  DiscordGuildResourcePort,
  DiscordGuildRoleReadInput,
  DiscordMemberRoleMutationInput,
  DiscordMemberRoleMutationReceipt,
} from "./guild-resources.js";
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
import type {
  DiscordBanMemberInput,
  DiscordDeleteRecentMessagesInput,
  DiscordKickMemberInput,
  DiscordMemberModerationReceipt,
  DiscordMessageCleanupReceipt,
  DiscordModerationActorFacts,
  DiscordModerationActorFactsInput,
  DiscordModerationChannelFactsInput,
  DiscordModerationMemberFacts,
  DiscordModerationMemberFactsInput,
  DiscordModerationPermission,
  DiscordModerationPort,
  DiscordUnbanMemberInput,
} from "./moderation.js";
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
import type {
  DiscordVoiceRoomCreateInput,
  DiscordVoiceRoomDeleteInput,
  DiscordVoiceRoomDeleteOverwriteInput,
  DiscordVoiceRoomMoveMemberInput,
  DiscordVoiceRoomOperationReceipt,
  DiscordVoiceRoomOverwriteTarget,
  DiscordVoiceRoomPermission,
  DiscordVoiceRoomPermissionOverwrite,
  DiscordVoiceRoomPort,
  DiscordVoiceRoomUpdateInput,
  DiscordVoiceRoomUpsertOverwriteInput,
} from "./voice-rooms.js";

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
  readonly interactionTimeoutMs?: number;
  readonly queryTimeoutMs?: number;
  readonly maximumConcurrentQueries?: number;
  readonly memberRoleOperationLedgerCapacity?: number;
  readonly memberRoleOperationLedgerTtlMs?: number;
  readonly maximumConcurrentInteractions?: number;
  readonly interactionOverloadContent?: string;
  readonly maximumGatewayEventListeners?: number;
  readonly maximumGatewayEventBacklog?: number;
}

export interface NodeDiscordRestOptions {
  readonly botToken: string;
  readonly timeoutMs?: number;
  readonly retries?: number;
  readonly globalRequestsPerSecond?: number;
  readonly invalidRequestWarningInterval?: number;
}

const NODE_DISCORD_GATEWAY_REST_OPTIONS = Symbol("node-discord-gateway-rest-options");
const NODE_DISCORD_REST_PROVIDER = Symbol("node-discord-rest-provider");

type InternalNodeDiscordGatewayOptions = NodeDiscordGatewayOptions &
  Readonly<{
    [NODE_DISCORD_GATEWAY_REST_OPTIONS]?: Omit<NodeDiscordRestOptions, "botToken">;
  }>;

type InternalNodeDiscordRestOptions = NodeDiscordRestOptions &
  Readonly<{
    [NODE_DISCORD_REST_PROVIDER]?: () => REST;
  }>;

type NodeDiscordClientOptions = Readonly<{
  intents: readonly DiscordGatewayIntent[];
  acknowledgedPrivilegedIntents?: readonly DiscordPrivilegedGatewayIntent[];
  partials?: readonly DiscordGatewayPartial[];
  closeTimeoutMs?: number;
  waitGuildTimeoutMs?: number;
  rest?: Omit<NodeDiscordRestOptions, "botToken">;
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

const validatedInteractionOverloadContent = (value: string | undefined): string => {
  const normalized = (value ?? "Service temporarily unavailable.").trim();
  if (
    normalized.length < 1 ||
    normalized.length > 400 ||
    [...normalized].length > 200 ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new RangeError("interactionOverloadContent must contain from 1 to 200 safe characters.");
  }
  return normalized;
};

const nodeDiscordRestSdkOptions = (
  options: Omit<NodeDiscordRestOptions, "botToken"> | undefined,
) => Object.freeze({
  version: "10",
  timeout: boundedInteger(options?.timeoutMs, 15_000, 100, 30_000, "timeoutMs"),
  retries: boundedInteger(options?.retries, 3, 0, 5, "retries"),
  globalRequestsPerSecond: boundedInteger(
    options?.globalRequestsPerSecond,
    50,
    1,
    50,
    "globalRequestsPerSecond",
  ),
  invalidRequestWarningInterval: boundedInteger(
    options?.invalidRequestWarningInterval,
    250,
    0,
    10_000,
    "invalidRequestWarningInterval",
  ),
  userAgentAppendix: "DiscordBot (https://github.com/Anto426-Project/discord-bot-core, 0.1.0)",
});

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
    rest: nodeDiscordRestSdkOptions(options.rest),
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

const responseNullableSnowflake = (value: unknown, label: string): string | null =>
  value === null ? null : responseSnowflake(value, label);

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

const memberRoleIds = (
  member: GuildMember | PartialGuildMember,
  expectedGuildId: string,
): readonly string[] => {
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
  member: GuildMember | PartialGuildMember,
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

const guildChannelKind = (type: ChannelType): DiscordGuildChannelKind => {
  switch (type) {
    case ChannelType.GuildText:
      return "text";
    case ChannelType.GuildAnnouncement:
      return "announcement";
    case ChannelType.GuildForum:
      return "forum";
    case ChannelType.GuildMedia:
      return "media";
    case ChannelType.GuildVoice:
      return "voice";
    case ChannelType.GuildStageVoice:
      return "stage_voice";
    case ChannelType.GuildCategory:
      return "category";
    case ChannelType.AnnouncementThread:
    case ChannelType.PublicThread:
    case ChannelType.PrivateThread:
      return "thread";
    default:
      return "other";
  }
};

const guildChannelSnapshot = (
  channel: GuildBasedChannel,
  agent: GuildMember,
  expectedGuildId: string,
): DiscordGuildChannelSnapshot => {
  const guildId = responseSnowflake(channel.guildId, "Discord channel guild id");
  if (guildId !== expectedGuildId || channel.guild.id !== expectedGuildId) {
    throw new DiscordCoreError(
      "DISCORD_RESPONSE_INVALID",
      "Discord channel belongs to another guild.",
      false,
    );
  }
  if (agent.guild.id !== expectedGuildId) {
    throw new DiscordCoreError(
      "DISCORD_RESPONSE_INVALID",
      "Discord channel permission subject belongs to another guild.",
      false,
    );
  }
  const permissions = channel.permissionsFor(agent);
  return Object.freeze({
    guildId,
    id: responseSnowflake(channel.id, "Discord channel id"),
    name: responseTextValue(channel.name, 1, 100, "Discord channel name"),
    kind: guildChannelKind(channel.type),
    parentId: responseNullableSnowflake(channel.parentId, "Discord channel parent id"),
    textBased: responseBoolean(channel.isTextBased(), "Discord channel text-based flag"),
    voiceBased: responseBoolean(channel.isVoiceBased(), "Discord channel voice-based flag"),
    agentCanView: permissions.has(PermissionFlagsBits.ViewChannel),
    agentCanSendMessages: permissions.has(PermissionFlagsBits.SendMessages),
    agentCanEmbedLinks: permissions.has(PermissionFlagsBits.EmbedLinks),
    agentCanAttachFiles: permissions.has(PermissionFlagsBits.AttachFiles),
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

const inputTextValue = (
  value: unknown,
  minimum: number,
  maximum: number,
  label: string,
): string => {
  if (
    typeof value !== "string" ||
    value.length < minimum ||
    value.length > maximum ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new DiscordCoreError("DISCORD_INVALID_INPUT", `${label} is invalid.`, false);
  }
  return value;
};

const inputInteger = (
  value: unknown,
  minimum: number,
  maximum: number,
  label: string,
): number => {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new DiscordCoreError("DISCORD_INVALID_INPUT", `${label} is invalid.`, false);
  }
  return value as number;
};

const inputBoolean = (value: unknown, label: string): boolean => {
  if (typeof value !== "boolean") {
    throw new DiscordCoreError("DISCORD_INVALID_INPUT", `${label} is invalid.`, false);
  }
  return value;
};

const inputDenseArray = <T>(
  value: unknown,
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
    throw new DiscordCoreError("DISCORD_INVALID_INPUT", `${label} is invalid.`, false);
  }
  const result: T[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new DiscordCoreError("DISCORD_INVALID_INPUT", `${label} is invalid.`, false);
    }
    result.push(descriptor.value as T);
  }
  return Object.freeze(result);
};

const inputSignalFrom = (input: unknown, label: string): AbortSignal | undefined =>
  inputAbortSignal(inputDataProperty(input, "signal", `${label} signal`, true), `${label} signal`);

const inputDeadlineEpochMsFrom = (input: unknown, label: string): number | undefined => {
  const value = inputDataProperty(input, "deadlineEpochMs", `${label} deadline`, true);
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new DiscordCoreError(
      "DISCORD_INVALID_INPUT",
      `${label} deadline is invalid.`,
      false,
    );
  }
  return value as number;
};

const inputOperationId = (input: unknown, label: string): string =>
  inputTextValue(inputDataProperty(input, "operationId", label), 1, 256, label);

const inputAuditReason = (input: unknown, label: string): string =>
  inputTextValue(inputDataProperty(input, "auditReason", label), 1, 512, label);

const responseStringArray = (
  value: unknown,
  maximumItems: number,
  maximumLength: number,
  label: string,
  snowflakes = false,
): readonly string[] => {
  if (!Array.isArray(value) || value.length > maximumItems) {
    throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", `${label} is invalid.`, false);
  }
  const result: string[] = [];
  const unique = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", `${label} is invalid.`, false);
    }
    const item = snowflakes
      ? responseSnowflake(descriptor.value, label)
      : responseTextValue(descriptor.value, 0, maximumLength, label);
    if (unique.has(item)) {
      throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", `${label} is invalid.`, false);
    }
    unique.add(item);
    result.push(item);
  }
  return Object.freeze(result);
};

const observedAt = (): string => new Date().toISOString();

const guildGatewayEvent = (
  type: "guild_created" | "guild_deleted",
  guild: Guild,
): DiscordGatewayEvent =>
  Object.freeze({
    type,
    guildId: responseSnowflake(guild.id, "Discord guild event id"),
    name: responseTextValue(guild.name, 1, 100, "Discord guild event name"),
    preferredLocale: responseTextValue(
      guild.preferredLocale,
      2,
      32,
      "Discord guild preferred locale",
    ),
    shardId: responseBoundedInteger(guild.shardId, 0, 4_095, "Discord guild shard id"),
    joinedAt: responseNullableTimestamp(guild.joinedAt, "Discord guild join timestamp"),
    observedAt: observedAt(),
  });

const memberRoles = (
  member: GuildMember | PartialGuildMember,
  expectedGuildId: string,
): readonly DiscordGuildRoleSnapshot[] => {
  if (member.roles.cache.size > MAXIMUM_GUILD_ROLES) {
    throw new DiscordCoreError(
      "DISCORD_RESPONSE_TOO_LARGE",
      "Discord member role collection exceeds its limit.",
      false,
    );
  }
  const roles = [...member.roles.cache.values()]
    .map((role) => roleSnapshot(role, expectedGuildId))
    .sort((left, right) => left.id.localeCompare(right.id, "en"));
  return Object.freeze(roles);
};

const memberGatewayEvent = (
  type:
    | "guild_member_added"
    | "guild_member_updated"
    | "guild_member_removed",
  member: GuildMember | PartialGuildMember,
): DiscordGatewayEvent => {
  const guildId = responseSnowflake(member.guild.id, "Discord member event guild id");
  const snapshot = memberSnapshot(member, guildId);
  const roles = memberRoles(member, guildId);
  if (
    roles.length !== snapshot.roleIds.length ||
    roles.some((role, index) => role.id !== snapshot.roleIds[index])
  ) {
    throw new DiscordCoreError(
      "DISCORD_RESPONSE_INVALID",
      "Discord member event roles are inconsistent.",
      false,
    );
  }
  return Object.freeze({
    type,
    guildId,
    userId: snapshot.userId,
    member: snapshot,
    roles,
    observedAt: observedAt(),
  });
};

const removedMemberGatewayEvent = (
  member: GuildMember | PartialGuildMember,
): DiscordGatewayEvent => {
  const guildId = responseSnowflake(member.guild.id, "Discord member event guild id");
  const userId = responseSnowflake(member.id, "Discord member event user id");
  try {
    return memberGatewayEvent("guild_member_removed", member);
  } catch {
    // Discord may emit a PartialGuildMember after cache loss. Removal still
    // has a trustworthy guild/user identity, while the unavailable snapshot
    // is made explicit instead of fabricating role or profile facts.
    return Object.freeze({
      type: "guild_member_removed",
      guildId,
      userId,
      member: null,
      roles: Object.freeze([]),
      observedAt: observedAt(),
    });
  }
};

const voiceStateGatewayEvent = (
  previous: VoiceState,
  current: VoiceState,
): DiscordGatewayEvent => {
  const guildId = responseSnowflake(current.guild.id, "Discord voice-state guild id");
  const previousGuildId = responseSnowflake(previous.guild.id, "Discord voice-state guild id");
  const userId = responseSnowflake(current.id, "Discord voice-state user id");
  if (previousGuildId !== guildId || previous.id !== userId) {
    throw new DiscordCoreError(
      "DISCORD_RESPONSE_INVALID",
      "Discord voice-state transition is inconsistent.",
      false,
    );
  }
  return Object.freeze({
    type: "voice_state_changed",
    guildId,
    userId,
    providerSessionId: responseNullableTextValue(
      current.sessionId ?? previous.sessionId,
      256,
      "Discord voice-state session id",
    ),
    previousChannelId:
      previous.channelId === null
        ? null
        : responseSnowflake(previous.channelId, "Discord previous voice channel id"),
    currentChannelId:
      current.channelId === null
        ? null
        : responseSnowflake(current.channelId, "Discord current voice channel id"),
    observedAt: observedAt(),
  });
};

const messageFingerprint = (content: string): string | null => {
  const canonical = content
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("en-US");
  return canonical.length === 0
    ? null
    : createHash("sha256").update(canonical, "utf8").digest("hex");
};

const messageGatewayEvent = (message: Message): DiscordGatewayMessageCreatedEvent | null => {
  if (!message.inGuild()) return null;
  const guildId = responseSnowflake(message.guildId, "Discord message guild id");
  const member = message.member;
  const roleIds = member === null ? Object.freeze([]) : memberRoleIds(member, guildId);
  const moderationExempt =
    member?.permissions.has(PermissionFlagsBits.Administrator) === true ||
    member?.permissions.has(PermissionFlagsBits.ManageMessages) === true ||
    member?.permissions.has(PermissionFlagsBits.ModerateMembers) === true;
  return Object.freeze({
    type: "message_created",
    messageId: responseSnowflake(message.id, "Discord message id"),
    guildId,
    channelId: responseSnowflake(message.channelId, "Discord message channel id"),
    authorUserId: responseSnowflake(message.author.id, "Discord message author id"),
    roleIds,
    createdAt: responseTimestamp(message.createdAt, "Discord message creation timestamp"),
    accountCreatedAt: responseTimestamp(
      message.author.createdAt,
      "Discord message author creation timestamp",
    ),
    automated: responseBoolean(
      message.author.bot || message.webhookId !== null,
      "Discord automated-author flag",
    ),
    moderationExempt,
    contentFingerprint: messageFingerprint(message.content),
  });
};

const gatewayNativeAutoModAction = (
  action: AutoModerationActionType,
): DiscordGatewayNativeAutoModAction => {
  switch (action) {
    case AutoModerationActionType.BlockMessage:
      return "block_message";
    case AutoModerationActionType.SendAlertMessage:
      return "send_alert";
    case AutoModerationActionType.Timeout:
      return "timeout";
    case AutoModerationActionType.BlockMemberInteraction:
      return "block_member_interaction";
  }
};

const nativeAutoModGatewayEvent = (
  execution: AutoModerationActionExecution,
): DiscordGatewayEvent => {
  const guildId = responseSnowflake(execution.guild.id, "Discord AutoMod guild id");
  const providerRuleId = responseSnowflake(execution.ruleId, "Discord AutoMod rule id");
  const actorUserId = responseSnowflake(execution.userId, "Discord AutoMod actor id");
  const channelId = execution.channelId === null
    ? null
    : responseSnowflake(execution.channelId, "Discord AutoMod channel id");
  const messageId = execution.messageId === null
    ? null
    : responseSnowflake(execution.messageId, "Discord AutoMod message id");
  const action = gatewayNativeAutoModAction(execution.action.type);
  const eventId = [
    guildId,
    providerRuleId,
    actorUserId,
    channelId ?? "none",
    messageId ?? "none",
    action,
  ].join(":");
  return Object.freeze({
    type: "native_automod_executed",
    eventId,
    guildId,
    providerRuleId,
    actorUserId,
    channelId,
    messageId,
    action,
    observedAt: observedAt(),
  });
};

const MODERATION_PERMISSION_FLAGS: Readonly<
  Record<DiscordModerationPermission, bigint>
> = Object.freeze({
  manage_messages: PermissionFlagsBits.ManageMessages,
  kick_members: PermissionFlagsBits.KickMembers,
  ban_members: PermissionFlagsBits.BanMembers,
});

const moderationPermission = (
  value: unknown,
  allowManageMessages: boolean,
): DiscordModerationPermission => {
  if (
    value !== "kick_members" &&
    value !== "ban_members" &&
    (!allowManageMessages || value !== "manage_messages")
  ) {
    throw new DiscordCoreError(
      "DISCORD_INVALID_INPUT",
      "Discord moderation permission is invalid.",
      false,
    );
  }
  return value;
};

const resolveGuild = async (client: Client, guildId: string): Promise<Guild> => {
  const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
  if (guild.id !== guildId) {
    throw new DiscordCoreError(
      "DISCORD_RESPONSE_INVALID",
      "Discord guild response does not match the requested guild.",
      false,
    );
  }
  return guild;
};

const fetchMemberOrNull = async (
  guild: Guild,
  userId: string,
): Promise<GuildMember | null> => {
  try {
    const member = await guild.members.fetch({ user: userId, force: true, cache: true });
    if (member.id !== userId || member.guild.id !== guild.id) {
      throw new DiscordCoreError(
        "DISCORD_RESPONSE_INVALID",
        "Discord member response does not match the requested member.",
        false,
      );
    }
    return member;
  } catch (error: unknown) {
    if (isProviderNotFoundError(error)) return null;
    throw error;
  }
};

const fetchGuildRoles = async (guild: Guild): Promise<ReadonlyMap<string, Role>> => {
  const roles = await guild.roles.fetch();
  if (roles.size > MAXIMUM_GUILD_ROLES) {
    throw new DiscordCoreError(
      "DISCORD_RESPONSE_TOO_LARGE",
      "Discord guild role collection exceeds its limit.",
      false,
    );
  }
  for (const [collectionId, role] of roles) {
    if (collectionId !== role.id || role.guild.id !== guild.id) {
      throw new DiscordCoreError(
        "DISCORD_RESPONSE_INVALID",
        "Discord guild role collection is inconsistent.",
        false,
      );
    }
  }
  return roles;
};

const fetchGuildChannelOrNull = async (
  guild: Guild,
  channelId: string,
): Promise<GuildBasedChannel | null> => {
  try {
    const channel = await guild.channels.fetch(channelId, { cache: true, force: true });
    if (channel === null) return null;
    if (channel.id !== channelId || channel.guildId !== guild.id || channel.guild.id !== guild.id) {
      throw new DiscordCoreError(
        "DISCORD_RESPONSE_INVALID",
        "Discord channel response does not match the requested channel.",
        false,
      );
    }
    return channel;
  } catch (error: unknown) {
    if (isProviderNotFoundError(error)) return null;
    throw error;
  }
};

const guildResourceAgentUserId = (client: Client): string => {
  if (client.user === null) {
    throw new DiscordCoreError(
      "DISCORD_CIRCUIT_OPEN",
      "Discord guild resources are unavailable before gateway readiness.",
      true,
    );
  }
  return responseSnowflake(client.user.id, "Discord guild-resource agent id");
};

const denyMemberRoleMutation = (summary: string): never => {
  throw new DiscordCoreError("DISCORD_PROVIDER_FAILURE", summary, false, 403);
};

const assertMemberRoleMutationAllowed = (
  guild: Guild,
  member: GuildMember,
  agent: GuildMember,
  role: Role,
): void => {
  if (
    member.guild.id !== guild.id ||
    agent.guild.id !== guild.id ||
    role.guild.id !== guild.id
  ) {
    throw new DiscordCoreError(
      "DISCORD_RESPONSE_INVALID",
      "Discord member-role resources do not belong to one guild.",
      false,
    );
  }
  if (!agent.permissions.has(PermissionFlagsBits.ManageRoles)) {
    denyMemberRoleMutation("Discord agent lacks Manage Roles permission.");
  }
  if (role.id === guild.id) {
    denyMemberRoleMutation("Discord @everyone role cannot be assigned or removed.");
  }
  if (responseBoolean(role.managed, "Discord role managed flag")) {
    denyMemberRoleMutation("Discord managed role cannot be assigned or removed.");
  }
  const agentOwnsGuild = agent.id === guild.ownerId;
  if (!agentOwnsGuild && agent.roles.highest.comparePositionTo(role) <= 0) {
    denyMemberRoleMutation("Discord role is not below the agent role hierarchy.");
  }
  if (
    member.id === guild.ownerId ||
    member.id === agent.id ||
    (!agentOwnsGuild && agent.roles.highest.comparePositionTo(member.roles.highest) <= 0)
  ) {
    denyMemberRoleMutation("Discord member is not below the agent role hierarchy.");
  }
  if (!responseBoolean(role.editable, "Discord role editable flag")) {
    denyMemberRoleMutation("Discord role is not editable by the current agent.");
  }
};

const moderationAgentUserId = (client: Client): string => {
  if (client.user === null) {
    throw new DiscordCoreError(
      "DISCORD_CIRCUIT_OPEN",
      "Discord moderation is unavailable before gateway readiness.",
      true,
    );
  }
  return responseSnowflake(client.user.id, "Discord moderation agent id");
};

const isMemberAbove = (
  guild: Guild,
  member: GuildMember | null,
  target: GuildMember | null,
): boolean => {
  if (member === null || target === null) return false;
  if (member.id === guild.ownerId) return true;
  if (target.id === guild.ownerId || member.id === target.id) return false;
  return member.roles.highest.comparePositionTo(target.roles.highest) > 0;
};

const actorModerationFacts = async (
  client: Client,
  guildId: string,
  actorUserId: string,
  requiredPermission: DiscordModerationPermission,
): Promise<Readonly<{
  guild: Guild;
  actor: GuildMember | null;
  agent: GuildMember | null;
  facts: DiscordModerationActorFacts;
}>> => {
  const guild = await resolveGuild(client, guildId);
  const agentUserId = moderationAgentUserId(client);
  const [actor, agent] = await Promise.all([
    fetchMemberOrNull(guild, actorUserId),
    fetchMemberOrNull(guild, agentUserId),
  ]);
  const permission = MODERATION_PERMISSION_FLAGS[requiredPermission];
  return Object.freeze({
    guild,
    actor,
    agent,
    facts: Object.freeze({
      guildId,
      actorUserId,
      agentUserId,
      requiredPermission,
      actorPresent: actor !== null,
      agentPresent: agent !== null,
      actorHasRequiredPermission: actor?.permissions.has(permission) === true,
      agentHasRequiredPermission: agent?.permissions.has(permission) === true,
    }),
  });
};

const memberModerationFacts = async (
  client: Client,
  guildId: string,
  actorUserId: string,
  targetUserId: string,
  requiredPermission: "kick_members" | "ban_members",
): Promise<DiscordModerationMemberFacts> => {
  const state = await actorModerationFacts(
    client,
    guildId,
    actorUserId,
    requiredPermission,
  );
  const target = await fetchMemberOrNull(state.guild, targetUserId);
  return Object.freeze({
    ...state.facts,
    targetUserId,
    targetDisplayName:
      target === null
        ? null
        : responseTextValue(target.displayName, 1, 128, "Discord target display name"),
    targetPresent: target !== null,
    targetIsGuildOwner: targetUserId === state.guild.ownerId,
    targetIsActor: targetUserId === actorUserId,
    targetIsAgent: targetUserId === state.facts.agentUserId,
    actorIsAboveTarget: isMemberAbove(state.guild, state.actor, target),
    agentIsAboveTarget: isMemberAbove(state.guild, state.agent, target),
  });
};

const inputStringArray = (
  value: unknown,
  minimumItems: number,
  maximumItems: number,
  maximumLength: number,
  label: string,
  snowflakes = false,
): readonly string[] => {
  const source = inputDenseArray<unknown>(value, minimumItems, maximumItems, label);
  const result: string[] = [];
  const unique = new Set<string>();
  for (const entry of source) {
    const item = snowflakes
      ? inputSnowflake(entry, label)
      : inputTextValue(entry, 1, maximumLength, label);
    if (unique.has(item)) {
      throw new DiscordCoreError("DISCORD_INVALID_INPUT", `${label} has duplicates.`, false);
    }
    unique.add(item);
    result.push(item);
  }
  return Object.freeze(result);
};

const NATIVE_AUTOMOD_PRESETS: Readonly<
  Record<DiscordNativeAutoModKeywordPreset, AutoModerationRuleKeywordPresetType>
> = Object.freeze({
  profanity: AutoModerationRuleKeywordPresetType.Profanity,
  sexual_content: AutoModerationRuleKeywordPresetType.SexualContent,
  slurs: AutoModerationRuleKeywordPresetType.Slurs,
});

const nativeAutoModPreset = (value: unknown): DiscordNativeAutoModKeywordPreset => {
  if (value !== "profanity" && value !== "sexual_content" && value !== "slurs") {
    throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Discord AutoMod preset is invalid.", false);
  }
  return value;
};

const nativeAutoModTrigger = (value: unknown): DiscordNativeAutoModTrigger => {
  const type = inputDataProperty(value, "type", "Discord AutoMod trigger");
  switch (type) {
    case "keyword":
    case "member_profile":
      return Object.freeze({
        type,
        keywordFilter: inputStringArray(
          inputDataProperty(value, "keywordFilter", "Discord AutoMod keyword filter"),
          0,
          1_000,
          60,
          "Discord AutoMod keyword filter",
        ),
        regexPatterns: inputStringArray(
          inputDataProperty(value, "regexPatterns", "Discord AutoMod regular expressions"),
          0,
          10,
          260,
          "Discord AutoMod regular expressions",
        ),
        allowList: inputStringArray(
          inputDataProperty(value, "allowList", "Discord AutoMod allow list"),
          0,
          100,
          60,
          "Discord AutoMod allow list",
        ),
      });
    case "spam":
      return Object.freeze({ type });
    case "keyword_preset": {
      const presets = inputDenseArray<unknown>(
        inputDataProperty(value, "presets", "Discord AutoMod presets"),
        1,
        3,
        "Discord AutoMod presets",
      ).map(nativeAutoModPreset);
      if (new Set(presets).size !== presets.length) {
        throw new DiscordCoreError(
          "DISCORD_INVALID_INPUT",
          "Discord AutoMod presets have duplicates.",
          false,
        );
      }
      return Object.freeze({
        type,
        presets: Object.freeze(presets),
        allowList: inputStringArray(
          inputDataProperty(value, "allowList", "Discord AutoMod allow list"),
          0,
          100,
          60,
          "Discord AutoMod allow list",
        ),
      });
    }
    case "mention_spam":
      return Object.freeze({
        type,
        mentionTotalLimit: inputInteger(
          inputDataProperty(value, "mentionTotalLimit", "Discord AutoMod mention limit"),
          1,
          50,
          "Discord AutoMod mention limit",
        ),
        raidProtectionEnabled: inputBoolean(
          inputDataProperty(value, "raidProtectionEnabled", "Discord AutoMod raid protection"),
          "Discord AutoMod raid protection",
        ),
      });
    default:
      throw new DiscordCoreError(
        "DISCORD_INVALID_INPUT",
        "Discord AutoMod trigger is invalid.",
        false,
      );
  }
};

const nativeAutoModAction = (value: unknown): DiscordNativeAutoModAction => {
  const type = inputDataProperty(value, "type", "Discord AutoMod action");
  switch (type) {
    case "block_message": {
      const customMessage = inputDataProperty(
        value,
        "customMessage",
        "Discord AutoMod block-message custom message",
        true,
      );
      return Object.freeze({
        type,
        ...(customMessage === undefined
          ? {}
          : {
              customMessage: inputTextValue(
                customMessage,
                1,
                150,
                "Discord AutoMod block-message custom message",
              ),
            }),
      });
    }
    case "send_alert":
      return Object.freeze({
        type,
        channelId: inputSnowflake(
          inputDataProperty(value, "channelId", "Discord AutoMod alert channel id"),
          "Discord AutoMod alert channel id",
        ),
      });
    case "timeout":
      return Object.freeze({
        type,
        durationSeconds: inputInteger(
          inputDataProperty(value, "durationSeconds", "Discord AutoMod timeout duration"),
          1,
          2_419_200,
          "Discord AutoMod timeout duration",
        ),
      });
    case "block_member_interaction":
      return Object.freeze({ type });
    default:
      throw new DiscordCoreError(
        "DISCORD_INVALID_INPUT",
        "Discord AutoMod action is invalid.",
        false,
      );
  }
};

const nativeAutoModRulePlan = (value: unknown): DiscordNativeAutoModRulePlan => {
  const eventType = inputDataProperty(value, "eventType", "Discord AutoMod event type");
  if (eventType !== "message_send" && eventType !== "member_update") {
    throw new DiscordCoreError(
      "DISCORD_INVALID_INPUT",
      "Discord AutoMod event type is invalid.",
      false,
    );
  }
  const actions = inputDenseArray<unknown>(
    inputDataProperty(value, "actions", "Discord AutoMod actions"),
    1,
    3,
    "Discord AutoMod actions",
  ).map(nativeAutoModAction);
  return Object.freeze({
    name: inputTextValue(
      inputDataProperty(value, "name", "Discord AutoMod rule name"),
      1,
      100,
      "Discord AutoMod rule name",
    ),
    eventType,
    trigger: nativeAutoModTrigger(
      inputDataProperty(value, "trigger", "Discord AutoMod trigger"),
    ),
    actions: Object.freeze(actions),
    enabled: inputBoolean(
      inputDataProperty(value, "enabled", "Discord AutoMod enabled flag"),
      "Discord AutoMod enabled flag",
    ),
    exemptRoleIds: inputStringArray(
      inputDataProperty(value, "exemptRoleIds", "Discord AutoMod exempt role ids"),
      0,
      20,
      20,
      "Discord AutoMod exempt role ids",
      true,
    ),
    exemptChannelIds: inputStringArray(
      inputDataProperty(value, "exemptChannelIds", "Discord AutoMod exempt channel ids"),
      0,
      20,
      20,
      "Discord AutoMod exempt channel ids",
      true,
    ),
  });
};

const providerAutoModTrigger = (
  trigger: DiscordNativeAutoModTrigger,
): Readonly<{
  triggerType: AutoModerationRuleTriggerType;
  triggerMetadata?: AutoModerationRuleCreateOptions["triggerMetadata"];
}> => {
  switch (trigger.type) {
    case "keyword":
      return Object.freeze({
        triggerType: AutoModerationRuleTriggerType.Keyword,
        triggerMetadata: Object.freeze({
          keywordFilter: trigger.keywordFilter,
          regexPatterns: trigger.regexPatterns,
          allowList: trigger.allowList,
        }),
      });
    case "member_profile":
      return Object.freeze({
        triggerType: AutoModerationRuleTriggerType.MemberProfile,
        triggerMetadata: Object.freeze({
          keywordFilter: trigger.keywordFilter,
          regexPatterns: trigger.regexPatterns,
          allowList: trigger.allowList,
        }),
      });
    case "spam":
      return Object.freeze({ triggerType: AutoModerationRuleTriggerType.Spam });
    case "keyword_preset":
      return Object.freeze({
        triggerType: AutoModerationRuleTriggerType.KeywordPreset,
        triggerMetadata: Object.freeze({
          presets: trigger.presets.map((preset) => NATIVE_AUTOMOD_PRESETS[preset]),
          allowList: trigger.allowList,
        }),
      });
    case "mention_spam":
      return Object.freeze({
        triggerType: AutoModerationRuleTriggerType.MentionSpam,
        triggerMetadata: Object.freeze({
          mentionTotalLimit: trigger.mentionTotalLimit,
          mentionRaidProtectionEnabled: trigger.raidProtectionEnabled,
        }),
      });
  }
};

const providerAutoModAction = (
  action: DiscordNativeAutoModAction,
): AutoModerationRuleCreateOptions["actions"][number] => {
  switch (action.type) {
    case "block_message":
      return Object.freeze({
        type: AutoModerationActionType.BlockMessage,
        ...(action.customMessage === undefined
          ? {}
          : { metadata: Object.freeze({ customMessage: action.customMessage }) }),
      });
    case "send_alert":
      return Object.freeze({
        type: AutoModerationActionType.SendAlertMessage,
        metadata: Object.freeze({ channel: action.channelId }),
      });
    case "timeout":
      return Object.freeze({
        type: AutoModerationActionType.Timeout,
        metadata: Object.freeze({ durationSeconds: action.durationSeconds }),
      });
    case "block_member_interaction":
      return Object.freeze({ type: AutoModerationActionType.BlockMemberInteraction });
  }
};

const providerAutoModRule = (
  rule: DiscordNativeAutoModRulePlan,
  auditReason: string,
): AutoModerationRuleCreateOptions => {
  const trigger = providerAutoModTrigger(rule.trigger);
  return Object.freeze({
    name: rule.name,
    eventType:
      rule.eventType === "message_send"
        ? AutoModerationRuleEventType.MessageSend
        : AutoModerationRuleEventType.MemberUpdate,
    triggerType: trigger.triggerType,
    ...(trigger.triggerMetadata === undefined
      ? {}
      : { triggerMetadata: trigger.triggerMetadata }),
    actions: Object.freeze(rule.actions.map(providerAutoModAction)),
    enabled: rule.enabled,
    exemptRoles: rule.exemptRoleIds,
    exemptChannels: rule.exemptChannelIds,
    reason: auditReason,
  });
};

const remoteAutoModEventType = (
  value: AutoModerationRuleEventType,
): DiscordNativeAutoModEventType => {
  switch (value) {
    case AutoModerationRuleEventType.MessageSend:
      return "message_send";
    case AutoModerationRuleEventType.MemberUpdate:
      return "member_update";
  }
};

const remoteAutoModPreset = (
  value: AutoModerationRuleKeywordPresetType,
): DiscordNativeAutoModKeywordPreset => {
  switch (value) {
    case AutoModerationRuleKeywordPresetType.Profanity:
      return "profanity";
    case AutoModerationRuleKeywordPresetType.SexualContent:
      return "sexual_content";
    case AutoModerationRuleKeywordPresetType.Slurs:
      return "slurs";
  }
};

const remoteAutoModTrigger = (rule: AutoModerationRule): DiscordNativeAutoModTrigger => {
  const metadata = rule.triggerMetadata;
  switch (rule.triggerType) {
    case AutoModerationRuleTriggerType.Keyword:
    case AutoModerationRuleTriggerType.MemberProfile:
      return Object.freeze({
        type:
          rule.triggerType === AutoModerationRuleTriggerType.Keyword
            ? "keyword"
            : "member_profile",
        keywordFilter: responseStringArray(
          metadata.keywordFilter,
          1_000,
          60,
          "Discord AutoMod keyword filter",
        ),
        regexPatterns: responseStringArray(
          metadata.regexPatterns,
          10,
          260,
          "Discord AutoMod regular expressions",
        ),
        allowList: responseStringArray(
          metadata.allowList,
          100,
          60,
          "Discord AutoMod allow list",
        ),
      });
    case AutoModerationRuleTriggerType.Spam:
      return Object.freeze({ type: "spam" });
    case AutoModerationRuleTriggerType.KeywordPreset:
      return Object.freeze({
        type: "keyword_preset",
        presets: Object.freeze(metadata.presets.map(remoteAutoModPreset)),
        allowList: responseStringArray(
          metadata.allowList,
          100,
          60,
          "Discord AutoMod allow list",
        ),
      });
    case AutoModerationRuleTriggerType.MentionSpam:
      return Object.freeze({
        type: "mention_spam",
        mentionTotalLimit: responseBoundedInteger(
          metadata.mentionTotalLimit,
          1,
          50,
          "Discord AutoMod mention limit",
        ),
        raidProtectionEnabled: responseBoolean(
          metadata.mentionRaidProtectionEnabled,
          "Discord AutoMod raid protection",
        ),
      });
  }
};

const remoteAutoModAction = (
  action: AutoModerationRule["actions"][number],
): DiscordNativeAutoModAction => {
  switch (action.type) {
    case AutoModerationActionType.BlockMessage:
      return Object.freeze({
        type: "block_message",
        ...(action.metadata.customMessage === null
          ? {}
          : {
              customMessage: responseTextValue(
                action.metadata.customMessage,
                1,
                150,
                "Discord AutoMod custom message",
              ),
            }),
      });
    case AutoModerationActionType.SendAlertMessage:
      return Object.freeze({
        type: "send_alert",
        channelId: responseSnowflake(
          action.metadata.channelId,
          "Discord AutoMod alert channel id",
        ),
      });
    case AutoModerationActionType.Timeout:
      return Object.freeze({
        type: "timeout",
        durationSeconds: responseBoundedInteger(
          action.metadata.durationSeconds,
          1,
          2_419_200,
          "Discord AutoMod timeout duration",
        ),
      });
    case AutoModerationActionType.BlockMemberInteraction:
      return Object.freeze({ type: "block_member_interaction" });
  }
};

const remoteAutoModRule = (
  rule: AutoModerationRule,
  agentUserId: string,
): DiscordNativeAutoModRuleSnapshot => {
  if (rule.actions.length < 1 || rule.actions.length > 3) {
    throw new DiscordCoreError(
      "DISCORD_RESPONSE_TOO_LARGE",
      "Discord AutoMod action collection is invalid.",
      false,
    );
  }
  const exemptRoleIds = responseStringArray(
    [...rule.exemptRoles.keys()],
    20,
    20,
    "Discord AutoMod exempt role ids",
    true,
  );
  const exemptChannelIds = responseStringArray(
    [...rule.exemptChannels.keys()],
    20,
    20,
    "Discord AutoMod exempt channel ids",
    true,
  );
  return Object.freeze({
    providerRuleId: responseSnowflake(rule.id, "Discord AutoMod rule id"),
    creatorUserId: responseSnowflake(rule.creatorId, "Discord AutoMod creator id"),
    managedByCurrentApplication: rule.creatorId === agentUserId,
    rule: Object.freeze({
      name: responseTextValue(rule.name, 1, 100, "Discord AutoMod rule name"),
      eventType: remoteAutoModEventType(rule.eventType),
      trigger: remoteAutoModTrigger(rule),
      actions: Object.freeze(rule.actions.map(remoteAutoModAction)),
      enabled: responseBoolean(rule.enabled, "Discord AutoMod enabled flag"),
      exemptRoleIds,
      exemptChannelIds,
    }),
  });
};

const VOICE_PERMISSION_FLAGS: Readonly<
  Record<DiscordVoiceRoomPermission, readonly [keyof typeof PermissionFlagsBits, bigint]>
> = Object.freeze({
  view_channel: ["ViewChannel", PermissionFlagsBits.ViewChannel],
  connect: ["Connect", PermissionFlagsBits.Connect],
  speak: ["Speak", PermissionFlagsBits.Speak],
  stream: ["Stream", PermissionFlagsBits.Stream],
  use_voice_activity: ["UseVAD", PermissionFlagsBits.UseVAD],
  send_messages: ["SendMessages", PermissionFlagsBits.SendMessages],
  embed_links: ["EmbedLinks", PermissionFlagsBits.EmbedLinks],
  read_message_history: ["ReadMessageHistory", PermissionFlagsBits.ReadMessageHistory],
  manage_channels: ["ManageChannels", PermissionFlagsBits.ManageChannels],
  manage_roles: ["ManageRoles", PermissionFlagsBits.ManageRoles],
  move_members: ["MoveMembers", PermissionFlagsBits.MoveMembers],
});

const voicePermission = (value: unknown): DiscordVoiceRoomPermission => {
  if (typeof value !== "string" || !(value in VOICE_PERMISSION_FLAGS)) {
    throw new DiscordCoreError(
      "DISCORD_INVALID_INPUT",
      "Discord voice-room permission is invalid.",
      false,
    );
  }
  return value as DiscordVoiceRoomPermission;
};

const voiceOverwriteTarget = (value: unknown): DiscordVoiceRoomOverwriteTarget => {
  const type = inputDataProperty(value, "type", "Discord voice-room overwrite target");
  if (type !== "member" && type !== "role") {
    throw new DiscordCoreError(
      "DISCORD_INVALID_INPUT",
      "Discord voice-room overwrite target is invalid.",
      false,
    );
  }
  return Object.freeze({
    type,
    id: inputSnowflake(
      inputDataProperty(value, "id", "Discord voice-room overwrite target id"),
      "Discord voice-room overwrite target id",
    ),
  });
};

const voicePermissionArray = (value: unknown, label: string): readonly DiscordVoiceRoomPermission[] => {
  const result = inputDenseArray<unknown>(value, 0, 11, label).map(voicePermission);
  if (new Set(result).size !== result.length) {
    throw new DiscordCoreError("DISCORD_INVALID_INPUT", `${label} has duplicates.`, false);
  }
  return Object.freeze(result);
};

const voicePermissionOverwrite = (
  value: unknown,
): DiscordVoiceRoomPermissionOverwrite => {
  const allow = voicePermissionArray(
    inputDataProperty(value, "allow", "Discord voice-room allowed permissions"),
    "Discord voice-room allowed permissions",
  );
  const deny = voicePermissionArray(
    inputDataProperty(value, "deny", "Discord voice-room denied permissions"),
    "Discord voice-room denied permissions",
  );
  if (allow.some((permission) => deny.includes(permission))) {
    throw new DiscordCoreError(
      "DISCORD_INVALID_INPUT",
      "Discord voice-room overwrite cannot allow and deny the same permission.",
      false,
    );
  }
  return Object.freeze({
    target: voiceOverwriteTarget(
      inputDataProperty(value, "target", "Discord voice-room overwrite target"),
    ),
    allow,
    deny,
  });
};

const providerVoiceOverwrite = (
  overwrite: DiscordVoiceRoomPermissionOverwrite,
): OverwriteData =>
  Object.freeze({
    id: overwrite.target.id,
    type: overwrite.target.type === "role" ? OverwriteType.Role : OverwriteType.Member,
    allow: Object.freeze(overwrite.allow.map((permission) => VOICE_PERMISSION_FLAGS[permission][1])),
    deny: Object.freeze(overwrite.deny.map((permission) => VOICE_PERMISSION_FLAGS[permission][1])),
  });

const providerVoiceOverwriteEdit = (
  overwrite: DiscordVoiceRoomPermissionOverwrite,
): PermissionOverwriteOptions => {
  const allow = new Set(overwrite.allow);
  const deny = new Set(overwrite.deny);
  const result: PermissionOverwriteOptions = {};
  for (const [permission, [providerName]] of Object.entries(VOICE_PERMISSION_FLAGS) as readonly (
    readonly [DiscordVoiceRoomPermission, readonly [keyof typeof PermissionFlagsBits, bigint]]
  )[]) {
    result[providerName] = allow.has(permission) ? true : deny.has(permission) ? false : null;
  }
  return Object.freeze(result);
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

type QueuedDiscordGatewayEvent = Readonly<{
  event: DiscordGatewayEvent;
  client: Client;
  generation: number;
}>;

const NODE_DISCORD_GATEWAY_REST_PROVIDERS = new WeakMap<object, () => REST>();

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

type MemberRoleOperationLedgerEntry = {
  readonly fingerprint: string;
  readonly expiresAtEpochMs: number;
  receipt: DiscordMemberRoleMutationReceipt | null;
};

export class NodeDiscordGatewayAdapter
  implements
    DiscordGatewayRuntimePort,
    NodeDiscordProviderExtensionHostPort,
    DiscordGatewayInspectionPort,
    DiscordGuildDirectoryPort,
    DiscordGuildResourcePort,
    DiscordProfileQueryPort,
    DiscordPresencePort,
    DiscordGatewayEventPort,
    DiscordModerationPort,
    DiscordBotAutoModPort,
    DiscordNativeAutoModPort,
    DiscordVoiceRoomPort
{
  #client: Client;
  readonly #clientFactory: () => Client;
  readonly #botToken: string;
  readonly #listeners = new Set<DiscordGatewayLifecycleListener>();
  readonly #interactionListeners = new Set<DiscordInteractionListener>();
  readonly #gatewayEventListeners = new Set<DiscordGatewayEventListener>();
  readonly #quarantinedLifecycleListeners = new Set<DiscordGatewayLifecycleListener>();
  readonly #quarantinedGatewayEventListeners = new Set<DiscordGatewayEventListener>();
  readonly #startupTimeoutMs: number;
  readonly #shutdownTimeoutMs: number;
  readonly #listenerTimeoutMs: number;
  readonly #interactionTimeoutMs: number;
  readonly #queryTimeoutMs: number;
  readonly #maximumConcurrentQueries: number;
  readonly #memberRoleOperationLedgerCapacity: number;
  readonly #memberRoleOperationLedgerTtlMs: number;
  readonly #memberRoleOperationLedger = new Map<string, MemberRoleOperationLedgerEntry>();
  readonly #maximumConcurrentInteractions: number;
  readonly #interactionOverloadContent: string;
  readonly #maximumGatewayEventListeners: number;
  readonly #maximumGatewayEventBacklog: number;
  readonly #providerExtensions = new Map<string, RegisteredNodeDiscordProviderExtension>();
  readonly #inFlightQueries = new Map<number, number>();
  readonly #gatewayEventQueue: QueuedDiscordGatewayEvent[] = [];
  readonly #pendingRuntimeRecoveries = new Set<
    | "DISCORD_GATEWAY_EVENT_BACKLOG_EXHAUSTED"
    | "DISCORD_GATEWAY_EVENT_LISTENER_QUARANTINED"
    | "DISCORD_INTERACTION_CAPACITY_EXHAUSTED"
    | "DISCORD_INTERACTION_ROUTER_QUARANTINED"
  >();
  readonly #quarantinedInteractionDeliveryCounts = new Map<DiscordInteractionListener, number>();
  readonly #interactionDeliveryTasks = new Set<Promise<void>>();
  #gatewayEventDrain: Promise<void> | null = null;
  #gatewayEventOverloaded = false;
  #activeInteractionDeliveries = 0;
  #interactionCapacityOverloaded = false;
  readonly #interactionOverloadResponses = new Set<Promise<void>>();
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
    const internalOptions = options as InternalNodeDiscordGatewayOptions;
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
      ...(internalOptions[NODE_DISCORD_GATEWAY_REST_OPTIONS] === undefined
        ? {}
        : { rest: internalOptions[NODE_DISCORD_GATEWAY_REST_OPTIONS] }),
    });
    this.#clientFactory = () => {
      const client = createClient(clientOptions);
      client.rest.setToken(this.#botToken);
      return client;
    };
    this.#client = this.#clientFactory();
    NODE_DISCORD_GATEWAY_REST_PROVIDERS.set(this, () => this.#client.rest);
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
    this.#interactionTimeoutMs = boundedInteger(
      options.interactionTimeoutMs,
      2_000,
      100,
      2_500,
      "interactionTimeoutMs",
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
    this.#memberRoleOperationLedgerCapacity = boundedInteger(
      options.memberRoleOperationLedgerCapacity,
      4_096,
      1,
      65_536,
      "memberRoleOperationLedgerCapacity",
    );
    this.#memberRoleOperationLedgerTtlMs = boundedInteger(
      options.memberRoleOperationLedgerTtlMs,
      900_000,
      1_000,
      86_400_000,
      "memberRoleOperationLedgerTtlMs",
    );
    this.#maximumConcurrentInteractions = boundedInteger(
      options.maximumConcurrentInteractions,
      32,
      1,
      256,
      "maximumConcurrentInteractions",
    );
    this.#interactionOverloadContent = validatedInteractionOverloadContent(
      options.interactionOverloadContent,
    );
    this.#maximumGatewayEventListeners = boundedInteger(
      options.maximumGatewayEventListeners,
      16,
      1,
      64,
      "maximumGatewayEventListeners",
    );
    this.#maximumGatewayEventBacklog = boundedInteger(
      options.maximumGatewayEventBacklog,
      1_024,
      1,
      10_000,
      "maximumGatewayEventBacklog",
    );
    this.#attachClient(this.#client, this.#clientGeneration);
  }

  #attachClient(client: Client, generation: number): void {
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
      if (!this.#ownsGeneration(client, generation)) return;
      const normalized = normalizeInteraction(interaction);
      if (normalized !== null) this.#dispatchInteraction(normalized, client, generation);
    });
    client.on(Events.GuildCreate, (guild) => {
      this.#forwardGatewayEvent(client, generation, () => guildGatewayEvent("guild_created", guild));
    });
    client.on(Events.GuildDelete, (guild) => {
      this.#forwardGatewayEvent(client, generation, () => guildGatewayEvent("guild_deleted", guild));
    });
    client.on(Events.GuildMemberAdd, (member) => {
      this.#forwardGatewayEvent(client, generation, () =>
        memberGatewayEvent("guild_member_added", member));
    });
    client.on(Events.GuildMemberUpdate, (_previous, current) => {
      this.#forwardGatewayEvent(client, generation, () =>
        memberGatewayEvent("guild_member_updated", current));
    });
    client.on(Events.GuildMemberRemove, (member) => {
      this.#forwardGatewayEvent(client, generation, () =>
        removedMemberGatewayEvent(member));
    });
    client.on(Events.VoiceStateUpdate, (previous, current) => {
      this.#forwardGatewayEvent(client, generation, () =>
        voiceStateGatewayEvent(previous, current));
    });
    client.on(Events.MessageCreate, (message) => {
      this.#forwardGatewayEvent(client, generation, () => messageGatewayEvent(message));
    });
    client.on(Events.AutoModerationActionExecution, (execution) => {
      this.#forwardGatewayEvent(client, generation, () => nativeAutoModGatewayEvent(execution));
    });
  }

  #ownsGeneration(client: Client, generation: number): boolean {
    return (
      this.#client === client &&
      this.#clientGeneration === generation &&
      !this.#stopRequested &&
      !this.#queryAbortController.signal.aborted
    );
  }

  #forwardGatewayEvent(
    client: Client,
    generation: number,
    normalize: () => DiscordGatewayEvent | null,
  ): void {
    if (!this.#ownsGeneration(client, generation)) return;
    try {
      const event = normalize();
      if (event !== null && this.#ownsGeneration(client, generation)) {
        this.#enqueueGatewayEvent(event, client, generation);
      }
    } catch {
      // A malformed provider payload is isolated at the SDK boundary.
    }
  }

  #enqueueGatewayEvent(
    event: DiscordGatewayEvent,
    client: Client,
    generation: number,
  ): void {
    if (!this.#ownsGeneration(client, generation)) return;
    if (this.#gatewayEventQueue.length >= this.#maximumGatewayEventBacklog) {
      if (!this.#gatewayEventOverloaded) {
        this.#gatewayEventOverloaded = true;
        void this.#emit({
          type: "runtime_degraded",
          code: "DISCORD_GATEWAY_EVENT_BACKLOG_EXHAUSTED",
        });
      }
      return;
    }
    this.#gatewayEventQueue.push(Object.freeze({ event, client, generation }));
    this.#startGatewayEventDrain();
  }

  #dispatchInteraction(
    interaction: DiscordInteraction,
    client: Client,
    generation: number,
  ): void {
    const listener = this.#interactionListeners.values().next().value;
    if (
      listener === undefined ||
      this.#quarantinedInteractionDeliveryCounts.has(listener) ||
      this.#activeInteractionDeliveries >= this.#maximumConcurrentInteractions
    ) {
      if (
        this.#activeInteractionDeliveries >= this.#maximumConcurrentInteractions &&
        !this.#interactionCapacityOverloaded
      ) {
        this.#interactionCapacityOverloaded = true;
        void this.#emit({
          type: "runtime_degraded",
          code: "DISCORD_INTERACTION_CAPACITY_EXHAUSTED",
        });
      }
      this.#respondToOverloadedInteraction(interaction, client, generation);
      return;
    }
    this.#activeInteractionDeliveries += 1;
    const delivery = this.#emitInteraction(interaction, listener, client, generation);
    this.#interactionDeliveryTasks.add(delivery);
    void delivery.finally(() => {
      this.#interactionDeliveryTasks.delete(delivery);
      this.#activeInteractionDeliveries -= 1;
      if (
        this.#interactionCapacityOverloaded &&
        this.#activeInteractionDeliveries < this.#maximumConcurrentInteractions
      ) {
        this.#interactionCapacityOverloaded = false;
        this.#announceRuntimeRecovery("DISCORD_INTERACTION_CAPACITY_EXHAUSTED");
      }
    });
  }

  #respondToOverloadedInteraction(
    interaction: DiscordInteraction,
    client: Client,
    generation: number,
  ): void {
    if (
      this.#interactionOverloadResponses.size >= this.#maximumConcurrentInteractions ||
      interaction.responder.replied ||
      interaction.responder.deferred ||
      !this.#ownsGeneration(client, generation)
    ) {
      return;
    }
    const response = interaction.responder
      .reply({
        content: this.#interactionOverloadContent,
        visibility: "ephemeral",
      })
      .catch(() => undefined)
      .finally(() => {
        this.#interactionOverloadResponses.delete(response);
      });
    this.#interactionOverloadResponses.add(response);
  }

  #startGatewayEventDrain(): void {
    if (this.#gatewayEventDrain !== null || this.#stopRequested) return;
    const drain = this.#drainGatewayEvents();
    this.#gatewayEventDrain = drain;
    void drain.finally(() => {
      if (this.#gatewayEventDrain !== drain) return;
      this.#gatewayEventDrain = null;
      if (this.#gatewayEventQueue.length === 0) {
        if (this.#gatewayEventOverloaded) {
          this.#gatewayEventOverloaded = false;
          this.#announceRuntimeRecovery("DISCORD_GATEWAY_EVENT_BACKLOG_EXHAUSTED");
        }
      } else this.#startGatewayEventDrain();
    });
  }

  async #drainGatewayEvents(): Promise<void> {
    while (!this.#stopRequested) {
      const queued = this.#gatewayEventQueue.shift();
      if (queued === undefined) return;
      if (!this.#ownsGeneration(queued.client, queued.generation)) continue;
      await this.#emitGatewayEvent(queued.event, queued.client, queued.generation);
    }
    this.#gatewayEventQueue.length = 0;
  }

  async #replaceStoppedClient(): Promise<void> {
    const client = this.#clientFactory();
    this.#client = client;
    this.#clientGeneration += 1;
    this.#queryAbortController = new AbortController();
    this.#gatewayEventQueue.length = 0;
    this.#attachClient(client, this.#clientGeneration);
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
      await this.#flushRuntimeRecoveries();
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
    const gatewayEventDrain = this.#gatewayEventDrain;
    const interactionDeliveries = [...this.#interactionDeliveryTasks];
    const overloadResponses = [...this.#interactionOverloadResponses];
    this.#stopRequested = true;
    this.#gatewayEventQueue.length = 0;
    if (this.#gatewayEventOverloaded) {
      this.#gatewayEventOverloaded = false;
      this.#pendingRuntimeRecoveries.add("DISCORD_GATEWAY_EVENT_BACKLOG_EXHAUSTED");
    }
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
      if (gatewayEventDrain !== null) {
        await gatewayEventDrain.catch(() => undefined);
      }
      const interactionWork = Promise.allSettled([
        ...interactionDeliveries,
        ...overloadResponses,
      ]);
      let interactionShutdownTimeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          interactionWork,
          new Promise<void>((resolve) => {
            interactionShutdownTimeout = setTimeout(resolve, this.#shutdownTimeoutMs);
          }),
        ]);
      } finally {
        if (interactionShutdownTimeout !== undefined) clearTimeout(interactionShutdownTimeout);
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
    if (this.#client.isReady()) {
      await this.#flushRuntimeRecoveries();
      return this.#identity(this.#client);
    }

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
      await this.#flushRuntimeRecoveries();
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

  public subscribe(listener: DiscordGatewayEventListener): () => void {
    if (typeof listener !== "function") {
      throw new DiscordCoreError(
        "DISCORD_INVALID_INPUT",
        "Discord gateway event listener is invalid.",
        false,
      );
    }
    if (
      !this.#gatewayEventListeners.has(listener) &&
      this.#gatewayEventListeners.size >= this.#maximumGatewayEventListeners
    ) {
      throw new DiscordCoreError(
        "DISCORD_CIRCUIT_OPEN",
        "Discord gateway event listener capacity was exceeded.",
        true,
      );
    }
    this.#gatewayEventListeners.add(listener);
    return () => this.#gatewayEventListeners.delete(listener);
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
      const collection = await fetchGuildRoles(guild);
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

  public async readGuildMember(
    input: DiscordGuildMemberReadInput,
  ): Promise<DiscordGuildMemberSnapshot | null> {
    const guildId = inputSnowflake(
      inputDataProperty(input, "guildId", "Discord guild-member input"),
      "Discord guild id",
    );
    const userId = inputSnowflake(
      inputDataProperty(input, "userId", "Discord guild-member input"),
      "Discord member user id",
    );
    const signal = inputSignalFrom(input, "Discord guild-member read");
    const deadlineEpochMs = inputDeadlineEpochMsFrom(input, "Discord guild-member read");
    return this.#runCurrentClientOperation(signal, async (client) => {
      const guild = await resolveGuild(client, guildId);
      await fetchGuildRoles(guild);
      const member = await fetchMemberOrNull(guild, userId);
      return member === null ? null : memberSnapshot(member, guildId);
    }, "read", deadlineEpochMs);
  }

  public async readGuildRole(
    input: DiscordGuildRoleReadInput,
  ): Promise<DiscordGuildRoleSnapshot | null> {
    const guildId = inputSnowflake(
      inputDataProperty(input, "guildId", "Discord guild-role input"),
      "Discord guild id",
    );
    const roleId = inputSnowflake(
      inputDataProperty(input, "roleId", "Discord guild-role input"),
      "Discord role id",
    );
    const signal = inputSignalFrom(input, "Discord guild-role read");
    const deadlineEpochMs = inputDeadlineEpochMsFrom(input, "Discord guild-role read");
    return this.#runCurrentClientOperation(signal, async (client) => {
      const guild = await resolveGuild(client, guildId);
      const roles = await fetchGuildRoles(guild);
      const agent = await fetchMemberOrNull(guild, guildResourceAgentUserId(client));
      if (agent === null) {
        throw new DiscordCoreError(
          "DISCORD_PROVIDER_FAILURE",
          "Discord guild-resource agent is unavailable.",
          false,
          404,
        );
      }
      const role = roles.get(roleId) ?? null;
      return role === null ? null : roleSnapshot(role, guildId);
    }, "read", deadlineEpochMs);
  }

  public async readGuildChannel(
    input: DiscordGuildChannelReadInput,
  ): Promise<DiscordGuildChannelSnapshot | null> {
    const guildId = inputSnowflake(
      inputDataProperty(input, "guildId", "Discord guild-channel input"),
      "Discord guild id",
    );
    const channelId = inputSnowflake(
      inputDataProperty(input, "channelId", "Discord guild-channel input"),
      "Discord channel id",
    );
    const signal = inputSignalFrom(input, "Discord guild-channel read");
    const deadlineEpochMs = inputDeadlineEpochMsFrom(input, "Discord guild-channel read");
    return this.#runCurrentClientOperation(signal, async (client) => {
      const guild = await resolveGuild(client, guildId);
      await fetchGuildRoles(guild);
      const agentUserId = guildResourceAgentUserId(client);
      const [channel, agent] = await Promise.all([
        fetchGuildChannelOrNull(guild, channelId),
        fetchMemberOrNull(guild, agentUserId),
      ]);
      if (channel === null) return null;
      if (agent === null) {
        throw new DiscordCoreError(
          "DISCORD_PROVIDER_FAILURE",
          "Discord guild-resource agent is unavailable.",
          false,
          404,
        );
      }
      return guildChannelSnapshot(channel, agent, guildId);
    }, "read", deadlineEpochMs);
  }

  public addRoleToMember(
    input: DiscordMemberRoleMutationInput,
  ): Promise<DiscordMemberRoleMutationReceipt> {
    return this.#mutateMemberRole(input, "add");
  }

  public removeRoleFromMember(
    input: DiscordMemberRoleMutationInput,
  ): Promise<DiscordMemberRoleMutationReceipt> {
    return this.#mutateMemberRole(input, "remove");
  }

  async #mutateMemberRole(
    input: DiscordMemberRoleMutationInput,
    action: "add" | "remove",
  ): Promise<DiscordMemberRoleMutationReceipt> {
    const operationId = inputOperationId(input, "Discord member-role operation id");
    const guildId = inputSnowflake(
      inputDataProperty(input, "guildId", "Discord member-role input"),
      "Discord guild id",
    );
    const userId = inputSnowflake(
      inputDataProperty(input, "userId", "Discord member-role input"),
      "Discord member user id",
    );
    const roleId = inputSnowflake(
      inputDataProperty(input, "roleId", "Discord member-role input"),
      "Discord role id",
    );
    const auditReason = inputAuditReason(input, "Discord member-role audit reason");
    const signal = inputSignalFrom(input, "Discord member-role mutation");
    const deadlineEpochMs = inputDeadlineEpochMsFrom(input, "Discord member-role mutation");
    const fingerprint = createHash("sha256")
      .update(JSON.stringify([action, guildId, userId, roleId, auditReason]), "utf8")
      .digest("hex");
    const existing = this.#memberRoleLedgerEntry(operationId, fingerprint);
    if (existing.receipt !== null) {
      return this.#runCurrentClientOperation(
        signal,
        () => existing.receipt as DiscordMemberRoleMutationReceipt,
        "read",
        deadlineEpochMs,
      );
    }
    const receipt = Object.freeze({
      operationId,
      status: "satisfied" as const,
      action,
      guildId,
      userId,
      roleId,
    });
    const resolved = await this.#runCurrentClientMutation(signal, async (client) => {
      const guild = await resolveGuild(client, guildId);
      const roles = await fetchGuildRoles(guild);
      const agentUserId = guildResourceAgentUserId(client);
      const [member, agent] = await Promise.all([
        fetchMemberOrNull(guild, userId),
        fetchMemberOrNull(guild, agentUserId),
      ]);
      const role = roles.get(roleId) ?? null;
      if (member === null || agent === null || role === null) {
        throw new DiscordCoreError(
          "DISCORD_PROVIDER_FAILURE",
          "Discord member-role resource is unavailable.",
          false,
          404,
        );
      }
      assertMemberRoleMutationAllowed(guild, member, agent, role);
      const currentlyAssigned = member.roles.cache.has(roleId);
      if ((action === "add" && currentlyAssigned) || (action === "remove" && !currentlyAssigned)) {
        return receipt;
      }
      const updated = action === "add"
        ? await member.roles.add(roleId, auditReason)
        : await member.roles.remove(roleId, auditReason);
      if (updated.id !== userId || updated.guild.id !== guildId) {
        throw new DiscordCoreError(
          "DISCORD_RESPONSE_INVALID",
          "Discord member-role mutation response is inconsistent.",
          false,
        );
      }
      const assignedAfterMutation = updated.roles.cache.has(roleId);
      if ((action === "add") !== assignedAfterMutation) {
        throw new DiscordCoreError(
          "DISCORD_RESPONSE_INVALID",
          "Discord member-role mutation did not satisfy the requested state.",
          false,
        );
      }
      return receipt;
    }, deadlineEpochMs);
    existing.receipt = resolved;
    return resolved;
  }

  #memberRoleLedgerEntry(
    operationId: string,
    fingerprint: string,
  ): MemberRoleOperationLedgerEntry {
    const now = Date.now();
    for (const [key, entry] of this.#memberRoleOperationLedger) {
      if (entry.expiresAtEpochMs <= now) this.#memberRoleOperationLedger.delete(key);
    }
    const retained = this.#memberRoleOperationLedger.get(operationId);
    if (retained !== undefined) {
      if (retained.fingerprint !== fingerprint) {
        throw new DiscordCoreError(
          "DISCORD_INVALID_INPUT",
          "Discord member-role operation id was reused with different input.",
          false,
        );
      }
      return retained;
    }
    while (this.#memberRoleOperationLedger.size >= this.#memberRoleOperationLedgerCapacity) {
      const oldest = this.#memberRoleOperationLedger.keys().next().value;
      if (oldest === undefined) break;
      this.#memberRoleOperationLedger.delete(oldest);
    }
    const created: MemberRoleOperationLedgerEntry = {
      fingerprint,
      expiresAtEpochMs: now + this.#memberRoleOperationLedgerTtlMs,
      receipt: null,
    };
    this.#memberRoleOperationLedger.set(operationId, created);
    return created;
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

  public async readActorFacts(
    input: DiscordModerationActorFactsInput,
  ): Promise<DiscordModerationActorFacts> {
    const guildId = inputSnowflake(
      inputDataProperty(input, "guildId", "Discord moderation actor input"),
      "Discord guild id",
    );
    const actorUserId = inputSnowflake(
      inputDataProperty(input, "actorUserId", "Discord moderation actor input"),
      "Discord moderation actor id",
    );
    const requiredPermission = moderationPermission(
      inputDataProperty(input, "requiredPermission", "Discord moderation actor input"),
      false,
    );
    const signal = inputSignalFrom(input, "Discord moderation actor");
    return this.#runCurrentClientOperation(signal, async (client) =>
      (await actorModerationFacts(client, guildId, actorUserId, requiredPermission)).facts,
    );
  }

  public async readChannelFacts(
    input: DiscordModerationChannelFactsInput,
  ): Promise<DiscordModerationActorFacts> {
    const guildId = inputSnowflake(
      inputDataProperty(input, "guildId", "Discord moderation channel input"),
      "Discord guild id",
    );
    const channelId = inputSnowflake(
      inputDataProperty(input, "channelId", "Discord moderation channel input"),
      "Discord channel id",
    );
    const actorUserId = inputSnowflake(
      inputDataProperty(input, "actorUserId", "Discord moderation channel input"),
      "Discord moderation actor id",
    );
    const signal = inputSignalFrom(input, "Discord moderation channel");
    return this.#runCurrentClientOperation(signal, async (client) => {
      const guild = await resolveGuild(client, guildId);
      const agentUserId = moderationAgentUserId(client);
      const [actor, agent, channel] = await Promise.all([
        fetchMemberOrNull(guild, actorUserId),
        fetchMemberOrNull(guild, agentUserId),
        guild.channels.fetch(channelId),
      ]);
      if (channel === null || !channel.isTextBased() || channel.guildId !== guildId) {
        throw new DiscordCoreError(
          "DISCORD_PROVIDER_FAILURE",
          "Discord moderation channel is unavailable.",
          false,
          404,
        );
      }
      const permission = MODERATION_PERMISSION_FLAGS.manage_messages;
      return Object.freeze({
        guildId,
        actorUserId,
        agentUserId,
        requiredPermission: "manage_messages",
        actorPresent: actor !== null,
        agentPresent: agent !== null,
        actorHasRequiredPermission:
          actor !== null && channel.permissionsFor(actor)?.has(permission) === true,
        agentHasRequiredPermission:
          agent !== null && channel.permissionsFor(agent)?.has(permission) === true,
      });
    });
  }

  public async readMemberFacts(
    input: DiscordModerationMemberFactsInput,
  ): Promise<DiscordModerationMemberFacts> {
    const guildId = inputSnowflake(
      inputDataProperty(input, "guildId", "Discord moderation member input"),
      "Discord guild id",
    );
    const actorUserId = inputSnowflake(
      inputDataProperty(input, "actorUserId", "Discord moderation member input"),
      "Discord moderation actor id",
    );
    const targetUserId = inputSnowflake(
      inputDataProperty(input, "targetUserId", "Discord moderation member input"),
      "Discord moderation target id",
    );
    const requiredPermission = moderationPermission(
      inputDataProperty(input, "requiredPermission", "Discord moderation member input"),
      false,
    );
    if (requiredPermission === "manage_messages") {
      throw new DiscordCoreError(
        "DISCORD_INVALID_INPUT",
        "Discord member moderation permission is invalid.",
        false,
      );
    }
    const signal = inputSignalFrom(input, "Discord moderation member");
    return this.#runCurrentClientOperation(signal, (client) =>
      memberModerationFacts(
        client,
        guildId,
        actorUserId,
        targetUserId,
        requiredPermission,
      ),
    );
  }

  public async deleteRecentMessages(
    input: DiscordDeleteRecentMessagesInput,
  ): Promise<DiscordMessageCleanupReceipt> {
    const operationId = inputOperationId(input, "Discord cleanup operation id");
    const guildId = inputSnowflake(
      inputDataProperty(input, "guildId", "Discord cleanup input"),
      "Discord guild id",
    );
    const channelId = inputSnowflake(
      inputDataProperty(input, "channelId", "Discord cleanup input"),
      "Discord channel id",
    );
    const requestedCount = inputInteger(
      inputDataProperty(input, "requestedCount", "Discord cleanup input"),
      1,
      100,
      "Discord cleanup message count",
    );
    const signal = inputSignalFrom(input, "Discord cleanup");
    return this.#runCurrentClientMutation(signal, async (client) => {
      const guild = await resolveGuild(client, guildId);
      const channel = await guild.channels.fetch(channelId);
      if (
        channel === null ||
        !channel.isTextBased() ||
        channel.guildId !== guildId ||
        !("bulkDelete" in channel)
      ) {
        throw new DiscordCoreError(
          "DISCORD_PROVIDER_FAILURE",
          "Discord cleanup channel is unavailable.",
          false,
          404,
        );
      }
      const deleted = await (channel as GuildTextBasedChannel).bulkDelete(
        requestedCount,
        true,
      );
      const deletedCount = responseBoundedInteger(
        deleted.size,
        0,
        requestedCount,
        "Discord deleted-message count",
      );
      return Object.freeze({
        operationId,
        status: "applied",
        guildId,
        channelId,
        requestedCount,
        deletedCount,
        skippedCount: requestedCount - deletedCount,
      });
    });
  }

  public async kickMember(
    input: DiscordKickMemberInput,
  ): Promise<DiscordMemberModerationReceipt> {
    const operationId = inputOperationId(input, "Discord kick operation id");
    const guildId = inputSnowflake(
      inputDataProperty(input, "guildId", "Discord kick input"),
      "Discord guild id",
    );
    const targetUserId = inputSnowflake(
      inputDataProperty(input, "targetUserId", "Discord kick input"),
      "Discord moderation target id",
    );
    const auditReason = inputAuditReason(input, "Discord kick audit reason");
    const signal = inputSignalFrom(input, "Discord kick");
    return this.#runCurrentClientMutation(signal, async (client) => {
      const guild = await resolveGuild(client, guildId);
      const target = await fetchMemberOrNull(guild, targetUserId);
      if (target === null) {
        throw new DiscordCoreError(
          "DISCORD_PROVIDER_FAILURE",
          "Discord moderation target is unavailable.",
          false,
          404,
        );
      }
      const targetDisplayName = responseTextValue(
        target.displayName,
        1,
        128,
        "Discord moderation target display name",
      );
      await target.kick(auditReason);
      return Object.freeze({
        operationId,
        status: "applied",
        guildId,
        targetUserId,
        targetDisplayName,
      });
    });
  }

  public async banMember(
    input: DiscordBanMemberInput,
  ): Promise<DiscordMemberModerationReceipt> {
    const operationId = inputOperationId(input, "Discord ban operation id");
    const guildId = inputSnowflake(
      inputDataProperty(input, "guildId", "Discord ban input"),
      "Discord guild id",
    );
    const targetUserId = inputSnowflake(
      inputDataProperty(input, "targetUserId", "Discord ban input"),
      "Discord moderation target id",
    );
    const deleteMessageSeconds = inputInteger(
      inputDataProperty(input, "deleteMessageSeconds", "Discord ban input"),
      0,
      604_800,
      "Discord ban delete-message interval",
    );
    const auditReason = inputAuditReason(input, "Discord ban audit reason");
    const signal = inputSignalFrom(input, "Discord ban");
    return this.#runCurrentClientMutation(signal, async (client) => {
      const guild = await resolveGuild(client, guildId);
      const target =
        (await fetchMemberOrNull(guild, targetUserId))?.user ??
        (await client.users.fetch(targetUserId, { force: true }));
      if (target.id !== targetUserId) {
        throw new DiscordCoreError(
          "DISCORD_RESPONSE_INVALID",
          "Discord moderation target response is inconsistent.",
          false,
        );
      }
      const targetDisplayName = responseTextValue(
        target.displayName,
        1,
        128,
        "Discord moderation target display name",
      );
      await guild.members.ban(targetUserId, { deleteMessageSeconds, reason: auditReason });
      return Object.freeze({
        operationId,
        status: "applied",
        guildId,
        targetUserId,
        targetDisplayName,
      });
    });
  }

  public async unbanMember(
    input: DiscordUnbanMemberInput,
  ): Promise<DiscordMemberModerationReceipt> {
    const operationId = inputOperationId(input, "Discord unban operation id");
    const guildId = inputSnowflake(
      inputDataProperty(input, "guildId", "Discord unban input"),
      "Discord guild id",
    );
    const targetUserId = inputSnowflake(
      inputDataProperty(input, "targetUserId", "Discord unban input"),
      "Discord moderation target id",
    );
    const auditReason = inputAuditReason(input, "Discord unban audit reason");
    const signal = inputSignalFrom(input, "Discord unban");
    return this.#runCurrentClientMutation(signal, async (client) => {
      const guild = await resolveGuild(client, guildId);
      let ban;
      try {
        ban = await guild.bans.fetch({ user: targetUserId, force: true });
      } catch (error: unknown) {
        if (isProviderNotFoundError(error)) {
          throw new DiscordCoreError(
            "DISCORD_PROVIDER_FAILURE",
            "Discord ban is unavailable.",
            false,
            404,
          );
        }
        throw error;
      }
      if (ban.user.id !== targetUserId) {
        throw new DiscordCoreError(
          "DISCORD_RESPONSE_INVALID",
          "Discord ban response is inconsistent.",
          false,
        );
      }
      const targetDisplayName = responseTextValue(
        ban.user.displayName,
        1,
        128,
        "Discord moderation target display name",
      );
      await guild.members.unban(targetUserId, auditReason);
      return Object.freeze({
        operationId,
        status: "applied",
        guildId,
        targetUserId,
        targetDisplayName,
      });
    });
  }

  public async deleteMessage(
    input: DiscordBotAutoModDeleteMessageInput,
  ): Promise<DiscordAutoModOperationReceipt> {
    const operationId = inputOperationId(input, "Discord AutoMod delete operation id");
    const guildId = inputSnowflake(
      inputDataProperty(input, "guildId", "Discord AutoMod delete input"),
      "Discord guild id",
    );
    const channelId = inputSnowflake(
      inputDataProperty(input, "channelId", "Discord AutoMod delete input"),
      "Discord channel id",
    );
    const messageId = inputSnowflake(
      inputDataProperty(input, "messageId", "Discord AutoMod delete input"),
      "Discord message id",
    );
    const signal = inputSignalFrom(input, "Discord AutoMod delete");
    return this.#runCurrentClientMutation(signal, async (client) => {
      try {
        const guild = await resolveGuild(client, guildId);
        const channel = await guild.channels.fetch(channelId);
        if (
          channel === null ||
          !channel.isTextBased() ||
          channel.guildId !== guildId ||
          !("messages" in channel)
        ) {
          throw new DiscordCoreError(
            "DISCORD_PROVIDER_FAILURE",
            "Discord AutoMod message channel is unavailable.",
            false,
            404,
          );
        }
        const message = await (channel as GuildTextBasedChannel).messages.fetch(messageId);
        if (message.id !== messageId) {
          throw new DiscordCoreError(
            "DISCORD_RESPONSE_INVALID",
            "Discord AutoMod message response is inconsistent.",
            false,
          );
        }
        await message.delete();
      } catch (error: unknown) {
        if (!isProviderNotFoundError(error)) throw error;
      }
      return Object.freeze({ operationId, status: "applied" });
    });
  }

  public async timeoutMember(
    input: DiscordBotAutoModTimeoutMemberInput,
  ): Promise<DiscordAutoModOperationReceipt> {
    const operationId = inputOperationId(input, "Discord AutoMod timeout operation id");
    const guildId = inputSnowflake(
      inputDataProperty(input, "guildId", "Discord AutoMod timeout input"),
      "Discord guild id",
    );
    const userId = inputSnowflake(
      inputDataProperty(input, "userId", "Discord AutoMod timeout input"),
      "Discord member id",
    );
    const durationSeconds = inputInteger(
      inputDataProperty(input, "durationSeconds", "Discord AutoMod timeout input"),
      1,
      2_419_200,
      "Discord AutoMod timeout duration",
    );
    const auditReason = inputAuditReason(input, "Discord AutoMod timeout audit reason");
    const signal = inputSignalFrom(input, "Discord AutoMod timeout");
    return this.#runCurrentClientMutation(signal, async (client) => {
      const guild = await resolveGuild(client, guildId);
      const member = await fetchMemberOrNull(guild, userId);
      if (member === null) {
        throw new DiscordCoreError(
          "DISCORD_PROVIDER_FAILURE",
          "Discord AutoMod member is unavailable.",
          false,
          404,
        );
      }
      await member.timeout(durationSeconds * 1_000, auditReason);
      return Object.freeze({ operationId, status: "applied" });
    });
  }

  public async listRules(
    input: DiscordNativeAutoModListInput,
  ): Promise<readonly DiscordNativeAutoModRuleSnapshot[]> {
    const guildId = inputSnowflake(
      inputDataProperty(input, "guildId", "Discord AutoMod list input"),
      "Discord guild id",
    );
    const signal = inputSignalFrom(input, "Discord AutoMod list");
    return this.#runCurrentClientOperation(signal, async (client) => {
      const guild = await resolveGuild(client, guildId);
      const agentUserId = moderationAgentUserId(client);
      const rules = await guild.autoModerationRules.fetch();
      if (rules.size > 100) {
        throw new DiscordCoreError(
          "DISCORD_RESPONSE_TOO_LARGE",
          "Discord AutoMod rule collection exceeds its limit.",
          false,
        );
      }
      const result: DiscordNativeAutoModRuleSnapshot[] = [];
      const ids = new Set<string>();
      for (const [providerRuleId, rule] of rules) {
        const snapshot = remoteAutoModRule(rule, agentUserId);
        if (providerRuleId !== snapshot.providerRuleId || ids.has(snapshot.providerRuleId)) {
          throw new DiscordCoreError(
            "DISCORD_RESPONSE_INVALID",
            "Discord AutoMod rule collection is inconsistent.",
            false,
          );
        }
        ids.add(snapshot.providerRuleId);
        result.push(snapshot);
      }
      result.sort((left, right) => left.providerRuleId.localeCompare(right.providerRuleId, "en"));
      return Object.freeze(result);
    });
  }

  public async readRule(
    input: DiscordNativeAutoModReadInput,
  ): Promise<DiscordNativeAutoModRuleSnapshot | null> {
    const guildId = inputSnowflake(
      inputDataProperty(input, "guildId", "Discord AutoMod read input"),
      "Discord guild id",
    );
    const providerRuleId = inputSnowflake(
      inputDataProperty(input, "providerRuleId", "Discord AutoMod read input"),
      "Discord AutoMod rule id",
    );
    const signal = inputSignalFrom(input, "Discord AutoMod read");
    return this.#runCurrentClientOperation(signal, async (client) => {
      try {
        const guild = await resolveGuild(client, guildId);
        const rule = await guild.autoModerationRules.fetch(providerRuleId);
        if (rule.id !== providerRuleId) {
          throw new DiscordCoreError(
            "DISCORD_RESPONSE_INVALID",
            "Discord AutoMod rule response is inconsistent.",
            false,
          );
        }
        return remoteAutoModRule(rule, moderationAgentUserId(client));
      } catch (error: unknown) {
        if (isProviderNotFoundError(error)) return null;
        throw error;
      }
    });
  }

  public async createRule(
    input: DiscordNativeAutoModCreateInput,
  ): Promise<DiscordNativeAutoModMutationReceipt> {
    const operationId = inputOperationId(input, "Discord AutoMod create operation id");
    const guildId = inputSnowflake(
      inputDataProperty(input, "guildId", "Discord AutoMod create input"),
      "Discord guild id",
    );
    const rule = nativeAutoModRulePlan(
      inputDataProperty(input, "rule", "Discord AutoMod create input"),
    );
    const auditReason = inputAuditReason(input, "Discord AutoMod create audit reason");
    const signal = inputSignalFrom(input, "Discord AutoMod create");
    return this.#runCurrentClientMutation(signal, async (client) => {
      const guild = await resolveGuild(client, guildId);
      const created = await guild.autoModerationRules.create(
        providerAutoModRule(rule, auditReason),
      );
      const providerRuleId = responseSnowflake(created.id, "Discord AutoMod rule id");
      return Object.freeze({
        operationId,
        status: "applied",
        guildId,
        providerRuleId,
      });
    });
  }

  public async updateRule(
    input: DiscordNativeAutoModUpdateInput,
  ): Promise<DiscordNativeAutoModMutationReceipt> {
    const operationId = inputOperationId(input, "Discord AutoMod update operation id");
    const guildId = inputSnowflake(
      inputDataProperty(input, "guildId", "Discord AutoMod update input"),
      "Discord guild id",
    );
    const providerRuleId = inputSnowflake(
      inputDataProperty(input, "providerRuleId", "Discord AutoMod update input"),
      "Discord AutoMod rule id",
    );
    const rule = nativeAutoModRulePlan(
      inputDataProperty(input, "rule", "Discord AutoMod update input"),
    );
    const auditReason = inputAuditReason(input, "Discord AutoMod update audit reason");
    const signal = inputSignalFrom(input, "Discord AutoMod update");
    return this.#runCurrentClientMutation(signal, async (client) => {
      const guild = await resolveGuild(client, guildId);
      const desired = providerAutoModRule(
        rule,
        auditReason,
      );
      const existing = await guild.autoModerationRules.fetch(providerRuleId);
      if (existing.id !== providerRuleId) {
        throw new DiscordCoreError(
          "DISCORD_RESPONSE_INVALID",
          "Discord AutoMod rule response is inconsistent.",
          false,
        );
      }
      if (existing.triggerType !== desired.triggerType) {
        throw new DiscordCoreError(
          "DISCORD_INVALID_INPUT",
          "Discord AutoMod trigger type is immutable; replace the rule explicitly.",
          false,
        );
      }
      const { triggerType: _triggerType, ...editable } = desired;
      const updated = await guild.autoModerationRules.edit(providerRuleId, editable);
      if (updated.id !== providerRuleId) {
        throw new DiscordCoreError(
          "DISCORD_RESPONSE_INVALID",
          "Discord AutoMod update response is inconsistent.",
          false,
        );
      }
      return Object.freeze({
        operationId,
        status: "applied",
        guildId,
        providerRuleId,
      });
    });
  }

  public async deleteRule(
    input: DiscordNativeAutoModDeleteInput,
  ): Promise<DiscordNativeAutoModMutationReceipt> {
    const operationId = inputOperationId(input, "Discord AutoMod delete-rule operation id");
    const guildId = inputSnowflake(
      inputDataProperty(input, "guildId", "Discord AutoMod delete-rule input"),
      "Discord guild id",
    );
    const providerRuleId = inputSnowflake(
      inputDataProperty(input, "providerRuleId", "Discord AutoMod delete-rule input"),
      "Discord AutoMod rule id",
    );
    const auditReason = inputAuditReason(input, "Discord AutoMod delete-rule audit reason");
    const signal = inputSignalFrom(input, "Discord AutoMod delete-rule");
    return this.#runCurrentClientMutation(signal, async (client) => {
      try {
        const guild = await resolveGuild(client, guildId);
        await guild.autoModerationRules.delete(providerRuleId, auditReason);
      } catch (error: unknown) {
        if (!isProviderNotFoundError(error)) throw error;
      }
      return Object.freeze({
        operationId,
        status: "applied",
        guildId,
        providerRuleId,
      });
    });
  }

  public async createRoom(
    input: DiscordVoiceRoomCreateInput,
  ): Promise<DiscordVoiceRoomOperationReceipt> {
    const operationId = inputOperationId(input, "Discord voice-room create operation id");
    const guildId = inputSnowflake(
      inputDataProperty(input, "guildId", "Discord voice-room create input"),
      "Discord guild id",
    );
    const parentCategoryId = inputSnowflake(
      inputDataProperty(input, "parentCategoryId", "Discord voice-room create input"),
      "Discord voice-room category id",
    );
    const name = inputTextValue(
      inputDataProperty(input, "name", "Discord voice-room create input"),
      1,
      100,
      "Discord voice-room name",
    );
    const userLimit = inputInteger(
      inputDataProperty(input, "userLimit", "Discord voice-room create input"),
      0,
      99,
      "Discord voice-room user limit",
    );
    const permissionOverwrites = inputDenseArray<unknown>(
      inputDataProperty(input, "permissionOverwrites", "Discord voice-room create input"),
      0,
      100,
      "Discord voice-room permission overwrites",
    ).map(voicePermissionOverwrite);
    const targets = new Set(permissionOverwrites.map((overwrite) => overwrite.target.id));
    if (targets.size !== permissionOverwrites.length) {
      throw new DiscordCoreError(
        "DISCORD_INVALID_INPUT",
        "Discord voice-room permission overwrite targets have duplicates.",
        false,
      );
    }
    const auditReason = inputAuditReason(input, "Discord voice-room create audit reason");
    const signal = inputSignalFrom(input, "Discord voice-room create");
    return this.#runCurrentClientMutation(signal, async (client) => {
      const guild = await resolveGuild(client, guildId);
      const parent = await guild.channels.fetch(parentCategoryId);
      if (parent === null || parent.type !== ChannelType.GuildCategory) {
        throw new DiscordCoreError(
          "DISCORD_PROVIDER_FAILURE",
          "Discord voice-room category is unavailable.",
          false,
          404,
        );
      }
      const channel = await guild.channels.create({
        name,
        type: ChannelType.GuildVoice,
        parent: parentCategoryId,
        userLimit,
        permissionOverwrites: permissionOverwrites.map(providerVoiceOverwrite),
        reason: auditReason,
      });
      return Object.freeze({
        operationId,
        status: "applied",
        guildId,
        channelId: responseSnowflake(channel.id, "Discord voice-room channel id"),
      });
    });
  }

  public async moveMember(
    input: DiscordVoiceRoomMoveMemberInput,
  ): Promise<DiscordVoiceRoomOperationReceipt> {
    const operationId = inputOperationId(input, "Discord voice-room move operation id");
    const guildId = inputSnowflake(
      inputDataProperty(input, "guildId", "Discord voice-room move input"),
      "Discord guild id",
    );
    const userId = inputSnowflake(
      inputDataProperty(input, "userId", "Discord voice-room move input"),
      "Discord member id",
    );
    const channelId = inputSnowflake(
      inputDataProperty(input, "channelId", "Discord voice-room move input"),
      "Discord voice-room channel id",
    );
    const auditReason = inputAuditReason(input, "Discord voice-room move audit reason");
    const signal = inputSignalFrom(input, "Discord voice-room move");
    return this.#runCurrentClientMutation(signal, async (client) => {
      const guild = await resolveGuild(client, guildId);
      const [member, channel] = await Promise.all([
        guild.members.fetch(userId),
        guild.channels.fetch(channelId),
      ]);
      if (channel === null || channel.type !== ChannelType.GuildVoice) {
        throw new DiscordCoreError(
          "DISCORD_PROVIDER_FAILURE",
          "Discord voice-room channel is unavailable.",
          false,
          404,
        );
      }
      await member.voice.setChannel(channel, auditReason);
      return Object.freeze({ operationId, status: "applied", guildId, channelId });
    });
  }

  public async updateRoom(
    input: DiscordVoiceRoomUpdateInput,
  ): Promise<DiscordVoiceRoomOperationReceipt> {
    const operationId = inputOperationId(input, "Discord voice-room update operation id");
    const guildId = inputSnowflake(
      inputDataProperty(input, "guildId", "Discord voice-room update input"),
      "Discord guild id",
    );
    const channelId = inputSnowflake(
      inputDataProperty(input, "channelId", "Discord voice-room update input"),
      "Discord voice-room channel id",
    );
    const nameValue = inputDataProperty(input, "name", "Discord voice-room name", true);
    const userLimitValue = inputDataProperty(
      input,
      "userLimit",
      "Discord voice-room user limit",
      true,
    );
    if (nameValue === undefined && userLimitValue === undefined) {
      throw new DiscordCoreError(
        "DISCORD_INVALID_INPUT",
        "Discord voice-room update contains no changes.",
        false,
      );
    }
    const name = nameValue === undefined
      ? undefined
      : inputTextValue(nameValue, 1, 100, "Discord voice-room name");
    const userLimit = userLimitValue === undefined
      ? undefined
      : inputInteger(userLimitValue, 0, 99, "Discord voice-room user limit");
    const auditReason = inputAuditReason(input, "Discord voice-room update audit reason");
    const signal = inputSignalFrom(input, "Discord voice-room update");
    return this.#runCurrentClientMutation(signal, async (client) => {
      const guild = await resolveGuild(client, guildId);
      const channel = await guild.channels.fetch(channelId);
      if (channel === null || channel.type !== ChannelType.GuildVoice) {
        throw new DiscordCoreError(
          "DISCORD_PROVIDER_FAILURE",
          "Discord voice-room channel is unavailable.",
          false,
          404,
        );
      }
      const updated = await channel.edit({
        ...(name === undefined ? {} : { name }),
        ...(userLimit === undefined ? {} : { userLimit }),
        reason: auditReason,
      });
      if (updated.id !== channelId) {
        throw new DiscordCoreError(
          "DISCORD_RESPONSE_INVALID",
          "Discord voice-room update response is inconsistent.",
          false,
        );
      }
      return Object.freeze({ operationId, status: "applied", guildId, channelId });
    });
  }

  public async upsertPermissionOverwrite(
    input: DiscordVoiceRoomUpsertOverwriteInput,
  ): Promise<DiscordVoiceRoomOperationReceipt> {
    const operationId = inputOperationId(input, "Discord voice-room overwrite operation id");
    const guildId = inputSnowflake(
      inputDataProperty(input, "guildId", "Discord voice-room overwrite input"),
      "Discord guild id",
    );
    const channelId = inputSnowflake(
      inputDataProperty(input, "channelId", "Discord voice-room overwrite input"),
      "Discord voice-room channel id",
    );
    const overwrite = voicePermissionOverwrite(
      inputDataProperty(input, "overwrite", "Discord voice-room overwrite input"),
    );
    const auditReason = inputAuditReason(input, "Discord voice-room overwrite audit reason");
    const signal = inputSignalFrom(input, "Discord voice-room overwrite");
    return this.#runCurrentClientMutation(signal, async (client) => {
      const guild = await resolveGuild(client, guildId);
      const channel = await guild.channels.fetch(channelId);
      if (channel === null || channel.type !== ChannelType.GuildVoice) {
        throw new DiscordCoreError(
          "DISCORD_PROVIDER_FAILURE",
          "Discord voice-room channel is unavailable.",
          false,
          404,
        );
      }
      await channel.permissionOverwrites.edit(
        overwrite.target.id,
        providerVoiceOverwriteEdit(overwrite),
        {
          reason: auditReason,
          type: overwrite.target.type === "role" ? OverwriteType.Role : OverwriteType.Member,
        },
      );
      return Object.freeze({ operationId, status: "applied", guildId, channelId });
    });
  }

  public async deletePermissionOverwrite(
    input: DiscordVoiceRoomDeleteOverwriteInput,
  ): Promise<DiscordVoiceRoomOperationReceipt> {
    const operationId = inputOperationId(input, "Discord voice-room overwrite-delete operation id");
    const guildId = inputSnowflake(
      inputDataProperty(input, "guildId", "Discord voice-room overwrite-delete input"),
      "Discord guild id",
    );
    const channelId = inputSnowflake(
      inputDataProperty(input, "channelId", "Discord voice-room overwrite-delete input"),
      "Discord voice-room channel id",
    );
    const target = voiceOverwriteTarget(
      inputDataProperty(input, "target", "Discord voice-room overwrite-delete input"),
    );
    const auditReason = inputAuditReason(input, "Discord voice-room overwrite-delete audit reason");
    const signal = inputSignalFrom(input, "Discord voice-room overwrite-delete");
    return this.#runCurrentClientMutation(signal, async (client) => {
      const guild = await resolveGuild(client, guildId);
      const channel = await guild.channels.fetch(channelId);
      if (channel === null || channel.type !== ChannelType.GuildVoice) {
        throw new DiscordCoreError(
          "DISCORD_PROVIDER_FAILURE",
          "Discord voice-room channel is unavailable.",
          false,
          404,
        );
      }
      const existing = channel.permissionOverwrites.cache.get(target.id);
      const expectedType = target.type === "role" ? OverwriteType.Role : OverwriteType.Member;
      if (existing !== undefined && existing.type !== expectedType) {
        throw new DiscordCoreError(
          "DISCORD_RESPONSE_INVALID",
          "Discord voice-room overwrite target is inconsistent.",
          false,
        );
      }
      if (existing !== undefined) {
        await channel.permissionOverwrites.delete(target.id, auditReason);
      }
      return Object.freeze({ operationId, status: "applied", guildId, channelId });
    });
  }

  public async deleteRoom(
    input: DiscordVoiceRoomDeleteInput,
  ): Promise<DiscordVoiceRoomOperationReceipt> {
    const operationId = inputOperationId(input, "Discord voice-room delete operation id");
    const guildId = inputSnowflake(
      inputDataProperty(input, "guildId", "Discord voice-room delete input"),
      "Discord guild id",
    );
    const channelId = inputSnowflake(
      inputDataProperty(input, "channelId", "Discord voice-room delete input"),
      "Discord voice-room channel id",
    );
    const auditReason = inputAuditReason(input, "Discord voice-room delete audit reason");
    const signal = inputSignalFrom(input, "Discord voice-room delete");
    return this.#runCurrentClientMutation(signal, async (client) => {
      const guild = await resolveGuild(client, guildId);
      const channel = await guild.channels.fetch(channelId);
      if (channel === null || channel.type !== ChannelType.GuildVoice) {
        throw new DiscordCoreError(
          "DISCORD_PROVIDER_FAILURE",
          "Discord voice-room channel is unavailable.",
          false,
          404,
        );
      }
      await channel.delete(auditReason);
      return Object.freeze({ operationId, status: "applied", guildId, channelId });
    });
  }

  async #runCurrentClientOperation<T>(
    signal: AbortSignal | undefined,
    operation: (client: Client) => T | Promise<T>,
    operationKind: "read" | "mutation" = "read",
    deadlineEpochMs?: number,
  ): Promise<T> {
    if (signal?.aborted === true) {
      throw new DiscordCoreError("DISCORD_CANCELLED", "Discord operation was cancelled.", false);
    }
    if (deadlineEpochMs !== undefined && deadlineEpochMs <= Date.now()) {
      throw new DiscordCoreError(
        "DISCORD_TIMEOUT",
        "Discord operation exceeded its deadline before dispatch.",
        true,
      );
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
    let dispatched = false;
    const interrupted = (summary: string): DiscordCoreError =>
      operationKind === "mutation" && dispatched
        ? new DiscordCoreError(
            "DISCORD_OUTCOME_UNKNOWN",
            "Discord mutation outcome is unknown and requires reconciliation.",
            false,
          )
        : new DiscordCoreError("DISCORD_CANCELLED", summary, false);
    const providerOperation = Promise.resolve()
      .then(() => {
        if (signal?.aborted === true || lifecycleSignal.aborted) {
          throw interrupted("Discord operation was cancelled before dispatch.");
        }
        if (deadlineEpochMs !== undefined && deadlineEpochMs <= Date.now()) {
          throw new DiscordCoreError(
            "DISCORD_TIMEOUT",
            "Discord operation exceeded its deadline before dispatch.",
            true,
          );
        }
        dispatched = true;
        return operation(client);
      })
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
      rejectBoundary(interrupted("Discord operation was cancelled."));
    const onLifecycleAbort = (): void =>
      rejectBoundary(interrupted("Discord gateway generation stopped."));
    signal?.addEventListener("abort", onCallerAbort, { once: true });
    lifecycleSignal.addEventListener("abort", onLifecycleAbort, { once: true });
    const timeoutMs = deadlineEpochMs === undefined
      ? this.#queryTimeoutMs
      : Math.max(1, Math.min(this.#queryTimeoutMs, deadlineEpochMs - Date.now()));
    const timeout = setTimeout(
      () =>
        rejectBoundary(
          operationKind === "mutation" && dispatched
            ? new DiscordCoreError(
                "DISCORD_OUTCOME_UNKNOWN",
                "Discord mutation outcome is unknown and requires reconciliation.",
                false,
              )
            : new DiscordCoreError(
                "DISCORD_TIMEOUT",
                "Discord operation exceeded its deadline.",
                true,
              ),
        ),
      timeoutMs,
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
        throw interrupted("Discord gateway generation changed during the operation.");
      }
      return result;
    } catch (error: unknown) {
      if (error instanceof DiscordCoreError) throw error;
      if (isAbortRequested(signal) || isAbortRequested(lifecycleSignal)) {
        throw interrupted("Discord operation was cancelled.");
      }
      if (operationKind === "mutation" && dispatched) {
        const status = providerStatus(error);
        const definitivelyRejected =
          error instanceof RateLimitError ||
          status === 429 ||
          (status !== null &&
            status >= 400 &&
            status < 500 &&
            status !== 408 &&
            status !== 425);
        if (!definitivelyRejected) {
          throw new DiscordCoreError(
            "DISCORD_OUTCOME_UNKNOWN",
            "Discord mutation outcome is unknown and requires reconciliation.",
            false,
          );
        }
      }
      throw providerFailure(error);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onCallerAbort);
      lifecycleSignal.removeEventListener("abort", onLifecycleAbort);
    }
  }

  #runCurrentClientMutation<T>(
    signal: AbortSignal | undefined,
    operation: (client: Client) => T | Promise<T>,
    deadlineEpochMs?: number,
  ): Promise<T> {
    return this.#runCurrentClientOperation(signal, operation, "mutation", deadlineEpochMs);
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
        this.#deliverLifecycleEventBounded(listener, event),
      ),
    );
  }

  async #emitInteraction(
    interaction: DiscordInteraction,
    listener: DiscordInteractionListener,
    client: Client,
    generation: number,
  ): Promise<void> {
    if (!this.#ownsGeneration(client, generation)) {
      return;
    }
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    const delivery = Promise.resolve()
      .then(() => {
        if (!this.#ownsGeneration(client, generation)) return;
        return listener(interaction);
      })
      .catch(() => undefined);
    try {
      await Promise.race([
        delivery,
        new Promise<void>((resolve) => {
          timeout = setTimeout(() => {
            timedOut = true;
            resolve();
          }, this.#interactionTimeoutMs);
        }),
      ]);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      if (timedOut) {
        this.#respondToOverloadedInteraction(interaction, client, generation);
        const wasHealthy = this.#quarantinedInteractionDeliveryCounts.size === 0;
        const previousCount = this.#quarantinedInteractionDeliveryCounts.get(listener) ?? 0;
        this.#quarantinedInteractionDeliveryCounts.set(listener, previousCount + 1);
        void delivery.finally(() => {
          const remaining = (this.#quarantinedInteractionDeliveryCounts.get(listener) ?? 1) - 1;
          if (remaining > 0) {
            this.#quarantinedInteractionDeliveryCounts.set(listener, remaining);
            return;
          }
          this.#quarantinedInteractionDeliveryCounts.delete(listener);
          if (this.#quarantinedInteractionDeliveryCounts.size === 0) {
            this.#announceRuntimeRecovery("DISCORD_INTERACTION_ROUTER_QUARANTINED");
          }
        });
        if (wasHealthy) {
          await this.#emit({
            type: "runtime_degraded",
            code: "DISCORD_INTERACTION_ROUTER_QUARANTINED",
          });
        }
      }
    }
  }

  async #emitGatewayEvent(
    event: DiscordGatewayEvent,
    client: Client,
    generation: number,
  ): Promise<void> {
    if (!this.#ownsGeneration(client, generation)) return;
    await Promise.allSettled(
      [...this.#gatewayEventListeners].map((listener) =>
        this.#deliverGatewayEventBounded(listener, event, client, generation),
      ),
    );
  }

  async #deliverGatewayEventBounded(
    listener: DiscordGatewayEventListener,
    event: DiscordGatewayEvent,
    client: Client,
    generation: number,
  ): Promise<void> {
    if (this.#quarantinedGatewayEventListeners.has(listener)) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    const delivery = Promise.resolve()
      .then(() => {
        if (!this.#ownsGeneration(client, generation)) return;
        return listener(event);
      })
      .catch(() => undefined);
    try {
      await Promise.race([
        delivery,
        new Promise<void>((resolve) => {
          timeout = setTimeout(() => {
            timedOut = true;
            resolve();
          }, this.#listenerTimeoutMs);
        }),
      ]);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      if (timedOut) {
        // A non-cooperative listener remains at most one orphaned promise.
        // It is skipped until that delivery settles and the lifecycle stream
        // exposes the degradation so the product can restart or shed work.
        const wasHealthy = this.#quarantinedGatewayEventListeners.size === 0;
        this.#quarantinedGatewayEventListeners.add(listener);
        void delivery.finally(() => {
          this.#quarantinedGatewayEventListeners.delete(listener);
          if (this.#quarantinedGatewayEventListeners.size === 0) {
            this.#announceRuntimeRecovery("DISCORD_GATEWAY_EVENT_LISTENER_QUARANTINED");
          }
        });
        if (wasHealthy) {
          await this.#emit({
            type: "runtime_degraded",
            code: "DISCORD_GATEWAY_EVENT_LISTENER_QUARANTINED",
          });
        }
      }
    }
  }

  async #deliverLifecycleEventBounded(
    listener: DiscordGatewayLifecycleListener,
    event: DiscordGatewayLifecycleEvent,
  ): Promise<void> {
    if (this.#quarantinedLifecycleListeners.has(listener)) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    const delivery = Promise.resolve()
      .then(() => listener(event))
      .catch(() => undefined);
    try {
      await Promise.race([
        delivery,
        new Promise<void>((resolve) => {
          timeout = setTimeout(() => {
            timedOut = true;
            resolve();
          }, this.#listenerTimeoutMs);
        }),
      ]);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      if (timedOut) {
        this.#quarantinedLifecycleListeners.add(listener);
        void delivery.finally(() => {
          this.#quarantinedLifecycleListeners.delete(listener);
        });
      }
    }
  }

  #announceRuntimeRecovery(code: DiscordGatewayRuntimeCondition): void {
    if (this.#stopRequested) {
      this.#pendingRuntimeRecoveries.add(code);
      return;
    }
    void this.#emit({ type: "runtime_recovered", code });
  }

  async #flushRuntimeRecoveries(): Promise<void> {
    if (this.#stopRequested || this.#pendingRuntimeRecoveries.size === 0) return;
    const recovered = [...this.#pendingRuntimeRecoveries];
    this.#pendingRuntimeRecoveries.clear();
    await Promise.allSettled(
      recovered.map((code) => this.#emit({ type: "runtime_recovered", code })),
    );
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
  readonly #restProvider: () => REST;

  public constructor(options: NodeDiscordRestOptions) {
    const token = validatedToken(options.botToken);
    const sdkOptions = nodeDiscordRestSdkOptions(options);
    const provider = (options as InternalNodeDiscordRestOptions)[NODE_DISCORD_REST_PROVIDER];
    if (provider === undefined) {
      const rest = new REST(sdkOptions);
      rest.setToken(token);
      this.#restProvider = () => rest;
      return;
    }
    this.#restProvider = provider;
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
      response = await this.#restProvider().get(commandCollectionRoute(scope), {
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
      const response = await this.#restProvider().post(commandCollectionRoute(scope), {
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
      const response = await this.#restProvider().patch(commandItemRoute(scope, providerCommandId), {
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
      await this.#restProvider().delete(commandItemRoute(scope, providerCommandId), {
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
    rest: REST = this.#restProvider(),
  ): Promise<DiscordDeliveryReceipt> {
    let response: unknown;
    try {
      response = await rest.post(Routes.channelMessages(channelId), {
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
    const rest = this.#restProvider();
    let response: unknown;
    try {
      response = await rest.post(Routes.userChannels(), {
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
    return this.sendMessageToChannel(channelId, input.message, input.signal, true, rest);
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
  guildResources: DiscordGuildResourcePort;
  profiles: DiscordProfileQueryPort;
  presence: DiscordPresencePort;
  events: DiscordGatewayEventPort;
  moderation: DiscordModerationPort;
  botAutoMod: DiscordBotAutoModPort;
  nativeAutoMod: DiscordNativeAutoModPort;
  voiceRooms: DiscordVoiceRoomPort;
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
  const gatewayOptions: InternalNodeDiscordGatewayOptions = {
    ...options.gateway,
    botToken: options.botToken,
    ...(options.rest === undefined
      ? {}
      : { [NODE_DISCORD_GATEWAY_REST_OPTIONS]: options.rest }),
  };
  const gateway = new NodeDiscordGatewayAdapter(gatewayOptions);
  const restProvider = NODE_DISCORD_GATEWAY_REST_PROVIDERS.get(gateway);
  if (restProvider === undefined) {
    throw new DiscordCoreError(
      "DISCORD_PROVIDER_FAILURE",
      "Discord REST coordinator is unavailable.",
      false,
    );
  }
  const restOptions: InternalNodeDiscordRestOptions = {
    ...(options.rest ?? {}),
    botToken: options.botToken,
    [NODE_DISCORD_REST_PROVIDER]: restProvider,
  };
  const rest = new NodeDiscordRestAdapter(restOptions);
  return Object.freeze({
    gateway,
    extensions: gateway,
    inspection: gateway,
    guilds: gateway,
    guildResources: gateway,
    profiles: gateway,
    presence: gateway,
    events: gateway,
    moderation: gateway,
    botAutoMod: gateway,
    nativeAutoMod: gateway,
    voiceRooms: gateway,
    commands: rest,
    messages: rest,
  });
};
