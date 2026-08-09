export interface DiscordEventIdempotencyPort {
    /**
     * Atomically acquires a pending lease. Implementations must honor the signal;
     * terminal completed/uncertain tombstones never expire automatically.
     */
    claim(key: string, ttlMs: number, signal: AbortSignal): Promise<Readonly<{
        status: "claimed";
        claimToken: string;
    }> | Readonly<{
        status: "duplicate";
    }>>;
    /** Atomic compare-and-set for exactly the acquired generation (ABA-safe). */
    finalize(key: string, claimToken: string, outcome: Readonly<{
        status: "completed";
    }> | Readonly<{
        status: "uncertain";
        code: string;
    }>, signal: AbortSignal): Promise<"applied" | "already_finalized">;
}
export type DiscordEventHandlingContext = Readonly<{
    subscriptionId: string;
    eventName: string;
    idempotencyKey: string;
    signal: AbortSignal;
}>;
export interface DiscordEventSubscriptionRuntime {
    readonly subscriptionId: string;
    readonly eventName: string;
    prepare(arguments_: readonly unknown[]): Readonly<{
        idempotencyKey: string;
        execute(signal: AbortSignal): Promise<void>;
    }>;
}
export interface DiscordEventSubscriptionOptions<TPayload> {
    readonly subscriptionId: string;
    readonly eventName: string;
    readonly decode: (arguments_: readonly unknown[]) => TPayload;
    readonly idempotencyKey: (payload: TPayload) => string;
    readonly handler: (payload: TPayload, context: DiscordEventHandlingContext) => Promise<void>;
}
export declare const namespaceDiscordEventIdempotencyKey: (subscriptionId: string, consumerKey: string) => string;
export declare class DiscordEventSubscription<TPayload> implements DiscordEventSubscriptionRuntime {
    private readonly options;
    readonly subscriptionId: string;
    readonly eventName: string;
    constructor(options: DiscordEventSubscriptionOptions<TPayload>);
    prepare(arguments_: readonly unknown[]): Readonly<{
        idempotencyKey: string;
        execute(signal: AbortSignal): Promise<void>;
    }>;
}
export type DiscordEventFailure = Readonly<{
    subscriptionId: string;
    eventName: string;
    argumentCount: number;
    code: string;
}>;
export interface DiscordEventErrorReporter {
    report(failure: DiscordEventFailure): Promise<void>;
}
export type DiscordEventSubscriptionOutcome = Readonly<{
    status: "handled";
    subscriptionId: string;
    idempotencyKey: string;
}> | Readonly<{
    status: "duplicate";
    subscriptionId: string;
    idempotencyKey: string;
}> | Readonly<{
    status: "failed";
    subscriptionId: string;
    code: string;
}>;
export type DiscordEventDispatchResult = Readonly<{
    status: "dispatched";
    eventName: string;
    outcomes: readonly DiscordEventSubscriptionOutcome[];
}> | Readonly<{
    status: "not_registered";
    eventName: string;
}>;
export declare class DiscordEventRouter {
    private readonly idempotency;
    private readonly errors;
    private readonly options;
    private readonly subscriptions;
    constructor(subscriptions: readonly DiscordEventSubscriptionRuntime[], idempotency: DiscordEventIdempotencyPort, errors: DiscordEventErrorReporter, options?: Readonly<{
        handlerTimeoutMs?: number;
        idempotencyTtlMs?: number;
        persistenceTimeoutMs?: number;
    }>);
    private handlerTimeoutMs;
    private idempotencyTtlMs;
    private persistenceTimeoutMs;
    registeredEventNames(): readonly string[];
    dispatch(eventName: string, arguments_: readonly unknown[]): Promise<DiscordEventDispatchResult>;
}
export declare const singleDiscordEventArgument: <TPayload>(label: string, guard: (value: unknown) => value is TPayload) => ((arguments_: readonly unknown[]) => TPayload);
//# sourceMappingURL=events.d.ts.map