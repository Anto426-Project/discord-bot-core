import { DiscordCoreError } from "./errors.js";
const DEFAULT_POLICY = Object.freeze({
    maximumAttempts: 3,
    baseDelayMs: 250,
    maximumDelayMs: 5_000,
});
const normalizePolicy = (policy) => {
    const maximumAttempts = policy.maximumAttempts ?? DEFAULT_POLICY.maximumAttempts;
    const baseDelayMs = policy.baseDelayMs ?? DEFAULT_POLICY.baseDelayMs;
    const maximumDelayMs = policy.maximumDelayMs ?? DEFAULT_POLICY.maximumDelayMs;
    if (!Number.isSafeInteger(maximumAttempts) || maximumAttempts < 1 || maximumAttempts > 5) {
        throw new RangeError("maximumAttempts must be an integer from 1 to 5.");
    }
    if (!Number.isSafeInteger(baseDelayMs) || baseDelayMs < 1 || baseDelayMs > 10_000) {
        throw new RangeError("baseDelayMs must be an integer from 1 to 10000.");
    }
    if (!Number.isSafeInteger(maximumDelayMs) ||
        maximumDelayMs < baseDelayMs ||
        maximumDelayMs > 60_000) {
        throw new RangeError("maximumDelayMs must be bounded and no smaller than baseDelayMs.");
    }
    return Object.freeze({ maximumAttempts, baseDelayMs, maximumDelayMs });
};
export const nodeDiscordSleeper = async (delayMs, signal) => {
    await new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(signal.reason);
            return;
        }
        let timer;
        const abort = () => {
            clearTimeout(timer);
            reject(signal.reason);
        };
        const done = () => {
            signal.removeEventListener("abort", abort);
            resolve();
        };
        timer = setTimeout(done, delayMs);
        signal.addEventListener("abort", abort, { once: true });
    });
};
export const executeWithDiscordRetry = async (input) => {
    const policy = normalizePolicy(input.policy ?? {});
    const signal = input.signal ?? new AbortController().signal;
    const sleep = input.sleep ?? nodeDiscordSleeper;
    let lastError;
    for (let attempt = 1; attempt <= policy.maximumAttempts; attempt += 1) {
        if (signal.aborted)
            throw signal.reason;
        try {
            return await input.operation(Object.freeze({ attempt, signal }));
        }
        catch (error) {
            lastError = error;
            const decision = input.decide(error);
            if (!decision.retry || attempt === policy.maximumAttempts)
                throw error;
            const exponential = Math.min(policy.maximumDelayMs, policy.baseDelayMs * 2 ** (attempt - 1));
            const requested = decision.retryAfterMs;
            if (requested !== undefined &&
                (!Number.isSafeInteger(requested) || requested < 0 || requested > 86_400_000)) {
                throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord retry delay is invalid.", false, null, null, error);
            }
            // A provider Retry-After is a lower bound. Retrying earlier would violate
            // Discord's rate limit. If this process is unwilling to wait that long,
            // surface the original rate-limit error to a durable scheduler instead.
            if (requested !== undefined && requested > policy.maximumDelayMs) {
                throw error;
            }
            const delay = requested === undefined
                ? exponential
                : Math.max(exponential, requested);
            await sleep(delay, signal);
        }
    }
    throw new DiscordCoreError("DISCORD_PROVIDER_FAILURE", "Discord retry attempts were exhausted.", true, null, null, lastError);
};
//# sourceMappingURL=retry.js.map