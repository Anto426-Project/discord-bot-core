import { ActivityType, BaseInteraction, ChannelType, Client, DiscordAPIError, Events, GatewayIntentBits, HTTPError, MessageFlags, Partials, PermissionFlagsBits, REST, RateLimitError, Routes, version as discordJsVersion, } from "discord.js";
import { fingerprintDiscordChatInputCommand, } from "./command-publisher.js";
import { discordModal, discordTextInput, } from "./components.js";
import { DiscordCoreError } from "./errors.js";
import { parseDiscordSnowflake } from "./identifiers.js";
import { createSafeDiscordMessage, encodeSafeDiscordActionRows, encodeSafeDiscordEmbeds, } from "./payload.js";
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
];
const PRIVILEGED_INTENTS = new Set([
    "GuildMembers",
    "GuildPresences",
    "MessageContent",
]);
const INTENT_BITS = Object.freeze({
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
const PARTIALS = Object.freeze({
    channel: Partials.Channel,
    guild_member: Partials.GuildMember,
    message: Partials.Message,
    reaction: Partials.Reaction,
    user: Partials.User,
    guild_scheduled_event: Partials.GuildScheduledEvent,
    thread_member: Partials.ThreadMember,
    soundboard_sound: Partials.SoundboardSound,
});
const boundedInteger = (value, fallback, minimum, maximum, label) => {
    const resolved = value ?? fallback;
    if (!Number.isSafeInteger(resolved) || resolved < minimum || resolved > maximum) {
        throw new RangeError(`${label} must be an integer from ${minimum} to ${maximum}.`);
    }
    return resolved;
};
const isAbortRequested = (signal) => signal?.aborted === true;
/**
 * Creates the private provider client with closed mention defaults. Privileged gateway
 * intents must be acknowledged individually by the owning product; the core
 * never silently enables a privileged profile for a smaller bot.
 */
const createClient = (options) => {
    if (options.intents.length < 1 || options.intents.length > 32) {
        throw new RangeError("Discord gateway intent profile must contain from 1 to 32 intents.");
    }
    const acknowledged = new Set(options.acknowledgedPrivilegedIntents ?? []);
    const unique = new Set();
    const intents = [];
    for (const intent of options.intents) {
        if (unique.has(intent)) {
            throw new TypeError("Discord gateway intent profile cannot contain duplicates.");
        }
        const bit = INTENT_BITS[intent];
        if (PRIVILEGED_INTENTS.has(intent) && !acknowledged.has(intent)) {
            throw new DiscordCoreError("DISCORD_INVALID_INPUT", "A privileged Discord gateway intent was not explicitly acknowledged.", false);
        }
        unique.add(intent);
        intents.push(bit);
    }
    for (const intent of acknowledged) {
        if (!unique.has(intent)) {
            throw new DiscordCoreError("DISCORD_INVALID_INPUT", "A privileged intent acknowledgement does not match the configured profile.", false);
        }
    }
    const partials = options.partials?.map((partial) => PARTIALS[partial]);
    return new Client({
        intents,
        allowedMentions: { parse: [], users: [], roles: [], repliedUser: false },
        enforceNonce: true,
        failIfNotExists: false,
        closeTimeout: boundedInteger(options.closeTimeoutMs, 5_000, 1_000, 30_000, "closeTimeoutMs"),
        waitGuildTimeout: boundedInteger(options.waitGuildTimeoutMs, 15_000, 1_000, 60_000, "waitGuildTimeoutMs"),
        ...(partials === undefined ? {} : { partials: Object.freeze(partials) }),
    });
};
const boundedDataArray = (value, minimum, maximum, label) => {
    if (!Array.isArray(value) ||
        Object.getPrototypeOf(value) !== Array.prototype ||
        value.length < minimum ||
        value.length > maximum) {
        throw new DiscordCoreError("DISCORD_PAYLOAD_REJECTED", `${label} is invalid.`, false);
    }
    const result = [];
    for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor === undefined || !("value" in descriptor)) {
            throw new DiscordCoreError("DISCORD_PAYLOAD_REJECTED", `${label} must be a dense data array.`, false);
        }
        result.push(descriptor.value);
    }
    return Object.freeze(result);
};
const MAXIMUM_CACHED_GUILDS = 100_000;
const MAXIMUM_GUILD_ROLES = 500;
const MAXIMUM_MEMBER_PAGE_SIZE = 1_000;
const MAXIMUM_MEMBER_ROLE_IDS = 500;
const MAXIMUM_GUILD_MEMBERS = 100_000_000;
const responseBoundedInteger = (value, minimum, maximum, label) => {
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
        throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", `${label} is invalid.`, false);
    }
    return value;
};
const responseBoolean = (value, label) => {
    if (typeof value !== "boolean") {
        throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", `${label} is invalid.`, false);
    }
    return value;
};
const responseSnowflake = (value, label) => {
    if (typeof value !== "string") {
        throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", `${label} is invalid.`, false);
    }
    try {
        return parseDiscordSnowflake(value, label);
    }
    catch {
        throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", `${label} is invalid.`, false);
    }
};
const responseTextValue = (value, minimum, maximum, label) => {
    if (typeof value !== "string" ||
        value.length < minimum ||
        value.length > maximum ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) {
        throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", `${label} is invalid.`, false);
    }
    return value;
};
const responseNullableTextValue = (value, maximum, label) => value === null
    ? null
    : responseTextValue(value, 0, maximum, label);
const responseTimestamp = (value, label) => {
    if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
        throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", `${label} is invalid.`, false);
    }
    const timestamp = value.toISOString();
    if (Date.parse(timestamp) !== value.getTime()) {
        throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", `${label} is invalid.`, false);
    }
    return timestamp;
};
const responseNullableTimestamp = (value, label) => value === null ? null : responseTimestamp(value, label);
const IMAGE_FORMATS = Object.freeze([
    "png",
    "jpg",
    "webp",
]);
const IMAGE_SIZES = Object.freeze([
    512,
    1_024,
    4_096,
]);
const DISCORD_ASSET_HOSTS = new Set(["cdn.discordapp.com", "media.discordapp.net"]);
const responseAssetUrl = (value, format, size) => {
    if (typeof value !== "string" || value.length < 1 || value.length > 2_048) {
        throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord asset URL is invalid.", false);
    }
    let parsed;
    try {
        parsed = new URL(value);
    }
    catch {
        throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord asset URL is invalid.", false);
    }
    if (parsed.protocol !== "https:" ||
        !DISCORD_ASSET_HOSTS.has(parsed.hostname) ||
        parsed.username !== "" ||
        parsed.password !== "" ||
        parsed.port !== "" ||
        parsed.hash !== "" ||
        !parsed.pathname.toLowerCase().endsWith(`.${format}`) ||
        parsed.searchParams.get("size") !== String(size) ||
        [...parsed.searchParams.keys()].some((key) => key !== "size")) {
        throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord asset URL is invalid.", false);
    }
    return parsed.toString();
};
const materializeImageAsset = (render) => {
    const urls = {};
    let present = null;
    for (const format of IMAGE_FORMATS) {
        const sizes = {};
        for (const size of IMAGE_SIZES) {
            const rendered = render(format, size);
            const hasValue = rendered !== null;
            present ??= hasValue;
            if (present !== hasValue) {
                throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord asset variants are inconsistent.", false);
            }
            if (rendered !== null)
                sizes[size] = responseAssetUrl(rendered, format, size);
        }
        if (present === true)
            urls[format] = Object.freeze(sizes);
    }
    return present === true
        ? Object.freeze({ urls: Object.freeze(urls) })
        : null;
};
const materializeDefaultUserImageAsset = (value) => {
    if (typeof value !== "string" || value.length < 1 || value.length > 2_048) {
        throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord asset URL is invalid.", false);
    }
    let parsed;
    try {
        parsed = new URL(value);
    }
    catch {
        throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord asset URL is invalid.", false);
    }
    if (parsed.protocol !== "https:" ||
        !DISCORD_ASSET_HOSTS.has(parsed.hostname) ||
        parsed.username !== "" ||
        parsed.password !== "" ||
        parsed.port !== "" ||
        parsed.hash !== "" ||
        !/^\/embed\/avatars\/[0-9]+\.png$/u.test(parsed.pathname) ||
        [...parsed.searchParams.keys()].some((key) => key !== "size")) {
        throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord asset URL is invalid.", false);
    }
    const sizes = {};
    for (const size of IMAGE_SIZES) {
        const rendered = new URL(parsed);
        rendered.searchParams.set("size", String(size));
        sizes[size] = responseAssetUrl(rendered.toString(), "png", size);
    }
    return Object.freeze({
        urls: Object.freeze({ png: Object.freeze(sizes) }),
    });
};
const userImageAsset = (user) => {
    if (user.avatar === null) {
        return materializeDefaultUserImageAsset(user.defaultAvatarURL);
    }
    const asset = materializeImageAsset((format, size) => user.displayAvatarURL({ extension: format, size, forceStatic: true }));
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
]);
const roleSnapshot = (role, expectedGuildId) => {
    const guildId = responseSnowflake(role.guild.id, "Discord role guild id");
    if (guildId !== expectedGuildId) {
        throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord role belongs to another guild.", false);
    }
    const permissions = [];
    for (const [permission, flag] of GUILD_PERMISSION_FLAGS) {
        if (role.permissions.has(flag))
            permissions.push(permission);
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
const memberRoleIds = (member, expectedGuildId) => {
    if (member.guild.id !== expectedGuildId) {
        throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord member role collection is invalid.", false);
    }
    if (member.roles.cache.size > MAXIMUM_MEMBER_ROLE_IDS) {
        throw new DiscordCoreError("DISCORD_RESPONSE_TOO_LARGE", "Discord member role collection exceeds its limit.", false);
    }
    const ids = [];
    const unique = new Set();
    for (const [cacheId, role] of member.roles.cache) {
        const id = responseSnowflake(role.id, "Discord member role id");
        const guildId = responseSnowflake(role.guild.id, "Discord member role guild id");
        if (cacheId !== id || guildId !== expectedGuildId || unique.has(id)) {
            throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord member role collection is inconsistent.", false);
        }
        unique.add(id);
        ids.push(id);
    }
    ids.sort((left, right) => left.localeCompare(right, "en"));
    return Object.freeze(ids);
};
const memberSnapshot = (member, expectedGuildId) => {
    const guildId = responseSnowflake(member.guild.id, "Discord member guild id");
    if (guildId !== expectedGuildId) {
        throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord member belongs to another guild.", false);
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
const inventoryEntry = (guild) => Object.freeze({
    id: responseSnowflake(guild.id, "Discord guild id"),
    name: responseTextValue(guild.name, 1, 100, "Discord guild name"),
    shardId: responseBoundedInteger(guild.shardId, 0, 4_095, "Discord guild shard id"),
    memberCount: responseBoundedInteger(guild.memberCount, 0, MAXIMUM_GUILD_MEMBERS, "Discord guild member count"),
});
const userProfile = (user) => Object.freeze({
    id: responseSnowflake(user.id, "Discord user id"),
    username: responseTextValue(user.username, 1, 80, "Discord username"),
    displayName: responseTextValue(user.displayName, 1, 128, "Discord user display name"),
    tag: responseTextValue(user.tag, 1, 128, "Discord user tag"),
    bot: responseBoolean(user.bot, "Discord user bot flag"),
    createdAt: responseTimestamp(user.createdAt, "Discord user creation timestamp"),
    avatar: userImageAsset(user),
});
const memberProfile = (member, expectedGuildId) => {
    const snapshot = memberSnapshot(member, expectedGuildId);
    if (member.roles.cache.size > MAXIMUM_GUILD_ROLES) {
        throw new DiscordCoreError("DISCORD_RESPONSE_TOO_LARGE", "Discord member role profile exceeds its limit.", false);
    }
    const roles = [...member.roles.cache.values()]
        .map((role) => roleSnapshot(role, snapshot.guildId))
        .sort((left, right) => left.id.localeCompare(right.id, "en"));
    if (roles.length !== snapshot.roleIds.length ||
        roles.some((role, index) => role.id !== snapshot.roleIds[index])) {
        throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord member role profile is inconsistent.", false);
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
const guildProfile = (guild) => {
    const inventory = inventoryEntry(guild);
    return Object.freeze({
        ...inventory,
        ownerId: responseSnowflake(guild.ownerId, "Discord guild owner id"),
        description: responseNullableTextValue(guild.description, 4_096, "Discord guild description"),
        premiumTier: responseBoundedInteger(guild.premiumTier, 0, 3, "Discord guild premium tier"),
        premiumSubscriptionCount: responseBoundedInteger(guild.premiumSubscriptionCount ?? 0, 0, MAXIMUM_GUILD_MEMBERS, "Discord guild premium subscription count"),
        createdAt: responseTimestamp(guild.createdAt, "Discord guild creation timestamp"),
        icon: materializeImageAsset((format, size) => guild.iconURL({ extension: format, size, forceStatic: true })),
        banner: materializeImageAsset((format, size) => guild.bannerURL({ extension: format, size, forceStatic: true })),
        splash: materializeImageAsset((format, size) => guild.splashURL({ extension: format, size, forceStatic: true })),
    });
};
const PRESENCE_ACTIVITY_TYPES = Object.freeze({
    playing: ActivityType.Playing,
    listening: ActivityType.Listening,
    watching: ActivityType.Watching,
    streaming: ActivityType.Streaming,
    competing: ActivityType.Competing,
});
const PRESENCE_STATUSES = new Set([
    "online",
    "idle",
    "dnd",
    "invisible",
]);
const TEXT_CHANNEL_TYPES = new Set([
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
    ChannelType.GuildForum,
    ChannelType.GuildMedia,
]);
const VOICE_CHANNEL_TYPES = new Set([
    ChannelType.GuildVoice,
    ChannelType.GuildStageVoice,
]);
const isProviderNotFoundError = (error) => {
    if (error instanceof DiscordAPIError) {
        return error.status === 404 || error.code === 10_004 || error.code === 10_007 || error.code === 10_013;
    }
    if (error === null || typeof error !== "object")
        return false;
    const status = Reflect.get(error, "status");
    const code = Reflect.get(error, "code");
    return status === 404 || code === 10_004 || code === 10_007 || code === 10_013;
};
const profileReadMode = (value) => {
    const resolved = value ?? "cache_or_fetch";
    if (resolved !== "cache" && resolved !== "cache_or_fetch" && resolved !== "provider") {
        throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Discord profile read mode is invalid.", false);
    }
    return resolved;
};
const inputPageLimit = (value) => {
    if (!Number.isSafeInteger(value) || value < 1 || value > MAXIMUM_MEMBER_PAGE_SIZE) {
        throw new DiscordCoreError("DISCORD_INVALID_INPUT", `Discord member page limit must be an integer from 1 to ${MAXIMUM_MEMBER_PAGE_SIZE}.`, false);
    }
    return value;
};
const inputDataProperty = (input, key, label, optional = false) => {
    if (input === null || typeof input !== "object" || Array.isArray(input)) {
        throw new DiscordCoreError("DISCORD_INVALID_INPUT", `${label} is invalid.`, false);
    }
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (descriptor === undefined) {
        if (optional)
            return undefined;
        throw new DiscordCoreError("DISCORD_INVALID_INPUT", `${label} is invalid.`, false);
    }
    if (!("value" in descriptor)) {
        throw new DiscordCoreError("DISCORD_INVALID_INPUT", `${label} is invalid.`, false);
    }
    return descriptor.value;
};
const inputSnowflake = (value, label) => {
    if (typeof value !== "string") {
        throw new DiscordCoreError("DISCORD_INVALID_INPUT", `${label} is invalid.`, false);
    }
    return parseDiscordSnowflake(value, label);
};
const inputAbortSignal = (value, label) => {
    if (value === undefined)
        return undefined;
    if (!(value instanceof AbortSignal)) {
        throw new DiscordCoreError("DISCORD_INVALID_INPUT", `${label} is invalid.`, false);
    }
    return value;
};
const encodeTextInput = (component) => Object.freeze({
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
const encodeModal = (modal) => {
    const sourceRows = boundedDataArray(modal.rows, 1, 5, "Discord modal rows");
    const safeModal = discordModal({
        customId: modal.customId,
        title: modal.title,
        inputs: sourceRows.map((row) => discordTextInput(row.component)),
    });
    return Object.freeze({
        custom_id: safeModal.customId,
        title: safeModal.title,
        components: safeModal.rows.map((row) => Object.freeze({ type: 1, components: Object.freeze([encodeTextInput(row.component)]) })),
    });
};
const encodeInteractionMessage = (plan, allowVisibility) => {
    if (plan.content !== undefined &&
        (typeof plan.content !== "string" || plan.content.length < 1 || plan.content.length > 2_000)) {
        throw new DiscordCoreError("DISCORD_PAYLOAD_REJECTED", "Discord interaction content must contain between 1 and 2000 characters.", false);
    }
    const embeds = encodeSafeDiscordEmbeds(plan.embeds);
    const components = encodeSafeDiscordActionRows(plan.components);
    if (plan.content === undefined && embeds.length === 0 && (components?.length ?? 0) === 0) {
        throw new DiscordCoreError("DISCORD_PAYLOAD_REJECTED", "Discord response is empty.", false);
    }
    const visibility = "visibility" in plan ? plan.visibility : undefined;
    if (visibility !== undefined && visibility !== "public" && visibility !== "ephemeral") {
        throw new DiscordCoreError("DISCORD_PAYLOAD_REJECTED", "Discord response visibility is invalid.", false);
    }
    if (!allowVisibility && visibility !== undefined) {
        throw new DiscordCoreError("DISCORD_PAYLOAD_REJECTED", "Discord editable response cannot change visibility.", false);
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
class NodeDiscordInteractionResponder {
    #interaction;
    constructor(interaction) {
        this.#interaction = interaction;
    }
    get replied() {
        return this.#interaction.replied;
    }
    get deferred() {
        return this.#interaction.deferred;
    }
    async reply(plan) {
        await this.#perform(() => this.#interaction.reply(encodeInteractionMessage(plan, true)));
    }
    async deferReply(visibility = "public") {
        await this.#perform(() => this.#interaction.deferReply(visibility === "ephemeral" ? { flags: MessageFlags.Ephemeral } : {}));
    }
    async editReply(plan) {
        await this.#perform(() => this.#interaction.editReply(encodeInteractionMessage(plan, false)));
    }
    async followUp(plan) {
        await this.#perform(() => this.#interaction.followUp(encodeInteractionMessage(plan, true)));
    }
    async deferUpdate() {
        const interaction = this.#interaction;
        if (!interaction.isMessageComponent() && !interaction.isModalSubmit()) {
            throw new DiscordCoreError("DISCORD_INVALID_INPUT", "This Discord interaction cannot defer a component update.", false);
        }
        await this.#perform(() => interaction.deferUpdate());
    }
    async update(plan) {
        const interaction = this.#interaction;
        if (!interaction.isMessageComponent()) {
            throw new DiscordCoreError("DISCORD_INVALID_INPUT", "This Discord interaction cannot update its source message.", false);
        }
        await this.#perform(() => interaction.update(encodeInteractionMessage(plan, false)));
    }
    async showModal(modal) {
        const interaction = this.#interaction;
        if (!interaction.isCommand() && !interaction.isMessageComponent()) {
            throw new DiscordCoreError("DISCORD_INVALID_INPUT", "This Discord interaction cannot open a modal.", false);
        }
        await this.#perform(() => interaction.showModal(encodeModal(modal)));
    }
    async #perform(operation) {
        try {
            await operation();
        }
        catch (error) {
            // DiscordAPIError includes the provider URL and request body. Interaction
            // URLs contain a bearer-equivalent interaction token, so the raw SDK
            // error must never cross the adapter boundary.
            throw providerFailure(error);
        }
    }
}
const interactionUser = (interaction) => Object.freeze({
    id: parseDiscordSnowflake(interaction.user.id, "Discord interaction user id"),
    username: interaction.user.username,
    globalName: interaction.user.globalName,
    avatarUrl: interaction.user.displayAvatarURL(),
});
const interactionGuild = (interaction) => interaction.guild === null
    ? null
    : Object.freeze({
        id: parseDiscordSnowflake(interaction.guild.id, "Discord interaction guild id"),
        name: interaction.guild.name,
        iconUrl: interaction.guild.iconURL(),
    });
const interactionBot = (interaction) => {
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
const interactionBase = (interaction) => Object.freeze({
    id: parseDiscordSnowflake(interaction.id, "Discord interaction id"),
    locale: interaction.locale,
    channelId: interaction.channelId === null
        ? null
        : parseDiscordSnowflake(interaction.channelId, "Discord interaction channel id"),
    user: interactionUser(interaction),
    guild: interactionGuild(interaction),
    bot: interactionBot(interaction),
    createdAt: interaction.createdAt.toISOString(),
    responder: new NodeDiscordInteractionResponder(interaction),
});
const commandOptions = (interaction) => Object.freeze({
    getBoolean: (name, required) => interaction.options.getBoolean(name, required),
    getUser: (name, required) => {
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
    getSubcommand: (required) => required === undefined
        ? interaction.options.getSubcommand()
        : interaction.options.getSubcommand(required),
    getString: (name, required) => interaction.options.getString(name, required),
    getInteger: (name, required) => interaction.options.getInteger(name, required),
    getNumber: (name, required) => interaction.options.getNumber(name, required),
    getChannelId: (name, required) => interaction.options.getChannel(name, required)?.id ?? null,
    getRoleId: (name, required) => interaction.options.getRole(name, required)?.id ?? null,
});
const normalizeInteraction = (interaction) => {
    if (!interaction.isRepliable())
        return null;
    const base = interactionBase(interaction);
    if (interaction.isChatInputCommand()) {
        return Object.freeze({
            ...base,
            kind: "chat_input",
            commandName: interaction.commandName,
            options: commandOptions(interaction),
        });
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
        const fields = Object.freeze({
            getText: (customId) => interaction.fields.getTextInputValue(customId),
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
export const normalizeNodeDiscordInteraction = (value) => {
    try {
        if (!(value instanceof BaseInteraction))
            return null;
        return normalizeInteraction(value);
    }
    catch (error) {
        throw providerFailure(error);
    }
};
const NODE_DISCORD_PROVIDER_EXTENSION_PROTOCOL = Symbol("node-discord-provider-extension");
const providerExtensionProtocol = (extension) => {
    if (extension === null || typeof extension !== "object") {
        throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Discord provider extension is invalid.", false);
    }
    const descriptor = Object.getOwnPropertyDescriptor(extension, NODE_DISCORD_PROVIDER_EXTENSION_PROTOCOL);
    if (descriptor === undefined || !("value" in descriptor)) {
        throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Discord provider extension protocol is missing.", false);
    }
    const protocol = descriptor.value;
    if (protocol === null || typeof protocol !== "object") {
        throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Discord provider extension protocol is invalid.", false);
    }
    const keyDescriptor = Object.getOwnPropertyDescriptor(protocol, "key");
    const bindDescriptor = Object.getOwnPropertyDescriptor(protocol, "bindProviderClient");
    const releaseDescriptor = Object.getOwnPropertyDescriptor(protocol, "releaseProviderClient");
    if (keyDescriptor === undefined ||
        !("value" in keyDescriptor) ||
        typeof keyDescriptor.value !== "string" ||
        !/^[a-z][a-z0-9.-]{2,127}$/u.test(keyDescriptor.value) ||
        bindDescriptor === undefined ||
        !("value" in bindDescriptor) ||
        typeof bindDescriptor.value !== "function" ||
        releaseDescriptor === undefined ||
        !("value" in releaseDescriptor) ||
        typeof releaseDescriptor.value !== "function") {
        throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Discord provider extension protocol is invalid.", false);
    }
    return Object.freeze({
        owner: extension,
        protocol: Object.freeze({
            key: keyDescriptor.value,
            bindProviderClient: bindDescriptor.value,
            releaseProviderClient: releaseDescriptor.value,
        }),
    });
};
/**
 * Creates the opaque bridge understood by the Node runtime. The private Symbol
 * and protocol shape remain owned here; companion packages expose ordinary
 * callbacks and do not need to duplicate this implementation detail.
 */
export const createNodeDiscordProviderExtension = (options) => {
    if (options === null || typeof options !== "object") {
        throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Discord provider extension is invalid.", false);
    }
    const keyDescriptor = Object.getOwnPropertyDescriptor(options, "key");
    const bindDescriptor = Object.getOwnPropertyDescriptor(options, "bindProviderClient");
    const releaseDescriptor = Object.getOwnPropertyDescriptor(options, "releaseProviderClient");
    if (keyDescriptor === undefined ||
        !("value" in keyDescriptor) ||
        typeof keyDescriptor.value !== "string" ||
        !/^[a-z][a-z0-9.-]{2,127}$/u.test(keyDescriptor.value) ||
        bindDescriptor === undefined ||
        !("value" in bindDescriptor) ||
        typeof bindDescriptor.value !== "function" ||
        releaseDescriptor === undefined ||
        !("value" in releaseDescriptor) ||
        typeof releaseDescriptor.value !== "function") {
        throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Discord provider extension callbacks are invalid.", false);
    }
    const key = keyDescriptor.value;
    const bind = bindDescriptor.value;
    const release = releaseDescriptor.value;
    const protocol = Object.freeze({
        key,
        bindProviderClient: (providerClient, generation) => bind(providerClient, generation),
        releaseProviderClient: (generation, signal) => release(generation, signal),
    });
    const extension = Object.create(null);
    Object.defineProperty(extension, NODE_DISCORD_PROVIDER_EXTENSION_PROTOCOL, {
        value: protocol,
        enumerable: false,
        configurable: false,
        writable: false,
    });
    return Object.freeze(extension);
};
export class NodeDiscordGatewayAdapter {
    #client;
    #clientFactory;
    #botToken;
    #listeners = new Set();
    #interactionListeners = new Set();
    #startupTimeoutMs;
    #shutdownTimeoutMs;
    #listenerTimeoutMs;
    #queryTimeoutMs;
    #maximumConcurrentQueries;
    #providerExtensions = new Map();
    #inFlightQueries = new Map();
    #clientGeneration = 1;
    #queryAbortController = new AbortController();
    #extensionsFrozen = false;
    #startPromise = null;
    #providerLoginPromise = null;
    #startupController = null;
    #stopPromise = null;
    #stopRequested = false;
    constructor(options) {
        this.#botToken = validatedToken(options.botToken);
        const clientOptions = Object.freeze({
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
        this.#startupTimeoutMs = boundedInteger(options.startupTimeoutMs, 30_000, 1_000, 120_000, "startupTimeoutMs");
        this.#shutdownTimeoutMs = boundedInteger(options.closeTimeoutMs, 5_000, 1_000, 30_000, "closeTimeoutMs");
        this.#listenerTimeoutMs = boundedInteger(options.listenerTimeoutMs, 5_000, 100, 30_000, "listenerTimeoutMs");
        this.#queryTimeoutMs = boundedInteger(options.queryTimeoutMs, 10_000, 100, 30_000, "queryTimeoutMs");
        this.#maximumConcurrentQueries = boundedInteger(options.maximumConcurrentQueries, 64, 1, 256, "maximumConcurrentQueries");
        this.#attachClient(this.#client);
    }
    #attachClient(client) {
        client.on(Events.ClientReady, (readyClient) => {
            if (this.#client !== client || this.#stopRequested)
                return;
            void this.#emit({ type: "ready", identity: this.#identity(readyClient) });
        });
        client.on(Events.ShardResume, (shardId) => {
            if (this.#client !== client || this.#stopRequested)
                return;
            void this.#emit({ type: "shard_resumed", shardId });
        });
        client.on(Events.ShardDisconnect, (closeEvent, shardId) => {
            if (this.#client !== client || this.#stopRequested)
                return;
            void this.#emit({
                type: "shard_disconnected",
                shardId,
                closeCode: Number.isInteger(closeEvent.code) ? closeEvent.code : null,
            });
        });
        client.on(Events.ShardReconnecting, (shardId) => {
            if (this.#client !== client || this.#stopRequested)
                return;
            void this.#emit({ type: "shard_reconnecting", shardId });
        });
        client.on(Events.Error, () => {
            if (this.#client !== client || this.#stopRequested)
                return;
            void this.#emit({ type: "provider_error", code: "DISCORD_GATEWAY_ERROR" });
        });
        client.on(Events.InteractionCreate, (interaction) => {
            if (this.#client !== client || this.#stopRequested)
                return;
            const normalized = normalizeInteraction(interaction);
            if (normalized !== null)
                void this.#emitInteraction(normalized);
        });
    }
    async #replaceStoppedClient() {
        const client = this.#clientFactory();
        this.#client = client;
        this.#clientGeneration += 1;
        this.#queryAbortController = new AbortController();
        this.#attachClient(client);
        try {
            this.#bindProviderExtensions(client, this.#clientGeneration);
        }
        catch (error) {
            await this.#releaseProviderExtensions(this.#clientGeneration).catch(() => undefined);
            await client.destroy().catch(() => undefined);
            throw error instanceof DiscordCoreError ? error : providerFailure(error);
        }
    }
    async start(signal) {
        if (isAbortRequested(signal)) {
            throw new DiscordCoreError("DISCORD_CANCELLED", "Discord gateway startup was cancelled.", false);
        }
        if (this.#stopPromise !== null)
            await this.#stopPromise;
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
            void pending.then(() => this.#clearStartup(pending, controller), () => this.#clearStartup(pending, controller));
        }
        return this.#awaitStartupForCaller(shared, signal);
    }
    async #startSharedGeneration(signal) {
        if (this.#providerLoginPromise !== null) {
            throw new DiscordCoreError("DISCORD_CIRCUIT_OPEN", "A previous Discord gateway login has not settled.", true);
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
                throw new DiscordCoreError("DISCORD_CANCELLED", "Discord gateway startup was cancelled.", false);
            }
            this.#assertProviderExtensionsReady();
            this.#stopRequested = false;
        }
        else {
            this.#assertProviderExtensionsReady();
        }
        return this.#startOnce(signal);
    }
    async stop() {
        if (this.#stopPromise !== null)
            return this.#stopPromise;
        this.#extensionsFrozen = true;
        const startup = this.#startPromise;
        const providerLogin = this.#providerLoginPromise;
        this.#stopRequested = true;
        this.#queryAbortController.abort();
        this.#inFlightQueries.delete(this.#clientGeneration);
        this.#startupController?.abort();
        const stopping = (async () => {
            if (startup !== null) {
                try {
                    await startup;
                }
                catch {
                    // Startup failure is reported to its caller. Shutdown still owns the
                    // final provider cleanup and must not expose the raw SDK error.
                }
            }
            await this.#shutdownProviderLogin(providerLogin);
        })();
        this.#stopPromise = stopping;
        try {
            await stopping;
        }
        finally {
            if (this.#stopPromise === stopping)
                this.#stopPromise = null;
        }
    }
    async #startOnce(signal) {
        if (this.#client.isReady())
            return this.#identity(this.#client);
        let ready;
        const readyPromise = new Promise((resolve) => {
            ready = resolve;
        });
        const onReady = () => ready();
        this.#client.once(Events.ClientReady, onReady);
        let rejectTimeout;
        const timeoutPromise = new Promise((_resolve, reject) => {
            rejectTimeout = reject;
        });
        const timeout = setTimeout(() => rejectTimeout(new DiscordCoreError("DISCORD_TIMEOUT", "Discord gateway did not become ready before its deadline.", true)), this.#startupTimeoutMs);
        let rejectCancellation;
        const cancellationPromise = new Promise((_resolve, reject) => {
            rejectCancellation = reject;
        });
        const onAbort = () => rejectCancellation(new DiscordCoreError("DISCORD_CANCELLED", "Discord gateway startup was cancelled.", false));
        signal.addEventListener("abort", onAbort, { once: true });
        const providerLogin = this.#beginProviderLogin();
        try {
            await Promise.race([
                (async () => {
                    await providerLogin;
                    if (!this.#client.isReady())
                        await readyPromise;
                })(),
                timeoutPromise,
                cancellationPromise,
            ]);
            return this.#identity(this.#client);
        }
        catch (error) {
            this.#stopRequested = true;
            if (!signal.aborted) {
                await this.#shutdownProviderLogin(providerLogin);
            }
            if (error instanceof DiscordCoreError)
                throw error;
            throw providerFailureForSignal(error, signal);
        }
        finally {
            clearTimeout(timeout);
            signal.removeEventListener("abort", onAbort);
            this.#client.off(Events.ClientReady, onReady);
        }
    }
    async #awaitStartupForCaller(startup, signal) {
        if (signal === undefined)
            return startup;
        if (signal.aborted) {
            throw new DiscordCoreError("DISCORD_CANCELLED", "Discord gateway startup was cancelled.", false);
        }
        let rejectCancellation;
        const cancellation = new Promise((_resolve, reject) => {
            rejectCancellation = reject;
        });
        const onAbort = () => rejectCancellation(new DiscordCoreError("DISCORD_CANCELLED", "Discord gateway startup was cancelled.", false));
        signal.addEventListener("abort", onAbort, { once: true });
        try {
            return await Promise.race([startup, cancellation]);
        }
        finally {
            signal.removeEventListener("abort", onAbort);
        }
    }
    #clearStartup(startup, controller) {
        if (this.#startPromise === startup)
            this.#startPromise = null;
        if (this.#startupController === controller)
            this.#startupController = null;
    }
    #beginProviderLogin() {
        if (this.#providerLoginPromise !== null) {
            throw new DiscordCoreError("DISCORD_CIRCUIT_OPEN", "A Discord gateway login is already active.", true);
        }
        let login;
        try {
            login = this.#client.login(this.#botToken);
        }
        catch (error) {
            login = Promise.reject(error);
        }
        const providerLogin = login.then(() => undefined);
        this.#providerLoginPromise = providerLogin;
        void providerLogin.then(() => this.#clearProviderLogin(providerLogin), () => this.#clearProviderLogin(providerLogin));
        return providerLogin;
    }
    #clearProviderLogin(providerLogin) {
        if (this.#providerLoginPromise === providerLogin)
            this.#providerLoginPromise = null;
    }
    async #shutdownProviderLogin(providerLogin) {
        let failure = null;
        const recordFailure = (error) => {
            failure ??= error instanceof DiscordCoreError ? error : providerFailure(error);
        };
        try {
            await this.#releaseProviderExtensions(this.#clientGeneration);
        }
        catch (error) {
            recordFailure(error);
        }
        try {
            await this.#client.destroy();
        }
        catch (error) {
            recordFailure(error);
        }
        if (providerLogin !== null) {
            try {
                await this.#awaitProviderLoginSettlement(providerLogin);
            }
            catch (error) {
                recordFailure(error);
            }
            try {
                // A provider login may settle and emit Ready after the first destroy.
                // A final awaited destroy closes that late session before stop returns.
                await this.#client.destroy();
            }
            catch (error) {
                recordFailure(error);
            }
        }
        if (failure !== null)
            throw failure;
    }
    async #awaitProviderLoginSettlement(providerLogin) {
        let rejectTimeout;
        const timeoutPromise = new Promise((_resolve, reject) => {
            rejectTimeout = reject;
        });
        const timeout = setTimeout(() => rejectTimeout(new DiscordCoreError("DISCORD_TIMEOUT", "Discord gateway login did not settle during shutdown.", true)), this.#shutdownTimeoutMs);
        try {
            await Promise.race([
                providerLogin.catch(() => undefined),
                timeoutPromise,
            ]);
        }
        finally {
            clearTimeout(timeout);
        }
    }
    isReady() {
        return this.#client.isReady();
    }
    subscribeLifecycle(listener) {
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }
    subscribeInteractions(listener) {
        if (!this.#interactionListeners.has(listener) && this.#interactionListeners.size > 0) {
            throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Discord gateway accepts one interaction router per runtime.", false);
        }
        this.#interactionListeners.add(listener);
        return () => this.#interactionListeners.delete(listener);
    }
    capture() {
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
            throw new DiscordCoreError("DISCORD_RESPONSE_TOO_LARGE", "Discord guild inventory exceeds its limit.", false);
        }
        const guilds = [];
        const ids = new Set();
        let userCount = 0;
        let channelCount = 0;
        let textChannelCount = 0;
        let voiceChannelCount = 0;
        for (const [cacheId, guild] of client.guilds.cache) {
            const entry = inventoryEntry(guild);
            if (cacheId !== entry.id || ids.has(entry.id)) {
                throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord guild inventory is inconsistent.", false);
            }
            ids.add(entry.id);
            guilds.push(entry);
            userCount += entry.memberCount;
            channelCount += guild.channels.cache.size;
            for (const channel of guild.channels.cache.values()) {
                if (TEXT_CHANNEL_TYPES.has(channel.type))
                    textChannelCount += 1;
                if (VOICE_CHANNEL_TYPES.has(channel.type))
                    voiceChannelCount += 1;
            }
            for (const [value, label] of [
                [userCount, "Discord aggregate member count"],
                [channelCount, "Discord aggregate channel count"],
                [textChannelCount, "Discord aggregate text channel count"],
                [voiceChannelCount, "Discord aggregate voice channel count"],
            ]) {
                responseBoundedInteger(value, 0, MAXIMUM_GUILD_MEMBERS, label);
            }
        }
        guilds.sort((left, right) => left.id.localeCompare(right.id, "en"));
        const user = client.user;
        const application = client.application;
        const latency = client.ws.ping;
        return Object.freeze({
            connected: true,
            applicationId: application === null
                ? null
                : responseSnowflake(application.id, "Discord application id"),
            agentUserId: user === null ? null : responseSnowflake(user.id, "Discord bot user id"),
            communityCount: guilds.length,
            userCount,
            partitionCount: responseBoundedInteger(client.ws.shards.size, 0, 4_096, "Discord shard count"),
            transportLatencyMilliseconds: Number.isFinite(latency) && latency >= 0 && latency <= 1_000_000
                ? latency
                : null,
            gatewayLibraryVersion: responseTextValue(discordJsVersion, 1, 64, "Discord gateway library version"),
            channelCount,
            textChannelCount,
            voiceChannelCount,
            guilds: Object.freeze(guilds),
        });
    }
    async listRoles(input) {
        const guildId = inputSnowflake(inputDataProperty(input, "guildId", "Discord guild role-list input"), "Discord guild id");
        const signal = inputAbortSignal(inputDataProperty(input, "signal", "Discord guild role-list signal", true), "Discord guild role-list signal");
        return this.#runCurrentClientOperation(signal, async (client) => {
            const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
            if (guild.id !== guildId) {
                throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord guild response does not match the requested guild.", false);
            }
            const collection = await guild.roles.fetch();
            if (collection.size > MAXIMUM_GUILD_ROLES) {
                throw new DiscordCoreError("DISCORD_RESPONSE_TOO_LARGE", "Discord guild role collection exceeds its limit.", false);
            }
            const roles = [];
            const ids = new Set();
            for (const [collectionId, role] of collection) {
                const snapshot = roleSnapshot(role, guildId);
                if (collectionId !== snapshot.id || ids.has(snapshot.id)) {
                    throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord guild role collection is inconsistent.", false);
                }
                ids.add(snapshot.id);
                roles.push(snapshot);
            }
            roles.sort((left, right) => left.id.localeCompare(right.id, "en"));
            return Object.freeze(roles);
        });
    }
    async listMembers(input) {
        const guildId = inputSnowflake(inputDataProperty(input, "guildId", "Discord guild member-list input"), "Discord guild id");
        const limit = inputPageLimit(inputDataProperty(input, "limit", "Discord guild member-list input"));
        const afterValue = inputDataProperty(input, "after", "Discord guild member-list cursor", true);
        const after = afterValue === undefined
            ? null
            : inputSnowflake(afterValue, "Discord member page cursor");
        const signal = inputAbortSignal(inputDataProperty(input, "signal", "Discord guild member-list signal", true), "Discord guild member-list signal");
        return this.#runCurrentClientOperation(signal, async (client) => {
            const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
            if (guild.id !== guildId) {
                throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord guild response does not match the requested guild.", false);
            }
            const collection = await guild.members.list({
                limit,
                ...(after === null ? {} : { after }),
                cache: false,
            });
            if (collection.size > limit || collection.size > MAXIMUM_MEMBER_PAGE_SIZE) {
                throw new DiscordCoreError("DISCORD_RESPONSE_TOO_LARGE", "Discord guild member page exceeds its requested limit.", false);
            }
            const members = [];
            let previous = after;
            const ids = new Set();
            for (const [collectionId, providerMember] of collection) {
                const member = memberSnapshot(providerMember, guildId);
                if (collectionId !== member.userId ||
                    ids.has(member.userId) ||
                    (previous !== null && BigInt(member.userId) <= BigInt(previous))) {
                    throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord guild member page is not a strictly advancing sequence.", false);
                }
                ids.add(member.userId);
                previous = member.userId;
                members.push(member);
            }
            const nextAfter = members.length === limit ? (members.at(-1)?.userId ?? null) : null;
            if (nextAfter !== null && nextAfter === after) {
                throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord guild member page cursor did not advance.", false);
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
    async readUser(input) {
        const userId = inputSnowflake(inputDataProperty(input, "userId", "Discord user-profile input"), "Discord user id");
        const mode = profileReadMode(inputDataProperty(input, "mode", "Discord user-profile mode", true));
        const signal = inputAbortSignal(inputDataProperty(input, "signal", "Discord user-profile signal", true), "Discord user-profile signal");
        return this.#runCurrentClientOperation(signal, async (client) => {
            try {
                const cached = client.users.cache.get(userId);
                if (mode === "cache")
                    return cached === undefined ? null : userProfile(cached);
                const user = mode === "cache_or_fetch" && cached !== undefined
                    ? cached
                    : await client.users.fetch(userId, { cache: true, force: mode === "provider" });
                return userProfile(user);
            }
            catch (error) {
                if (isProviderNotFoundError(error))
                    return null;
                throw error;
            }
        });
    }
    async readMember(input) {
        const guildId = inputSnowflake(inputDataProperty(input, "guildId", "Discord member-profile input"), "Discord guild id");
        const userId = inputSnowflake(inputDataProperty(input, "userId", "Discord member-profile input"), "Discord member user id");
        const mode = profileReadMode(inputDataProperty(input, "mode", "Discord member-profile mode", true));
        const signal = inputAbortSignal(inputDataProperty(input, "signal", "Discord member-profile signal", true), "Discord member-profile signal");
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
                    throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord guild response does not match the requested guild.", false);
                }
                const member = await guild.members.fetch({
                    user: userId,
                    cache: true,
                    force: mode === "provider",
                });
                return memberProfile(member, guildId);
            }
            catch (error) {
                if (isProviderNotFoundError(error))
                    return null;
                throw error;
            }
        });
    }
    async readGuild(input) {
        const guildId = inputSnowflake(inputDataProperty(input, "guildId", "Discord guild-profile input"), "Discord guild id");
        const mode = profileReadMode(inputDataProperty(input, "mode", "Discord guild-profile mode", true));
        const signal = inputAbortSignal(inputDataProperty(input, "signal", "Discord guild-profile signal", true), "Discord guild-profile signal");
        return this.#runCurrentClientOperation(signal, async (client) => {
            try {
                const cached = client.guilds.cache.get(guildId);
                if (mode === "cache")
                    return cached === undefined ? null : guildProfile(cached);
                const guild = mode === "cache_or_fetch" && cached !== undefined
                    ? cached
                    : await client.guilds.fetch({
                        guild: guildId,
                        cache: true,
                        force: mode === "provider",
                        withCounts: true,
                    });
                if (guild.id !== guildId) {
                    throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord guild response does not match the requested guild.", false);
                }
                return guildProfile(guild);
            }
            catch (error) {
                if (isProviderNotFoundError(error))
                    return null;
                throw error;
            }
        });
    }
    async apply(plan) {
        const textValue = inputDataProperty(plan, "text", "Discord presence plan");
        if (typeof textValue !== "string") {
            throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Discord presence text is invalid.", false);
        }
        const text = textValue.trim();
        if (text.length === 0 ||
            [...text].length > 128 ||
            /[\u0000-\u001f\u007f]/u.test(text)) {
            throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Discord presence text must contain between 1 and 128 characters.", false);
        }
        const activityValue = inputDataProperty(plan, "activityType", "Discord presence plan");
        const statusValue = inputDataProperty(plan, "status", "Discord presence plan");
        if (typeof activityValue !== "string" ||
            !Object.prototype.hasOwnProperty.call(PRESENCE_ACTIVITY_TYPES, activityValue) ||
            typeof statusValue !== "string" ||
            !PRESENCE_STATUSES.has(statusValue)) {
            throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Discord presence is invalid.", false);
        }
        const activityType = activityValue;
        const status = statusValue;
        const signal = inputAbortSignal(inputDataProperty(plan, "signal", "Discord presence signal", true), "Discord presence signal");
        await this.#runCurrentClientOperation(signal, (client) => {
            const user = client.user;
            if (user === null) {
                throw new DiscordCoreError("DISCORD_CIRCUIT_OPEN", "Discord presence is unavailable before gateway readiness.", true);
            }
            user.setPresence({
                status,
                activities: [{ name: text, type: PRESENCE_ACTIVITY_TYPES[activityType] }],
            });
        });
    }
    async clear(signal) {
        const validatedSignal = inputAbortSignal(signal, "Discord presence signal");
        await this.#runCurrentClientOperation(validatedSignal, (client) => {
            const user = client.user;
            if (user === null) {
                throw new DiscordCoreError("DISCORD_CIRCUIT_OPEN", "Discord presence is unavailable before gateway readiness.", true);
            }
            user.setPresence({ activities: [] });
        });
    }
    async #runCurrentClientOperation(signal, operation) {
        if (signal?.aborted === true) {
            throw new DiscordCoreError("DISCORD_CANCELLED", "Discord operation was cancelled.", false);
        }
        const client = this.#client;
        const generation = this.#clientGeneration;
        const lifecycleSignal = this.#queryAbortController.signal;
        if (this.#stopRequested || lifecycleSignal.aborted || !client.isReady()) {
            throw new DiscordCoreError("DISCORD_CIRCUIT_OPEN", "Discord gateway is not ready for this operation.", true);
        }
        const currentCount = this.#inFlightQueries.get(generation) ?? 0;
        if (currentCount >= this.#maximumConcurrentQueries) {
            throw new DiscordCoreError("DISCORD_CIRCUIT_OPEN", "Discord concurrent query capacity was exceeded.", true);
        }
        this.#inFlightQueries.set(generation, currentCount + 1);
        const providerOperation = Promise.resolve()
            .then(() => operation(client))
            .finally(() => {
            const count = this.#inFlightQueries.get(generation);
            if (count === undefined)
                return;
            if (count <= 1)
                this.#inFlightQueries.delete(generation);
            else
                this.#inFlightQueries.set(generation, count - 1);
        });
        let rejectBoundary;
        const boundary = new Promise((_resolve, reject) => {
            rejectBoundary = reject;
        });
        const onCallerAbort = () => rejectBoundary(new DiscordCoreError("DISCORD_CANCELLED", "Discord operation was cancelled.", false));
        const onLifecycleAbort = () => rejectBoundary(new DiscordCoreError("DISCORD_CANCELLED", "Discord gateway generation stopped.", false));
        signal?.addEventListener("abort", onCallerAbort, { once: true });
        lifecycleSignal.addEventListener("abort", onLifecycleAbort, { once: true });
        const timeout = setTimeout(() => rejectBoundary(new DiscordCoreError("DISCORD_TIMEOUT", "Discord operation exceeded its deadline.", true)), this.#queryTimeoutMs);
        try {
            const result = await Promise.race([providerOperation, boundary]);
            if (this.#client !== client ||
                this.#clientGeneration !== generation ||
                this.#stopRequested ||
                lifecycleSignal.aborted ||
                !client.isReady()) {
                throw new DiscordCoreError("DISCORD_CANCELLED", "Discord gateway generation changed during the operation.", false);
            }
            return result;
        }
        catch (error) {
            if (error instanceof DiscordCoreError)
                throw error;
            if (isAbortRequested(signal) || isAbortRequested(lifecycleSignal)) {
                throw new DiscordCoreError("DISCORD_CANCELLED", "Discord operation was cancelled.", false);
            }
            throw providerFailure(error);
        }
        finally {
            clearTimeout(timeout);
            signal?.removeEventListener("abort", onCallerAbort);
            lifecycleSignal.removeEventListener("abort", onLifecycleAbort);
        }
    }
    registerProviderExtension(extension) {
        if (this.#extensionsFrozen) {
            throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Discord provider extensions must be registered before the gateway lifecycle begins.", false);
        }
        if (this.#providerExtensions.size >= 8) {
            throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Discord provider extension capacity was exceeded.", false);
        }
        const parsed = providerExtensionProtocol(extension);
        if (this.#providerExtensions.has(parsed.protocol.key)) {
            throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Discord provider extension key is already registered.", false);
        }
        const registered = {
            owner: parsed.owner,
            protocol: parsed.protocol,
            boundGeneration: null,
            releaseOperation: null,
            releaseFailed: false,
            removing: false,
        };
        this.#providerExtensions.set(registered.protocol.key, registered);
        try {
            this.#bindProviderExtension(registered, this.#client, this.#clientGeneration);
        }
        catch (error) {
            registered.removing = true;
            const failure = error instanceof DiscordCoreError
                ? error
                : new DiscordCoreError("DISCORD_INVALID_INPUT", "Discord provider extension configuration is invalid.", false);
            return this.#releaseProviderExtension(registered).then(() => {
                throw failure;
            }, () => {
                // A failed rollback remains registered and quarantined. A later stop
                // retries it; the gateway never silently loses lifecycle ownership.
                throw failure;
            });
        }
        let disposal = null;
        const dispose = () => {
            if (disposal !== null)
                return disposal;
            if (this.#providerExtensions.get(registered.protocol.key) !== registered) {
                disposal = Promise.resolve();
                return disposal;
            }
            registered.removing = true;
            if (registered.boundGeneration === null &&
                registered.releaseOperation === null) {
                this.#providerExtensions.delete(registered.protocol.key);
                disposal = Promise.resolve();
                return disposal;
            }
            disposal = this.#releaseProviderExtension(registered).catch((error) => {
                disposal = null;
                throw error;
            });
            return disposal;
        };
        return Promise.resolve(dispose);
    }
    #bindProviderExtensions(client, generation) {
        for (const registered of this.#providerExtensions.values()) {
            if (registered.removing ||
                registered.releaseOperation !== null ||
                registered.releaseFailed ||
                registered.boundGeneration !== null) {
                throw new DiscordCoreError("DISCORD_CIRCUIT_OPEN", "A Discord provider extension from the previous generation is not released.", true);
            }
        }
        for (const registered of this.#providerExtensions.values()) {
            this.#bindProviderExtension(registered, client, generation);
        }
    }
    #assertProviderExtensionsReady() {
        for (const registered of this.#providerExtensions.values()) {
            if (registered.removing ||
                registered.releaseOperation !== null ||
                registered.releaseFailed ||
                registered.boundGeneration !== this.#clientGeneration) {
                throw new DiscordCoreError("DISCORD_CIRCUIT_OPEN", "A Discord provider extension is not ready for the current gateway generation.", true);
            }
        }
    }
    #bindProviderExtension(registered, client, generation) {
        registered.boundGeneration = generation;
        try {
            const result = registered.protocol.bindProviderClient(client, generation);
            if (result !== undefined) {
                void Promise.resolve(result).catch(() => undefined);
                throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Discord provider extension bind callbacks must complete synchronously.", false);
            }
        }
        catch (error) {
            throw error instanceof DiscordCoreError
                ? error
                : new DiscordCoreError("DISCORD_INVALID_INPUT", "Discord provider extension configuration is invalid.", false);
        }
    }
    async #releaseProviderExtensions(generation) {
        const failures = await Promise.allSettled([...this.#providerExtensions.values()]
            .filter((registered) => registered.boundGeneration === generation)
            .map((registered) => this.#releaseProviderExtension(registered)));
        if (failures.some((result) => result.status === "rejected")) {
            throw new DiscordCoreError("DISCORD_PROVIDER_FAILURE", "A Discord provider extension did not stop cleanly.", true);
        }
    }
    async #releaseProviderExtension(registered) {
        const generation = registered.boundGeneration;
        if (generation === null)
            return;
        let release = registered.releaseOperation;
        let controller = null;
        if (release === null) {
            controller = new AbortController();
            registered.releaseFailed = false;
            const operation = Promise.resolve().then(() => registered.protocol.releaseProviderClient(generation, controller.signal));
            let tracked;
            tracked = operation.then(() => {
                if (registered.releaseOperation !== tracked)
                    return;
                registered.releaseOperation = null;
                registered.releaseFailed = false;
                if (registered.boundGeneration === generation) {
                    registered.boundGeneration = null;
                }
                if (registered.removing &&
                    this.#providerExtensions.get(registered.protocol.key) === registered) {
                    this.#providerExtensions.delete(registered.protocol.key);
                }
            }, (error) => {
                if (registered.releaseOperation === tracked) {
                    registered.releaseOperation = null;
                    registered.releaseFailed = true;
                }
                throw error;
            });
            registered.releaseOperation = tracked;
            release = tracked;
        }
        let rejectTimeout;
        const timeoutPromise = new Promise((_resolve, reject) => {
            rejectTimeout = reject;
        });
        const timeout = setTimeout(() => {
            controller?.abort();
            rejectTimeout(new DiscordCoreError("DISCORD_TIMEOUT", "Discord provider extension shutdown exceeded its deadline.", true));
        }, this.#shutdownTimeoutMs);
        try {
            await Promise.race([release, timeoutPromise]);
        }
        catch (error) {
            throw error instanceof DiscordCoreError ? error : providerFailure(error);
        }
        finally {
            clearTimeout(timeout);
        }
    }
    toJSON() {
        return Object.freeze({ component: "node-discord-gateway-adapter" });
    }
    async #emit(event) {
        await Promise.allSettled([...this.#listeners].map((listener) => this.#deliverBounded(() => listener(event))));
    }
    async #emitInteraction(interaction) {
        const listener = this.#interactionListeners.values().next().value;
        if (listener === undefined)
            return;
        try {
            await this.#deliverBounded(() => listener(interaction));
        }
        catch {
            // Interaction errors are isolated from the provider event emitter. The
            // product router owns response/error presentation through the responder.
        }
    }
    async #deliverBounded(deliver) {
        let timeout;
        try {
            await Promise.race([
                Promise.resolve().then(deliver),
                new Promise((resolve) => {
                    timeout = setTimeout(resolve, this.#listenerTimeoutMs);
                }),
            ]);
        }
        finally {
            if (timeout !== undefined)
                clearTimeout(timeout);
        }
    }
    #identity(client) {
        const applicationId = client.application?.id;
        if (applicationId === undefined || client.user === null) {
            throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord gateway identity is incomplete.", false);
        }
        return Object.freeze({
            userId: parseDiscordSnowflake(client.user.id, "Discord bot user id"),
            username: client.user.username,
            applicationId: parseDiscordSnowflake(applicationId, "Discord application id"),
        });
    }
}
const validatedToken = (value) => {
    const normalized = value.trim();
    if (normalized.length < 20 ||
        normalized.length > 512 ||
        /[\s\u0000-\u001f\u007f]/u.test(normalized)) {
        throw new TypeError("Discord bot token is invalid.");
    }
    return normalized;
};
const responseRecord = (value) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord response shape is invalid.", false);
    }
    return value;
};
const responseString = (record, key, label) => {
    const value = record[key];
    if (typeof value !== "string") {
        throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", `${label} is invalid.`, false);
    }
    return value;
};
const providerStatus = (error) => error instanceof DiscordAPIError || error instanceof HTTPError ? error.status : null;
const providerFailure = (error) => {
    if (error instanceof DiscordCoreError)
        return error;
    if (error instanceof RateLimitError) {
        return new DiscordCoreError("DISCORD_RATE_LIMITED", "Discord rate limit policy rejected the request.", true, 429);
    }
    const status = providerStatus(error);
    return new DiscordCoreError(status === null ? "DISCORD_NETWORK_FAILURE" : "DISCORD_PROVIDER_FAILURE", "Discord provider request failed.", status === null || status >= 500, status);
};
const providerFailureForSignal = (error, signal) => signal?.aborted === true
    ? new DiscordCoreError("DISCORD_CANCELLED", "Discord provider request was cancelled.", false, null, null, error)
    : providerFailure(error);
const directMessageFailureForSignal = (error, signal) => {
    if (signal?.aborted === true)
        return providerFailureForSignal(error, signal);
    if (error instanceof DiscordAPIError && error.code === 50_007) {
        return new DiscordCoreError("DISCORD_RECIPIENT_UNREACHABLE", "Discord recipient cannot receive direct messages.", false, error.status);
    }
    return providerFailure(error);
};
const commandCollectionRoute = (scope) => scope.kind === "global"
    ? Routes.applicationCommands(parseDiscordSnowflake(scope.applicationId, "Discord application id"))
    : Routes.applicationGuildCommands(parseDiscordSnowflake(scope.applicationId, "Discord application id"), parseDiscordSnowflake(scope.guildId, "Discord guild id"));
const commandItemRoute = (scope, providerCommandId) => {
    const applicationId = parseDiscordSnowflake(scope.applicationId, "Discord application id");
    const commandId = parseDiscordSnowflake(providerCommandId, "Discord command id");
    return scope.kind === "global"
        ? Routes.applicationCommand(applicationId, commandId)
        : Routes.applicationGuildCommand(applicationId, parseDiscordSnowflake(scope.guildId, "Discord guild id"), commandId);
};
const normalizeRemoteApplicationCommand = (value, scope) => {
    const record = responseRecord(value);
    const id = parseDiscordSnowflake(responseString(record, "id", "Discord application command id"), "Discord application command id");
    const name = responseString(record, "name", "Discord application command name").trim();
    const type = record["type"];
    if (name.length < 1 || name.length > 32 || !Number.isSafeInteger(type)) {
        throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord application command response is malformed.", false);
    }
    const kind = type === 1 ? "chat_input" : type === 2 ? "user" : type === 3 ? "message" : "unknown";
    return Object.freeze({
        id,
        name,
        kind,
        fingerprint: kind === "chat_input" ? fingerprintDiscordChatInputCommand(record, scope.kind) : null,
    });
};
/**
 * Safe facade over the provider REST SDK. The internal SDK owns shared/global
 * bucket coordination, route queues and Retry-After waits; bot products never
 * depend on the provider library directly.
 */
export class NodeDiscordRestAdapter {
    #rest;
    constructor(options) {
        const rest = new REST({
            version: "10",
            timeout: boundedInteger(options.timeoutMs, 15_000, 100, 30_000, "timeoutMs"),
            retries: boundedInteger(options.retries, 3, 0, 5, "retries"),
            globalRequestsPerSecond: boundedInteger(options.globalRequestsPerSecond, 50, 1, 50, "globalRequestsPerSecond"),
            invalidRequestWarningInterval: boundedInteger(options.invalidRequestWarningInterval, 250, 0, 10_000, "invalidRequestWarningInterval"),
            userAgentAppendix: "DiscordBot (https://github.com/Anto426-Project/discord-bot-core, 0.1.0)",
        });
        rest.setToken(validatedToken(options.botToken));
        this.#rest = rest;
    }
    toJSON() {
        return Object.freeze({ component: "node-discord-rest-adapter" });
    }
    async listApplicationCommands(scope, signal) {
        let response;
        try {
            response = await this.#rest.get(commandCollectionRoute(scope), {
                query: new URLSearchParams({ with_localizations: "true" }),
                ...(signal === undefined ? {} : { signal }),
            });
        }
        catch (error) {
            throw providerFailureForSignal(error, signal);
        }
        if (!Array.isArray(response) || response.length > 200) {
            throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord application command list response is invalid.", false);
        }
        const ids = new Set();
        const typedNames = new Set();
        return Object.freeze(response.map((entry) => {
            const command = normalizeRemoteApplicationCommand(entry, scope);
            const typedName = `${command.kind}:${command.name}`;
            if (ids.has(command.id) || typedNames.has(typedName)) {
                throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord application command list contains duplicates.", false);
            }
            ids.add(command.id);
            typedNames.add(typedName);
            return command;
        }));
    }
    async createApplicationCommand(scope, command, signal) {
        try {
            const response = await this.#rest.post(commandCollectionRoute(scope), {
                body: command,
                ...(signal === undefined ? {} : { signal }),
            });
            return normalizeRemoteApplicationCommand(response, scope);
        }
        catch (error) {
            throw providerFailureForSignal(error, signal);
        }
    }
    async updateApplicationCommand(scope, providerCommandId, command, signal) {
        try {
            const response = await this.#rest.patch(commandItemRoute(scope, providerCommandId), {
                body: command,
                ...(signal === undefined ? {} : { signal }),
            });
            return normalizeRemoteApplicationCommand(response, scope);
        }
        catch (error) {
            throw providerFailureForSignal(error, signal);
        }
    }
    async deleteApplicationCommand(scope, providerCommandId, signal) {
        try {
            await this.#rest.delete(commandItemRoute(scope, providerCommandId), {
                ...(signal === undefined ? {} : { signal }),
            });
            return "deleted";
        }
        catch (error) {
            if (providerStatus(error) === 404)
                return "already_absent";
            throw providerFailureForSignal(error, signal);
        }
    }
    async sendChannelMessage(input) {
        const channelId = parseDiscordSnowflake(input.channelId, "Discord channel id");
        return this.sendMessageToChannel(channelId, input.message, input.signal, false);
    }
    async sendMessageToChannel(channelId, message, signal, classifyRecipientUnreachable) {
        let response;
        try {
            response = await this.#rest.post(Routes.channelMessages(channelId), {
                body: createSafeDiscordMessage(message, channelId),
                ...(signal === undefined ? {} : { signal }),
            });
        }
        catch (error) {
            throw classifyRecipientUnreachable
                ? directMessageFailureForSignal(error, signal)
                : providerFailureForSignal(error, signal);
        }
        return this.deliveryReceipt(response, channelId);
    }
    async sendDirectMessage(input) {
        const recipientId = parseDiscordSnowflake(input.recipientId, "Discord recipient id");
        let response;
        try {
            response = await this.#rest.post(Routes.userChannels(), {
                body: Object.freeze({ recipient_id: recipientId }),
                ...(input.signal === undefined ? {} : { signal: input.signal }),
            });
        }
        catch (error) {
            throw directMessageFailureForSignal(error, input.signal);
        }
        const channelId = parseDiscordSnowflake(responseString(responseRecord(response), "id", "Discord DM channel id"), "Discord DM channel id");
        return this.sendMessageToChannel(channelId, input.message, input.signal, true);
    }
    deliveryReceipt(value, expectedChannelId) {
        const record = responseRecord(value);
        const channelId = parseDiscordSnowflake(responseString(record, "channel_id", "Discord message channel id"), "Discord message channel id");
        if (channelId !== expectedChannelId) {
            throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord message receipt does not match its destination.", false);
        }
        return Object.freeze({
            messageId: parseDiscordSnowflake(responseString(record, "id", "Discord message id"), "Discord message id"),
            channelId,
        });
    }
}
/**
 * Composes one SDK-owned gateway and one SDK-owned REST coordinator behind
 * stable core ports. Products never receive either provider client.
 */
export const createNodeDiscordRuntime = (options) => {
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
//# sourceMappingURL=discordjs.js.map