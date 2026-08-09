export type DiscordSnowflake = string & {
    readonly __discordSnowflake: unique symbol;
};
export declare const parseDiscordSnowflake: (value: string, label?: string) => DiscordSnowflake;
export declare const parseStableBotKey: (value: string, label?: string) => string;
export declare const discordInteractionCorrelationId: (interactionId: string) => string;
export declare const deterministicDiscordNonce: (deliveryId: string, destinationId: string) => string;
//# sourceMappingURL=identifiers.d.ts.map