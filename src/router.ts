import { DiscordCoreError } from "./errors.js";
import { assertDiscordApplicationCommandName } from "./command-model.js";
import { parseStableBotKey } from "./identifiers.js";

export interface DiscordChatInputInteractionLike {
  readonly commandName: string;
}

export interface DiscordCommandBinding<TChatInput> {
  readonly commandName: string;
  handle(interaction: TChatInput, signal: AbortSignal): Promise<void>;
}

export interface DiscordInteractionBinding<TInteraction> {
  readonly id: string;
  handle(interaction: TInteraction, signal: AbortSignal): Promise<boolean>;
}

export interface DiscordIngressRouterOptions<
  TInteraction,
  TChatInput extends TInteraction & DiscordChatInputInteractionLike,
> {
  readonly commands: readonly DiscordCommandBinding<TChatInput>[];
  readonly interactions?: readonly DiscordInteractionBinding<TInteraction>[];
  readonly isChatInputCommand: (interaction: TInteraction) => interaction is TChatInput;
  readonly handlerTimeoutMs?: number;
}

const timeoutError = (reason: unknown): DiscordCoreError =>
  new DiscordCoreError(
    "DISCORD_TIMEOUT",
    "Discord interaction handler exceeded its deadline.",
    true,
    null,
    null,
    reason,
  );

const bounded = async <T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> => {
  if (signal.aborted) throw timeoutError(signal.reason);
  let rejectDeadline: ((reason: unknown) => void) | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    rejectDeadline = reject;
  });
  const onAbort = (): void => rejectDeadline?.(timeoutError(signal.reason));
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    if (signal.aborted) throw timeoutError(signal.reason);
    return await Promise.race([operation(), deadline]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
};

export class DiscordIngressRouter<
  TInteraction,
  TChatInput extends TInteraction & DiscordChatInputInteractionLike,
> {
  private readonly commands: ReadonlyMap<string, DiscordCommandBinding<TChatInput>>;
  private readonly interactions: readonly DiscordInteractionBinding<TInteraction>[];
  private readonly handlerTimeoutMs: number;

  public constructor(
    private readonly options: DiscordIngressRouterOptions<TInteraction, TChatInput>,
  ) {
    const handlerTimeoutMs = options.handlerTimeoutMs ?? 10_000;
    if (
      !Number.isSafeInteger(handlerTimeoutMs) ||
      handlerTimeoutMs < 100 ||
      handlerTimeoutMs > 60_000
    ) {
      throw new RangeError("Discord handler timeout must be from 100 to 60000 ms.");
    }
    const interactions = options.interactions ?? [];
    if (options.commands.length > 100 || interactions.length > 100) {
      throw new RangeError("Discord router binding limit exceeded.");
    }
    const commands = new Map<string, DiscordCommandBinding<TChatInput>>();
    for (const binding of options.commands) {
      const name = binding.commandName.trim();
      try {
        assertDiscordApplicationCommandName(name, "Discord command binding name");
      } catch {
        throw new DiscordCoreError(
          "DISCORD_INVALID_INPUT",
          "Discord command bindings require unique valid command names.",
          false,
        );
      }
      if (commands.has(name)) {
        throw new DiscordCoreError(
          "DISCORD_INVALID_INPUT",
          "Discord command bindings require unique valid command names.",
          false,
        );
      }
      commands.set(name, binding);
    }
    this.commands = commands;

    const ids = new Set<string>();
    for (const binding of interactions) {
      const id = parseStableBotKey(binding.id, "interaction binding id");
      if (ids.has(id)) {
        throw new DiscordCoreError(
          "DISCORD_INVALID_INPUT",
          "Discord interaction binding ids must be unique.",
          false,
        );
      }
      ids.add(id);
    }
    this.interactions = Object.freeze([...interactions]);
    this.handlerTimeoutMs = handlerTimeoutMs;
  }

  public async handle(interaction: TInteraction): Promise<boolean> {
    const signal = AbortSignal.timeout(this.handlerTimeoutMs);
    if (this.options.isChatInputCommand(interaction)) {
      const command = this.commands.get(interaction.commandName);
      if (command !== undefined) {
        await bounded(() => command.handle(interaction, signal), signal);
        return true;
      }
    }
    for (const binding of this.interactions) {
      if (signal.aborted) throw timeoutError(signal.reason);
      if (await bounded(() => binding.handle(interaction, signal), signal)) return true;
    }
    return false;
  }
}
