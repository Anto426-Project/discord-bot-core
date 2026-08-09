import type { DiscordInteractionListener } from "./interactions.js";
export type DiscordGatewayIdentity = Readonly<{
    userId: string;
    username: string;
    applicationId: string;
}>;
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