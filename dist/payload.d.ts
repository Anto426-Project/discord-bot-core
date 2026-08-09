import { type EmbedPlan } from "../vendor/dynamic-embed-engine/dist/index.js";
export interface DiscordApiEmbed {
    readonly color: number;
    readonly title?: string;
    readonly description?: string;
    readonly url?: string;
    readonly timestamp?: string;
    readonly author?: Readonly<{
        name: string;
        url?: string;
        icon_url?: string;
    }>;
    readonly footer?: Readonly<{
        text: string;
        icon_url?: string;
    }>;
    readonly thumbnail?: Readonly<{
        url: string;
    }>;
    readonly image?: Readonly<{
        url: string;
    }>;
    readonly fields?: readonly Readonly<{
        name: string;
        value: string;
        inline: boolean;
    }>[];
}
export interface DiscordAllowedMentionsInput {
    readonly users?: readonly string[];
    readonly roles?: readonly string[];
    readonly repliedUser?: boolean;
}
export interface SafeDiscordMessageInput {
    readonly deliveryId: string;
    readonly content?: string;
    readonly embeds?: readonly EmbedPlan[];
    readonly allowedMentions?: DiscordAllowedMentionsInput;
}
export interface SafeDiscordMessagePayload {
    readonly content?: string;
    readonly embeds?: readonly DiscordApiEmbed[];
    readonly nonce: string;
    readonly enforce_nonce: true;
    readonly allowed_mentions: Readonly<{
        parse: readonly [];
        users: readonly string[];
        roles: readonly string[];
        replied_user: boolean;
    }>;
}
export declare const encodeDiscordApiEmbed: (input: EmbedPlan) => DiscordApiEmbed;
export declare const encodeSafeDiscordEmbeds: (requestedEmbeds: readonly EmbedPlan[] | undefined) => readonly DiscordApiEmbed[];
export declare const createSafeDiscordMessage: (input: SafeDiscordMessageInput, destinationId: string) => SafeDiscordMessagePayload;
//# sourceMappingURL=payload.d.ts.map