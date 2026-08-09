import { DiscordCoreError } from "./errors.js";
import { parseStableBotKey } from "./identifiers.js";

export interface DiscordInteractionLike {
  readonly commandName?: string;
  isChatInputCommand(): boolean;
}

export interface DiscordCommandBinding<TInteraction extends DiscordInteractionLike> {
  readonly commandName: string;
  handle(interaction: TInteraction, signal?: AbortSignal): Promise<void>;
}

export interface DiscordInteractionBinding<TInteraction extends DiscordInteractionLike> {
  readonly id: string;
  handle(interaction: TInteraction, signal?: AbortSignal): Promise<boolean>;
}

const bounded = async <T>(operation: Promise<T>, timeoutMs: number): Promise<T> => {
  const signal = AbortSignal.timeout(timeoutMs);
  return Promise.race([
    operation,
    new Promise<never>((_resolve, reject) => {
      signal.addEventListener(
        "abort",
        () =>
          reject(
            new DiscordCoreError(
              "DISCORD_TIMEOUT",
              "Discord interaction handler exceeded its deadline.",
              true,
              null,
              null,
              signal.reason,
            ),
          ),
        { once: true },
      );
    }),
  ]);
};

export class DiscordIngressRouter<TInteraction extends DiscordInteractionLike> {
  private readonly commands: ReadonlyMap<string, DiscordCommandBinding<TInteraction>>;
  private readonly interactions: readonly DiscordInteractionBinding<TInteraction>[];

  public constructor(
    bindings: readonly DiscordCommandBinding<TInteraction>[],
    interactions: readonly DiscordInteractionBinding<TInteraction>[] = [],
    private readonly handlerTimeoutMs = 10_000,
  ) {
    if (
      !Number.isSafeInteger(handlerTimeoutMs) ||
      handlerTimeoutMs < 100 ||
      handlerTimeoutMs > 60_000
    ) {
      throw new RangeError("Discord handler timeout must be from 100 to 60000 ms.");
    }
    const commands = new Map<string, DiscordCommandBinding<TInteraction>>();
    for (const binding of bindings) {
      const name = binding.commandName.trim();
      if (!/^[\p{Ll}\p{Lm}\p{Lo}\p{N}_-]{1,32}$/u.test(name) || commands.has(name)) {
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
  }

  public async handle(interaction: TInteraction): Promise<boolean> {
    const signal = AbortSignal.timeout(this.handlerTimeoutMs);
    if (interaction.isChatInputCommand()) {
      const commandName = interaction.commandName;
      const command = commandName === undefined ? undefined : this.commands.get(commandName);
      if (command !== undefined) {
        await bounded(command.handle(interaction, signal), this.handlerTimeoutMs);
        return true;
      }
    }
    for (const binding of this.interactions) {
      if (await bounded(binding.handle(interaction, signal), this.handlerTimeoutMs)) return true;
    }
    return false;
  }
}
