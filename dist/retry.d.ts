export interface DiscordRetryPolicy {
    readonly maximumAttempts?: number;
    readonly baseDelayMs?: number;
    readonly maximumDelayMs?: number;
}
export interface DiscordRetryContext {
    readonly attempt: number;
    readonly signal: AbortSignal;
}
export type DiscordRetryDecision = Readonly<{
    retry: false;
}> | Readonly<{
    retry: true;
    retryAfterMs?: number;
}>;
export type DiscordSleeper = (delayMs: number, signal: AbortSignal) => Promise<void>;
export declare const nodeDiscordSleeper: DiscordSleeper;
export declare const executeWithDiscordRetry: <T>(input: {
    readonly operation: (context: DiscordRetryContext) => Promise<T>;
    readonly decide: (error: unknown) => DiscordRetryDecision;
    readonly signal?: AbortSignal;
    readonly policy?: DiscordRetryPolicy;
    readonly sleep?: DiscordSleeper;
}) => Promise<T>;
//# sourceMappingURL=retry.d.ts.map