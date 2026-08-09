import { DiscordCoreError } from "./errors.js";
import { parseStableBotKey } from "./identifiers.js";
const EVENT_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9]{0,127}$/u;
export const namespaceDiscordEventIdempotencyKey = (subscriptionId, consumerKey) => {
    const subscription = parseStableBotKey(subscriptionId, "event subscription id");
    const key = consumerKey.trim();
    if (key.length < 1 || key.length > 256 || /[\u0000-\u001f\u007f]/u.test(key)) {
        throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Discord event idempotency key is invalid.", false);
    }
    return `discord-event/${encodeURIComponent(subscription)}/${encodeURIComponent(key)}`;
};
export class DiscordEventSubscription {
    options;
    subscriptionId;
    eventName;
    constructor(options) {
        this.options = options;
        this.subscriptionId = parseStableBotKey(options.subscriptionId, "event subscription id");
        const eventName = options.eventName.trim();
        if (!EVENT_NAME_PATTERN.test(eventName)) {
            throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Discord event name is invalid.", false);
        }
        this.eventName = eventName;
    }
    prepare(arguments_) {
        const payload = this.options.decode(arguments_);
        const idempotencyKey = namespaceDiscordEventIdempotencyKey(this.subscriptionId, this.options.idempotencyKey(payload));
        return Object.freeze({
            idempotencyKey,
            execute: async (signal) => {
                await this.options.handler(payload, Object.freeze({
                    subscriptionId: this.subscriptionId,
                    eventName: this.eventName,
                    idempotencyKey,
                    signal,
                }));
            },
        });
    }
}
const errorCode = (error) => error instanceof DiscordCoreError
    ? error.code
    : error instanceof Error && /^[A-Z][A-Z0-9_.-]{2,127}$/u.test(error.name)
        ? error.name
        : "DISCORD_EVENT_HANDLER_FAILED";
const reportSafely = async (reporter, failure) => {
    try {
        await Promise.race([
            reporter.report(failure),
            new Promise((resolve) => {
                setTimeout(resolve, 1_000);
            }),
        ]);
    }
    catch {
        // Event failures stay isolated when telemetry is unavailable.
    }
};
const executeBounded = async (operation, signal) => {
    if (signal.aborted)
        throw signal.reason;
    let rejectDeadline;
    const deadline = new Promise((_resolve, reject) => {
        rejectDeadline = reject;
    });
    const onAbort = () => rejectDeadline?.(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    try {
        if (signal.aborted)
            throw signal.reason;
        await Promise.race([operation(), deadline]);
    }
    finally {
        signal.removeEventListener("abort", onAbort);
    }
};
const persistenceBounded = async (operation, timeoutMs) => {
    const signal = AbortSignal.timeout(timeoutMs);
    return Promise.race([
        operation(signal),
        new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(new DiscordCoreError("DISCORD_TIMEOUT", "Discord event idempotency operation timed out.", true, null, null, signal.reason)), { once: true });
        }),
    ]);
};
export class DiscordEventRouter {
    idempotency;
    errors;
    options;
    subscriptions;
    constructor(subscriptions, idempotency, errors, options = {}) {
        this.idempotency = idempotency;
        this.errors = errors;
        this.options = options;
        const ids = new Set();
        const byName = new Map();
        for (const subscription of subscriptions) {
            if (ids.has(subscription.subscriptionId)) {
                throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Discord event subscription ids must be unique.", false);
            }
            ids.add(subscription.subscriptionId);
            const entries = byName.get(subscription.eventName) ?? [];
            entries.push(subscription);
            byName.set(subscription.eventName, entries);
        }
        this.subscriptions = new Map([...byName].map(([name, entries]) => [name, Object.freeze([...entries])]));
        this.handlerTimeoutMs();
        const ttlMs = this.idempotencyTtlMs();
        const minimumTtlMs = this.handlerTimeoutMs() + this.persistenceTimeoutMs() * 2 + 1_000;
        if (ttlMs < minimumTtlMs) {
            throw new RangeError("Discord event idempotency TTL must exceed the handler and persistence deadline window.");
        }
    }
    handlerTimeoutMs() {
        const value = this.options.handlerTimeoutMs ?? 10_000;
        if (!Number.isSafeInteger(value) || value < 100 || value > 60_000) {
            throw new RangeError("Discord event handler timeout must be from 100 to 60000 ms.");
        }
        return value;
    }
    idempotencyTtlMs() {
        const value = this.options.idempotencyTtlMs ?? 86_400_000;
        if (!Number.isSafeInteger(value) || value < 1_000 || value > 604_800_000) {
            throw new RangeError("Discord event idempotency TTL must be from 1 second to 7 days.");
        }
        return value;
    }
    persistenceTimeoutMs() {
        const value = this.options.persistenceTimeoutMs ?? 3_000;
        if (!Number.isSafeInteger(value) || value < 100 || value > 30_000) {
            throw new RangeError("Discord event persistence timeout must be from 100 to 30000 ms.");
        }
        return value;
    }
    registeredEventNames() {
        return Object.freeze([...this.subscriptions.keys()].sort());
    }
    async dispatch(eventName, arguments_) {
        const subscriptions = this.subscriptions.get(eventName);
        if (subscriptions === undefined)
            return Object.freeze({ status: "not_registered", eventName });
        const outcomes = [];
        for (const subscription of subscriptions) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(new DiscordCoreError("DISCORD_TIMEOUT", "Discord event handler timed out.", true)), this.handlerTimeoutMs());
            let key = null;
            let claimToken = null;
            try {
                const prepared = subscription.prepare(arguments_);
                key = prepared.idempotencyKey;
                const claim = await persistenceBounded((signal) => this.idempotency.claim(key, this.idempotencyTtlMs(), signal), this.persistenceTimeoutMs());
                if (claim.status === "duplicate") {
                    outcomes.push({ status: "duplicate", subscriptionId: subscription.subscriptionId, idempotencyKey: key });
                    continue;
                }
                claimToken = parseStableBotKey(claim.claimToken, "Discord event claim token");
                await executeBounded(() => prepared.execute(controller.signal), controller.signal);
                const finalized = await persistenceBounded((signal) => this.idempotency.finalize(key, claimToken, Object.freeze({ status: "completed" }), signal), this.persistenceTimeoutMs());
                if (finalized !== "applied") {
                    throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord event idempotency state was already finalized.", false);
                }
                outcomes.push({ status: "handled", subscriptionId: subscription.subscriptionId, idempotencyKey: key });
            }
            catch (error) {
                const code = errorCode(error);
                // Once claimed, failure is terminally marked uncertain through a CAS.
                // This prevents a timed-out/non-cooperative handler from racing a replay,
                // and prevents a late success write from overwriting the failure state.
                if (key !== null && claimToken !== null) {
                    await persistenceBounded((signal) => this.idempotency.finalize(key, claimToken, Object.freeze({ status: "uncertain", code }), signal), this.persistenceTimeoutMs()).catch(() => undefined);
                }
                await reportSafely(this.errors, {
                    subscriptionId: subscription.subscriptionId,
                    eventName: subscription.eventName,
                    argumentCount: Math.min(arguments_.length, 64),
                    code,
                });
                outcomes.push({ status: "failed", subscriptionId: subscription.subscriptionId, code });
            }
            finally {
                clearTimeout(timer);
            }
        }
        return Object.freeze({ status: "dispatched", eventName, outcomes: Object.freeze(outcomes) });
    }
}
export const singleDiscordEventArgument = (label, guard) => (arguments_) => {
    if (arguments_.length !== 1 || !guard(arguments_[0])) {
        throw new DiscordCoreError("DISCORD_INVALID_INPUT", `Discord event '${label}' does not match its one-argument schema.`, false);
    }
    return arguments_[0];
};
//# sourceMappingURL=events.js.map