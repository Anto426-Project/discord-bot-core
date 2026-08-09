import {
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
  DiscordButtonComponent,
  DiscordMessageActionRow,
  DiscordMessageComponent,
  DiscordModalPlan,
  DiscordStringSelectComponent,
  DiscordTextInputComponent,
  DiscordUserSelectComponent,
} from "./components.js";
import {
  discordButton,
  discordMessageActionRow,
  discordModal,
  discordStringSelect,
  discordTextInput,
  discordUserSelect,
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

/**
 * Creates the private provider client with closed mention defaults. Privileged gateway
 * intents must be acknowledged individually by the owning product; the core
 * never silently enables a privileged profile for a smaller bot.
 */
const createClient = (options: NodeDiscordGatewayOptions): Client => {
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

const BUTTON_STYLES: Readonly<Record<DiscordButtonComponent["style"], number>> = Object.freeze({
  primary: 1,
  secondary: 2,
  success: 3,
  danger: 4,
  link: 5,
});

const encodeEmoji = (emoji: string | undefined): Readonly<{ name: string }> | undefined =>
  emoji === undefined ? undefined : Object.freeze({ name: emoji });

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

const normalizeMessageComponent = (
  component: DiscordMessageComponent,
): DiscordMessageComponent => {
  switch (component.kind) {
    case "button":
      return discordButton(component);
    case "string_select":
      return discordStringSelect(component);
    case "user_select":
      return discordUserSelect(component);
    default:
      throw new DiscordCoreError(
        "DISCORD_PAYLOAD_REJECTED",
        "Discord message component kind is invalid.",
        false,
      );
  }
};

const encodeButton = (component: DiscordButtonComponent): Readonly<Record<string, unknown>> =>
  Object.freeze({
    type: 2,
    style: BUTTON_STYLES[component.style],
    ...(component.label === undefined ? {} : { label: component.label }),
    ...(component.customId === undefined ? {} : { custom_id: component.customId }),
    ...(component.url === undefined ? {} : { url: component.url }),
    ...(encodeEmoji(component.emoji) === undefined ? {} : { emoji: encodeEmoji(component.emoji) }),
    disabled: component.disabled,
  });

const encodeStringSelect = (
  component: DiscordStringSelectComponent,
): Readonly<Record<string, unknown>> =>
  Object.freeze({
    type: 3,
    custom_id: component.customId,
    options: component.options.map((option) =>
      Object.freeze({
        label: option.label,
        value: option.value,
        ...(option.description === undefined ? {} : { description: option.description }),
        ...(encodeEmoji(option.emoji) === undefined ? {} : { emoji: encodeEmoji(option.emoji) }),
        default: option.default,
      }),
    ),
    ...(component.placeholder === undefined ? {} : { placeholder: component.placeholder }),
    min_values: component.minimumValues,
    max_values: component.maximumValues,
    disabled: component.disabled,
  });

const encodeUserSelect = (
  component: DiscordUserSelectComponent,
): Readonly<Record<string, unknown>> =>
  Object.freeze({
    type: 5,
    custom_id: component.customId,
    ...(component.placeholder === undefined ? {} : { placeholder: component.placeholder }),
    min_values: component.minimumValues,
    max_values: component.maximumValues,
    disabled: component.disabled,
  });

const encodeMessageComponent = (
  component: DiscordMessageComponent,
): Readonly<Record<string, unknown>> => {
  switch (component.kind) {
    case "button":
      return encodeButton(component);
    case "string_select":
      return encodeStringSelect(component);
    case "user_select":
      return encodeUserSelect(component);
    default:
      throw new DiscordCoreError(
        "DISCORD_PAYLOAD_REJECTED",
        "Discord message component kind is invalid.",
        false,
      );
  }
};

const encodeActionRows = (
  rows: readonly DiscordMessageActionRow[] | undefined,
): readonly Readonly<Record<string, unknown>>[] | undefined => {
  if (rows === undefined) return undefined;
  const sourceRows = boundedDataArray(rows, 0, 5, "Discord action rows");
  return Object.freeze(
    sourceRows.map((row) => {
      const sourceRow = discordMessageActionRow(row.components);
      const safeRow = discordMessageActionRow(
        sourceRow.components.map(normalizeMessageComponent),
      );
      return Object.freeze({
        type: 1,
        components: safeRow.components.map(encodeMessageComponent),
      });
    }),
  );
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
  const components = encodeActionRows(plan.components);
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
    await this.#interaction.reply(encodeInteractionMessage(plan, true) as never);
  }

  public async deferReply(visibility: DiscordResponseVisibility = "public"): Promise<void> {
    await this.#interaction.deferReply(
      visibility === "ephemeral" ? { flags: MessageFlags.Ephemeral } : {},
    );
  }

  public async editReply(plan: DiscordEditableInteractionMessagePlan): Promise<void> {
    await this.#interaction.editReply(encodeInteractionMessage(plan, false) as never);
  }

  public async followUp(plan: DiscordInteractionMessagePlan): Promise<void> {
    await this.#interaction.followUp(encodeInteractionMessage(plan, true) as never);
  }

  public async deferUpdate(): Promise<void> {
    if (!this.#interaction.isMessageComponent() && !this.#interaction.isModalSubmit()) {
      throw new DiscordCoreError(
        "DISCORD_INVALID_INPUT",
        "This Discord interaction cannot defer a component update.",
        false,
      );
    }
    await this.#interaction.deferUpdate();
  }

  public async update(plan: DiscordEditableInteractionMessagePlan): Promise<void> {
    if (!this.#interaction.isMessageComponent()) {
      throw new DiscordCoreError(
        "DISCORD_INVALID_INPUT",
        "This Discord interaction cannot update its source message.",
        false,
      );
    }
    await this.#interaction.update(encodeInteractionMessage(plan, false) as never);
  }

  public async showModal(modal: DiscordModalPlan): Promise<void> {
    if (!this.#interaction.isCommand() && !this.#interaction.isMessageComponent()) {
      throw new DiscordCoreError(
        "DISCORD_INVALID_INPUT",
        "This Discord interaction cannot open a modal.",
        false,
      );
    }
    await this.#interaction.showModal(encodeModal(modal) as never);
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

export class NodeDiscordGatewayAdapter implements DiscordGatewayRuntimePort {
  readonly #client: Client;
  readonly #botToken: string;
  readonly #listeners = new Set<DiscordGatewayLifecycleListener>();
  readonly #interactionListeners = new Set<DiscordInteractionListener>();
  readonly #startupTimeoutMs: number;
  readonly #listenerTimeoutMs: number;

  public constructor(options: NodeDiscordGatewayOptions) {
    this.#client = createClient(options);
    this.#botToken = validatedToken(options.botToken);
    this.#startupTimeoutMs = boundedInteger(
      options.startupTimeoutMs,
      30_000,
      1_000,
      120_000,
      "startupTimeoutMs",
    );
    this.#listenerTimeoutMs = boundedInteger(
      options.listenerTimeoutMs,
      5_000,
      100,
      30_000,
      "listenerTimeoutMs",
    );
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
      if (normalized !== null) void this.#emitInteraction(normalized);
    });
  }

  public async start(signal?: AbortSignal): Promise<DiscordGatewayIdentity> {
    if (signal?.aborted === true) {
      throw new DiscordCoreError("DISCORD_CANCELLED", "Discord gateway startup was cancelled.", false);
    }
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
    signal?.addEventListener("abort", onAbort, { once: true });

    try {
      await Promise.race([
        (async () => {
          await this.#client.login(this.#botToken);
          if (!this.#client.isReady()) await readyPromise;
        })(),
        timeoutPromise,
        cancellationPromise,
      ]);
      return this.#identity(this.#client);
    } catch (error: unknown) {
      this.#client.destroy();
      if (error instanceof DiscordCoreError) throw error;
      throw providerFailureForSignal(error, signal);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      this.#client.off(Events.ClientReady, onReady);
    }
  }

  public async stop(): Promise<void> {
    this.#client.destroy();
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
    let response: unknown;
    try {
      response = await this.#rest.post(Routes.channelMessages(channelId), {
        body: createSafeDiscordMessage(input.message, channelId),
        ...(input.signal === undefined ? {} : { signal: input.signal }),
      });
    } catch (error: unknown) {
      throw providerFailureForSignal(error, input.signal);
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
      throw providerFailureForSignal(error, input.signal);
    }
    const channelId = parseDiscordSnowflake(
      responseString(responseRecord(response), "id", "Discord DM channel id"),
      "Discord DM channel id",
    );
    return this.sendChannelMessage({
      channelId,
      message: input.message,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
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
  return Object.freeze({ gateway, commands: rest, messages: rest });
};
