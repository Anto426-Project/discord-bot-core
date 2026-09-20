import { discordModal, discordTextInput } from "./components.js";
/** Presentation only: submission destinations and authorization remain with the consumer. */
export const createDiscordFeedbackModal = (options) => discordModal({
    customId: options.customId, title: options.title,
    inputs: [discordTextInput({ ...options.subject, style: "short", required: true }),
        discordTextInput({ ...options.description, style: "paragraph", required: true })]
});
//# sourceMappingURL=feedback.js.map