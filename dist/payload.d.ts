import { type EmbedPlan } from "../vendor/dynamic-embed-engine/dist/index.js";
import { type DiscordMessageActionRow } from "./components.js";
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
export type DiscordMessageFileAttachment = Readonly<{
    name: string;
    data: Uint8Array;
    contentType?: string;
    description?: string;
}>;
/** Provider-neutral message requested by a bot product. */
export interface DiscordMessagePlan {
    readonly content?: string;
    readonly embeds?: readonly EmbedPlan[];
    readonly components?: readonly DiscordMessageActionRow[];
    readonly allowedMentions?: DiscordAllowedMentionsInput;
    readonly files?: readonly DiscordMessageFileAttachment[];
}
/** Delivery-scoped message input used to derive a deterministic provider nonce. */
export interface SafeDiscordMessageInput extends DiscordMessagePlan {
    readonly deliveryId: string;
}
export type DiscordApiMessageComponent = Readonly<Record<string, unknown>>;
export type DiscordApiMessageActionRow = Readonly<{
    type: 1;
    components: readonly DiscordApiMessageComponent[];
}>;
export interface SafeDiscordMessagePayload {
    readonly content?: string;
    readonly embeds?: readonly DiscordApiEmbed[];
    readonly components?: readonly DiscordApiMessageActionRow[];
    readonly nonce: string;
    readonly enforce_nonce: true;
    readonly allowed_mentions: Readonly<{
        parse: readonly [];
        users: readonly string[];
        roles: readonly string[];
        replied_user: boolean;
    }>;
}
/** Revalidates and encodes message action rows without exposing the provider SDK. */
export declare const encodeSafeDiscordActionRows: (rows: readonly DiscordMessageActionRow[] | undefined) => readonly DiscordApiMessageActionRow[] | undefined;
export declare const encodeDiscordApiEmbed: (input: EmbedPlan) => DiscordApiEmbed;
export declare const encodeSafeDiscordEmbeds: (requestedEmbeds: readonly EmbedPlan[] | undefined) => readonly DiscordApiEmbed[];
export declare const createSafeDiscordMessage: (input: SafeDiscordMessageInput, destinationId: string) => SafeDiscordMessagePayload;
//# sourceMappingURL=payload.d.ts.map