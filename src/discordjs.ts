import {
  BaseInteraction,
  Client,
  DiscordAPIError,
  Events,
  GatewayIntentBits,
  HTTPError,
  MessageFlags,
  Partials,
  REST,
  RateLimitError,
  Routes,
  type ChatInputCommandInteraction,
  type Interaction,
  type RepliableInteraction,
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
import { parseDiscordSnowflake } from "./identifiers.js";
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

const NODE_DISCORD_PROVIDER_EXTENSION_PROTOCOL = Symbol.for(
  "@anto-project/discord-bot-core/provider-extension/v1",
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

export class NodeDiscordGatewayAdapter
  implements DiscordGatewayRuntimePort, NodeDiscordProviderExtensionHostPort
{
  #client: Client;
  readonly #clientFactory: () => Client;
  readonly #botToken: string;
  readonly #listeners = new Set<DiscordGatewayLifecycleListener>();
  readonly #interactionListeners = new Set<DiscordInteractionListener>();
  readonly #startupTimeoutMs: number;
  readonly #shutdownTimeoutMs: number;
  readonly #listenerTimeoutMs: number;
  readonly #providerExtensions = new Map<string, RegisteredNodeDiscordProviderExtension>();
  #clientGeneration = 1;
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
       */
      if (this.#stopRequested) {
        await this.#replaceStoppedClient();
        this.#stopRequested = false;
      }
      this.#assertProviderExtensionsReady();
      const controller = new AbortController();
      const pending = this.#startOnce(controller.signal);
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

  public async stop(): Promise<void> {
    if (this.#stopPromise !== null) return this.#stopPromise;

    this.#extensionsFrozen = true;
    const startup = this.#startPromise;
    const providerLogin = this.#providerLoginPromise;
    this.#stopRequested = true;
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
      registered.protocol.bindProviderClient(client, generation);
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
  return Object.freeze({ gateway, extensions: gateway, commands: rest, messages: rest });
};
