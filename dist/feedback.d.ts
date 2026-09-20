import { type DiscordModalPlan } from "./components.js";
type FeedbackField = Readonly<{
    customId: string;
    label: string;
    minimumLength: number;
    maximumLength: number;
    placeholder?: string;
}>;
export interface DiscordFeedbackModalOptions {
    readonly customId: string;
    readonly title: string;
    readonly subject: FeedbackField;
    readonly description: FeedbackField;
}
/** Presentation only: submission destinations and authorization remain with the consumer. */
export declare const createDiscordFeedbackModal: (options: DiscordFeedbackModalOptions) => DiscordModalPlan;
export {};
//# sourceMappingURL=feedback.d.ts.map