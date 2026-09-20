export type PollingWorkResult = Readonly<{
    status: string;
}>;
export type PollingSupervisorOptions = Readonly<{
    maximumActionsPerDrain: number;
    idlePollIntervalMs: number;
    failurePollIntervalMs: number;
    onError(error: unknown): void | Promise<void>;
}>;
/**
 * Owns one bounded, non-overlapping polling loop around the durable worker.
 * Stop aborts provider work and then drains the active claim before resolving.
 */
export declare class PollingSupervisor {
    private readonly worker;
    private readonly options;
    private readonly maximumActionsPerDrain;
    private readonly idlePollIntervalMs;
    private readonly failurePollIntervalMs;
    private controller;
    private activeLoop;
    constructor(worker: {
        runOnce(signal: AbortSignal): Promise<PollingWorkResult>;
    }, options: PollingSupervisorOptions);
    start(): void;
    stop(): Promise<void>;
    isRunning(): boolean;
    private run;
    private drain;
}
//# sourceMappingURL=PollingSupervisor.d.ts.map