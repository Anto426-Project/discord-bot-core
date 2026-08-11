import type { DiscordApplicationCommandBody } from "./command-model.js";
import { type DiscordApplicationCommandsRestPort, type DiscordCommandPublicationScope, type DiscordRemoteApplicationCommand } from "./command-publisher.js";
import type { DiscordChannelMessageDelivery, DiscordDeliveryReceipt, DiscordDirectMessageDelivery, DiscordMessageDeliveryPort } from "./delivery.js";
import type { DiscordGatewayIdentity, DiscordGatewayLifecycleListener, DiscordGatewayRuntimePort } from "./gateway.js";
import type { DiscordInteraction, DiscordInteractionListener } from "./interactions.js";
export type DiscordPrivilegedGatewayIntent = "GuildMembers" | "GuildPresences" | "MessageContent";
export declare const DISCORD_GATEWAY_INTENTS: readonly ["Guilds", "GuildMembers", "GuildModeration", "GuildExpressions", "GuildIntegrations", "GuildWebhooks", "GuildInvites", "GuildVoiceStates", "GuildPresences", "GuildMessages", "GuildMessageReactions", "GuildMessageTyping", "DirectMessages", "DirectMessageReactions", "DirectMessageTyping", "MessageContent", "GuildScheduledEvents", "AutoModerationConfiguration", "AutoModerationExecution", "GuildMessagePolls", "DirectMessagePolls"];
export type DiscordGatewayIntent = (typeof DISCORD_GATEWAY_INTENTS)[number];
export type DiscordGatewayPartial = "channel" | "guild_member" | "guild_scheduled_event" | "message" | "reaction" | "soundboard_sound" | "thread_member" | "user";
export interface NodeDiscordGatewayOptions {
    readonly botToken: string;
    readonly intents: readonly DiscordGatewayIntent[];
    readonly acknowledgedPrivilegedIntents?: readonly DiscordPrivilegedGatewayIntent[];
    readonly partials?: readonly DiscordGatewayPartial[];
    readonly closeTimeoutMs?: number;
    readonly waitGuildTimeoutMs?: number;
    readonly startupTimeoutMs?: number;
    readonly listenerTimeoutMs?: number;
}
/**
 * Converts a provider-owned Node interaction into the stable core DTO.
 *
 * The unknown input is intentional: consumers may forward an object received by
 * their provider adapter without importing or exposing any provider SDK type. A
 * structural lookalike is rejected because accepting one would let untrusted
 * objects execute arbitrary getters and methods inside the provider boundary.
 */
export declare const normalizeNodeDiscordInteraction: (value: unknown) => DiscordInteraction | null;
export interface NodeDiscordProviderExtensionHostPort {
    registerProviderExtension(extension: unknown): Promise<() => Promise<void>>;
}
export declare class NodeDiscordGatewayAdapter implements DiscordGatewayRuntimePort, NodeDiscordProviderExtensionHostPort {
    #private;
    constructor(options: NodeDiscordGatewayOptions);
    start(signal?: AbortSignal): Promise<DiscordGatewayIdentity>;
    stop(): Promise<void>;
    isReady(): boolean;
    subscribeLifecycle(listener: DiscordGatewayLifecycleListener): () => void;
    subscribeInteractions(listener: DiscordInteractionListener): () => void;
    registerProviderExtension(extension: unknown): Promise<() => Promise<void>>;
    toJSON(): Readonly<{
        component: "node-discord-gateway-adapter";
    }>;
}
export interface NodeDiscordRestOptions {
    readonly botToken: string;
    readonly timeoutMs?: number;
    readonly retries?: number;
    readonly globalRequestsPerSecond?: number;
    readonly invalidRequestWarningInterval?: number;
}
/**
 * Safe facade over the provider REST SDK. The internal SDK owns shared/global
 * bucket coordination, route queues and Retry-After waits; bot products never
 * depend on the provider library directly.
 */
export declare class NodeDiscordRestAdapter implements DiscordApplicationCommandsRestPort, DiscordMessageDeliveryPort {
    #private;
    constructor(options: NodeDiscordRestOptions);
    toJSON(): Readonly<{
        component: "node-discord-rest-adapter";
    }>;
    listApplicationCommands(scope: DiscordCommandPublicationScope, signal?: AbortSignal): Promise<readonly DiscordRemoteApplicationCommand[]>;
    createApplicationCommand(scope: DiscordCommandPublicationScope, command: DiscordApplicationCommandBody, signal?: AbortSignal): Promise<DiscordRemoteApplicationCommand>;
    updateApplicationCommand(scope: DiscordCommandPublicationScope, providerCommandId: string, command: DiscordApplicationCommandBody, signal?: AbortSignal): Promise<DiscordRemoteApplicationCommand>;
    deleteApplicationCommand(scope: DiscordCommandPublicationScope, providerCommandId: string, signal?: AbortSignal): Promise<"deleted" | "already_absent">;
    sendChannelMessage(input: DiscordChannelMessageDelivery): Promise<DiscordDeliveryReceipt>;
    private sendMessageToChannel;
    sendDirectMessage(input: DiscordDirectMessageDelivery): Promise<DiscordDeliveryReceipt>;
    private deliveryReceipt;
}
export interface NodeDiscordRuntimeOptions {
    readonly botToken: string;
    readonly gateway: Omit<NodeDiscordGatewayOptions, "botToken">;
    readonly rest?: Omit<NodeDiscordRestOptions, "botToken">;
}
export type NodeDiscordRuntimeServices = Readonly<{
    gateway: DiscordGatewayRuntimePort;
    extensions: NodeDiscordProviderExtensionHostPort;
    commands: DiscordApplicationCommandsRestPort;
    messages: DiscordMessageDeliveryPort;
}>;
/**
 * Composes one SDK-owned gateway and one SDK-owned REST coordinator behind
 * stable core ports. Products never receive either provider client.
 */
export declare const createNodeDiscordRuntime: (options: NodeDiscordRuntimeOptions) => NodeDiscordRuntimeServices;
//# sourceMappingURL=discordjs.d.ts.map