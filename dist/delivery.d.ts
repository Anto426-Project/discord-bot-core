import type { SafeDiscordMessageInput } from "./payload.js";
export type DiscordDeliveryReceipt = Readonly<{
    messageId: string;
    channelId: string;
}>;
export type DiscordChannelMessageDelivery = Readonly<{
    channelId: string;
    message: SafeDiscordMessageInput;
    signal?: AbortSignal;
}>;
export type DiscordDirectMessageDelivery = Readonly<{
    recipientId: string;
    message: SafeDiscordMessageInput;
    signal?: AbortSignal;
}>;
/** Stable delivery boundary consumed by bot products, independent of the SDK. */
export interface DiscordMessageDeliveryPort {
    sendChannelMessage(input: DiscordChannelMessageDelivery): Promise<DiscordDeliveryReceipt>;
    sendDirectMessage(input: DiscordDirectMessageDelivery): Promise<DiscordDeliveryReceipt>;
}
//# sourceMappingURL=delivery.d.ts.map