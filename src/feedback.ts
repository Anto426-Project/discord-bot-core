import { discordModal, discordTextInput, type DiscordModalPlan } from "./components.js";
type FeedbackField = Readonly<{ customId: string; label: string; minimumLength: number; maximumLength: number; placeholder?: string }>;
export interface DiscordFeedbackModalOptions {
  readonly customId: string;
  readonly title: string;
  readonly subject: FeedbackField;
  readonly description: FeedbackField;
}
/** Presentation only: submission destinations and authorization remain with the consumer. */
export const createDiscordFeedbackModal = (options: DiscordFeedbackModalOptions): DiscordModalPlan => discordModal({
  customId: options.customId, title: options.title,
  inputs: [discordTextInput({ ...options.subject, style: "short", required: true }),
    discordTextInput({ ...options.description, style: "paragraph", required: true })]
});
