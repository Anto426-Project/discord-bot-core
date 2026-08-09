import { Client, DiscordAPIError, Events, GatewayIntentBits, HTTPError, MessageFlags, Partials, REST, RateLimitError, Routes, } from "discord.js";
import { fingerprintDiscordChatInputCommand, } from "./command-publisher.js";
import { discordButton, discordMessageActionRow, discordModal, discordStringSelect, discordTextInput, discordUserSelect, } from "./components.js";
import { DiscordCoreError } from "./errors.js";
import { parseDiscordSnowflake } from "./identifiers.js";
import { createSafeDiscordMessage, encodeSafeDiscordEmbeds, } from "./payload.js";
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
const BUTTON_STYLES = Object.freeze({
    primary: 1,
    secondary: 2,
    success: 3,
    danger: 4,
    link: 5,
});
const encodeEmoji = (emoji) => emoji === undefined ? undefined : Object.freeze({ name: emoji });
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
const normalizeMessageComponent = (component) => {
    switch (component.kind) {
        case "button":
            return discordButton(component);
        case "string_select":
            return discordStringSelect(component);
        case "user_select":
            return discordUserSelect(component);
        default:
            throw new DiscordCoreError("DISCORD_PAYLOAD_REJECTED", "Discord message component kind is invalid.", false);
    }
};
const encodeButton = (component) => Object.freeze({
    type: 2,
    style: BUTTON_STYLES[component.style],
    ...(component.label === undefined ? {} : { label: component.label }),
    ...(component.customId === undefined ? {} : { custom_id: component.customId }),
    ...(component.url === undefined ? {} : { url: component.url }),
    ...(encodeEmoji(component.emoji) === undefined ? {} : { emoji: encodeEmoji(component.emoji) }),
    disabled: component.disabled,
});
const encodeStringSelect = (component) => Object.freeze({
    type: 3,
    custom_id: component.customId,
    options: component.options.map((option) => Object.freeze({
        label: option.label,
        value: option.value,
        ...(option.description === undefined ? {} : { description: option.description }),
        ...(encodeEmoji(option.emoji) === undefined ? {} : { emoji: encodeEmoji(option.emoji) }),
        default: option.default,
    })),
    ...(component.placeholder === undefined ? {} : { placeholder: component.placeholder }),
    min_values: component.minimumValues,
    max_values: component.maximumValues,
    disabled: component.disabled,
});
const encodeUserSelect = (component) => Object.freeze({
    type: 5,
    custom_id: component.customId,
    ...(component.placeholder === undefined ? {} : { placeholder: component.placeholder }),
    min_values: component.minimumValues,
    max_values: component.maximumValues,
    disabled: component.disabled,
});
const encodeMessageComponent = (component) => {
    switch (component.kind) {
        case "button":
            return encodeButton(component);
        case "string_select":
            return encodeStringSelect(component);
        case "user_select":
            return encodeUserSelect(component);
        default:
            throw new DiscordCoreError("DISCORD_PAYLOAD_REJECTED", "Discord message component kind is invalid.", false);
    }
};
const encodeActionRows = (rows) => {
    if (rows === undefined)
        return undefined;
    const sourceRows = boundedDataArray(rows, 0, 5, "Discord action rows");
    return Object.freeze(sourceRows.map((row) => {
        const sourceRow = discordMessageActionRow(row.components);
        const safeRow = discordMessageActionRow(sourceRow.components.map(normalizeMessageComponent));
        return Object.freeze({
            type: 1,
            components: safeRow.components.map(encodeMessageComponent),
        });
    }));
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
    const components = encodeActionRows(plan.components);
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
        await this.#interaction.reply(encodeInteractionMessage(plan, true));
    }
    async deferReply(visibility = "public") {
        await this.#interaction.deferReply(visibility === "ephemeral" ? { flags: MessageFlags.Ephemeral } : {});
    }
    async editReply(plan) {
        await this.#interaction.editReply(encodeInteractionMessage(plan, false));
    }
    async followUp(plan) {
        await this.#interaction.followUp(encodeInteractionMessage(plan, true));
    }
    async deferUpdate() {
        if (!this.#interaction.isMessageComponent() && !this.#interaction.isModalSubmit()) {
            throw new DiscordCoreError("DISCORD_INVALID_INPUT", "This Discord interaction cannot defer a component update.", false);
        }
        await this.#interaction.deferUpdate();
    }
    async update(plan) {
        if (!this.#interaction.isMessageComponent()) {
            throw new DiscordCoreError("DISCORD_INVALID_INPUT", "This Discord interaction cannot update its source message.", false);
        }
        await this.#interaction.update(encodeInteractionMessage(plan, false));
    }
    async showModal(modal) {
        if (!this.#interaction.isCommand() && !this.#interaction.isMessageComponent()) {
            throw new DiscordCoreError("DISCORD_INVALID_INPUT", "This Discord interaction cannot open a modal.", false);
        }
        await this.#interaction.showModal(encodeModal(modal));
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
export class NodeDiscordGatewayAdapter {
    #client;
    #botToken;
    #listeners = new Set();
    #interactionListeners = new Set();
    #startupTimeoutMs;
    #listenerTimeoutMs;
    constructor(options) {
        this.#client = createClient(options);
        this.#botToken = validatedToken(options.botToken);
        this.#startupTimeoutMs = boundedInteger(options.startupTimeoutMs, 30_000, 1_000, 120_000, "startupTimeoutMs");
        this.#listenerTimeoutMs = boundedInteger(options.listenerTimeoutMs, 5_000, 100, 30_000, "listenerTimeoutMs");
        this.#client.on(Events.ClientReady, (client) => {
            void this.#emit({ type: "ready", identity: this.#identity(client) });
        });
        this.#client.on(Events.ShardResume, (shardId) => {
            void this.#emit({ type: "shard_resumed", shardId });
        });
        this.#client.on(Events.ShardDisconnect, (closeEvent, shardId) => {
            void this.#emit({
                type: "shard_disconnected",
                shardId,
                closeCode: Number.isInteger(closeEvent.code) ? closeEvent.code : null,
            });
        });
        this.#client.on(Events.ShardReconnecting, (shardId) => {
            void this.#emit({ type: "shard_reconnecting", shardId });
        });
        this.#client.on(Events.Error, () => {
            void this.#emit({ type: "provider_error", code: "DISCORD_GATEWAY_ERROR" });
        });
        this.#client.on(Events.InteractionCreate, (interaction) => {
            const normalized = normalizeInteraction(interaction);
            if (normalized !== null)
                void this.#emitInteraction(normalized);
        });
    }
    async start(signal) {
        if (signal?.aborted === true) {
            throw new DiscordCoreError("DISCORD_CANCELLED", "Discord gateway startup was cancelled.", false);
        }
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
        signal?.addEventListener("abort", onAbort, { once: true });
        try {
            await Promise.race([
                (async () => {
                    await this.#client.login(this.#botToken);
                    if (!this.#client.isReady())
                        await readyPromise;
                })(),
                timeoutPromise,
                cancellationPromise,
            ]);
            return this.#identity(this.#client);
        }
        catch (error) {
            this.#client.destroy();
            if (error instanceof DiscordCoreError)
                throw error;
            throw providerFailureForSignal(error, signal);
        }
        finally {
            clearTimeout(timeout);
            signal?.removeEventListener("abort", onAbort);
            this.#client.off(Events.ClientReady, onReady);
        }
    }
    async stop() {
        this.#client.destroy();
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
        let response;
        try {
            response = await this.#rest.post(Routes.channelMessages(channelId), {
                body: createSafeDiscordMessage(input.message, channelId),
                ...(input.signal === undefined ? {} : { signal: input.signal }),
            });
        }
        catch (error) {
            throw providerFailureForSignal(error, input.signal);
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
            throw providerFailureForSignal(error, input.signal);
        }
        const channelId = parseDiscordSnowflake(responseString(responseRecord(response), "id", "Discord DM channel id"), "Discord DM channel id");
        return this.sendChannelMessage({
            channelId,
            message: input.message,
            ...(input.signal === undefined ? {} : { signal: input.signal }),
        });
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
    return Object.freeze({ gateway, commands: rest, messages: rest });
};
//# sourceMappingURL=discordjs.js.map