import type { DiscordInteractionListener } from "./interactions.js";
export type DiscordGatewayIdentity = Readonly<{
    userId: string;
    username: string;
    applicationId: string;
}>;
export type DiscordGatewayRuntimeCondition = "DISCORD_GATEWAY_EVENT_BACKLOG_EXHAUSTED" | "DISCORD_GATEWAY_EVENT_LISTENER_QUARANTINED" | "DISCORD_INTERACTION_CAPACITY_EXHAUSTED" | "DISCORD_INTERACTION_ROUTER_QUARANTINED";
export type DiscordGatewayLifecycleEvent = Readonly<{
    type: "ready";
    identity: DiscordGatewayIdentity;
}> | Readonly<{
    type: "shard_resumed";
    shardId: number;
}> | Readonly<{
    type: "shard_disconnected";
    shardId: number;
    closeCode: number | null;
}> | Readonly<{
    type: "shard_reconnecting";
    shardId: number;
}> | Readonly<{
    type: "provider_error";
    code: "DISCORD_GATEWAY_ERROR";
}> | Readonly<{
    type: "runtime_degraded";
    code: DiscordGatewayRuntimeCondition;
}> | Readonly<{
    type: "runtime_recovered";
    code: DiscordGatewayRuntimeCondition;
}>;
export type DiscordGatewayLifecycleListener = (event: DiscordGatewayLifecycleEvent) => void | Promise<void>;
/**
 * Stable gateway boundary. Implementations own the provider client and expose
 * only normalized lifecycle and interaction data.
 */
export interface DiscordGatewayRuntimePort {
    start(signal?: AbortSignal): Promise<DiscordGatewayIdentity>;
    stop(): Promise<void>;
    isReady(): boolean;
    subscribeLifecycle(listener: DiscordGatewayLifecycleListener): () => void;
    subscribeInteractions(listener: DiscordInteractionListener): () => void;
}
//# sourceMappingURL=gateway.d.ts.map