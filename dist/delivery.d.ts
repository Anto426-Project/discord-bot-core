import type { DiscordMessagePlan, SafeDiscordMessageInput } from "./payload.js";
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
export type DiscordChannelMessageEdit = Readonly<{
    channelId: string;
    messageId: string;
    message: DiscordMessagePlan;
    signal?: AbortSignal;
}>;
export type DiscordDirectMessageEdit = Readonly<{
    recipientId: string;
    messageId: string;
    message: DiscordMessagePlan;
    signal?: AbortSignal;
}>;
/** Stable delivery boundary consumed by bot products, independent of the SDK. */
export interface DiscordMessageDeliveryPort {
    sendChannelMessage(input: DiscordChannelMessageDelivery): Promise<DiscordDeliveryReceipt>;
    sendDirectMessage(input: DiscordDirectMessageDelivery): Promise<DiscordDeliveryReceipt>;
}
/** Editing is separate so send-only consumers do not inherit mutation methods. */
export interface DiscordMessageEditingPort extends DiscordMessageDeliveryPort {
    editChannelMessage(input: DiscordChannelMessageEdit): Promise<DiscordDeliveryReceipt>;
    editDirectMessage(input: DiscordDirectMessageEdit): Promise<DiscordDeliveryReceipt>;
}
//# sourceMappingURL=delivery.d.ts.map