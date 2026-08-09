import { DiscordCoreError } from "./errors.js";
import { assertDiscordApplicationCommandName } from "./command-model.js";
import { parseStableBotKey } from "./identifiers.js";
const timeoutError = (reason) => new DiscordCoreError("DISCORD_TIMEOUT", "Discord interaction handler exceeded its deadline.", true, null, null, reason);
const bounded = async (operation, signal) => {
    if (signal.aborted)
        throw timeoutError(signal.reason);
    let rejectDeadline;
    const deadline = new Promise((_resolve, reject) => {
        rejectDeadline = reject;
    });
    const onAbort = () => rejectDeadline?.(timeoutError(signal.reason));
    signal.addEventListener("abort", onAbort, { once: true });
    try {
        if (signal.aborted)
            throw timeoutError(signal.reason);
        return await Promise.race([operation(), deadline]);
    }
    finally {
        signal.removeEventListener("abort", onAbort);
    }
};
export class DiscordIngressRouter {
    options;
    commands;
    interactions;
    handlerTimeoutMs;
    constructor(options) {
        this.options = options;
        const handlerTimeoutMs = options.handlerTimeoutMs ?? 10_000;
        if (!Number.isSafeInteger(handlerTimeoutMs) ||
            handlerTimeoutMs < 100 ||
            handlerTimeoutMs > 60_000) {
            throw new RangeError("Discord handler timeout must be from 100 to 60000 ms.");
        }
        const interactions = options.interactions ?? [];
        if (options.commands.length > 100 || interactions.length > 100) {
            throw new RangeError("Discord router binding limit exceeded.");
        }
        const commands = new Map();
        for (const binding of options.commands) {
            const name = binding.commandName.trim();
            try {
                assertDiscordApplicationCommandName(name, "Discord command binding name");
            }
            catch {
                throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Discord command bindings require unique valid command names.", false);
            }
            if (commands.has(name)) {
                throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Discord command bindings require unique valid command names.", false);
            }
            commands.set(name, binding);
        }
        this.commands = commands;
        const ids = new Set();
        for (const binding of interactions) {
            const id = parseStableBotKey(binding.id, "interaction binding id");
            if (ids.has(id)) {
                throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Discord interaction binding ids must be unique.", false);
            }
            ids.add(id);
        }
        this.interactions = Object.freeze([...interactions]);
        this.handlerTimeoutMs = handlerTimeoutMs;
    }
    async handle(interaction) {
        const signal = AbortSignal.timeout(this.handlerTimeoutMs);
        if (this.options.isChatInputCommand(interaction)) {
            const command = this.commands.get(interaction.commandName);
            if (command !== undefined) {
                await bounded(() => command.handle(interaction, signal), signal);
                return true;
            }
        }
        for (const binding of this.interactions) {
            if (signal.aborted)
                throw timeoutError(signal.reason);
            if (await bounded(() => binding.handle(interaction, signal), signal))
                return true;
        }
        return false;
    }
}
//# sourceMappingURL=router.js.map