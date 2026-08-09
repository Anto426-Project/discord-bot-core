export type DiscordRuntimeAvailability = "starting" | "ready" | "degraded" | "stopping";
export declare class DiscordRuntimeAvailabilityTracker {
    private lifecycle;
    private gatewayDegraded;
    private readonly degradationCauses;
    current(): DiscordRuntimeAvailability;
    degradeGateway(): boolean;
    recoverGateway(): boolean;
    isGatewayDegraded(): boolean;
    setSynchronizationDegraded(degraded: boolean): void;
    setSynchronizationCause(cause: string, degraded: boolean): void;
    causes(): readonly string[];
    markActive(): void;
    markStopping(): void;
}
//# sourceMappingURL=availability.d.ts.map