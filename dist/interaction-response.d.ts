import type { DiscordChatInputInteraction, DiscordInteractionResponder, DiscordInteractionMessagePlan, DiscordEditableInteractionMessagePlan } from "./interactions.js";
export type DiscordCommandAcknowledgement = "immediate-public" | "immediate-ephemeral" | "defer-public" | "defer-ephemeral" | "defer-dynamic";
export declare const acknowledgeDiscordCommand: (interaction: DiscordChatInputInteraction, acknowledgement: DiscordCommandAcknowledgement) => Promise<void>;
export declare const toEditableResponse: (response: DiscordInteractionMessagePlan) => DiscordEditableInteractionMessagePlan;
/** Completes an acknowledgement or follows up an already completed response. */
export declare const deliverDiscordResponse: (responder: DiscordInteractionResponder, response: DiscordInteractionMessagePlan) => Promise<void>;
export declare const interactionCreatedAt: (interaction: Pick<DiscordChatInputInteraction, "createdAt">) => Date;
//# sourceMappingURL=interaction-response.d.ts.map