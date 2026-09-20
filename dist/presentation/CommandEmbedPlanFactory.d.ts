import { type MessageKey, type MessageTranslator } from "./PresentationLocalization.js";
import { type EmbedPlan, type EmbedPresentationContext, type EmbedTheme, type LocalizedPresentationText, type PresentationLocale } from "./EmbedPlan.js";
import { type EmbedPlanTransformer, type EmbedUrlPolicy } from "./EmbedPlanBuilder.js";
import { type EmbedColorPolicy } from "./EmbedDynamicColor.js";
import { type CommandEmbedField } from "./CommandEmbedFields.js";
export interface LocalizedEmbedAuthor {
    readonly name: LocalizedPresentationText;
    readonly url?: string;
    readonly iconUrl?: string;
}
export type CommandEmbedAuthorPolicy = {
    readonly source: "guild";
} | {
    readonly source: "bot";
} | {
    readonly source: "manual";
    readonly author: LocalizedEmbedAuthor;
} | {
    readonly source: "none";
};
export type CommandEmbedThumbnailPolicy = {
    readonly source: "guild";
} | {
    readonly source: "bot";
} | {
    readonly source: "requester";
} | {
    readonly source: "manual";
    readonly url: string;
} | {
    readonly source: "none";
};
export interface CommandEmbedThemeDecorationPolicy {
    readonly title: boolean;
    readonly description: boolean;
    readonly footer: boolean;
}
export interface CommandEmbedChromePolicy {
    readonly author: CommandEmbedAuthorPolicy;
    readonly thumbnail: CommandEmbedThumbnailPolicy;
    readonly requesterFooter: boolean;
    readonly botFooter: boolean;
    readonly footerPrefix?: LocalizedPresentationText;
    readonly themeBadge: CommandEmbedThemeDecorationPolicy;
    /**
     * No clock is read by presentation. Omit this value to omit the timestamp.
     */
    readonly timestamp?: Date;
}
export type CommandDescriptionFormat = "plain" | "markup";
export interface CommandEmbedContent {
    readonly title?: LocalizedPresentationText;
    readonly description?: LocalizedPresentationText;
    readonly descriptionFormat?: CommandDescriptionFormat;
    readonly fields?: readonly CommandEmbedField[];
    readonly imageUrl?: string;
    readonly url?: string;
}
export interface CreateCommandEmbedPlanInput {
    readonly context: EmbedPresentationContext;
    readonly content: CommandEmbedContent;
    readonly chrome: CommandEmbedChromePolicy;
    readonly color?: EmbedColorPolicy;
    readonly urlPolicy?: EmbedUrlPolicy;
    readonly transformers?: readonly EmbedPlanTransformer[];
}
export declare const COMMAND_EMBED_THEME_PRESENTATION: Readonly<Record<EmbedTheme, {
    readonly emoji: string;
    readonly labelKey: MessageKey;
}>>;
export interface CommandEmbedDefaults {
    readonly title: string;
    readonly description: string;
    readonly footer: string;
}
export declare const resolveCommandEmbedDefaults: (translator: MessageTranslator, locale: PresentationLocale) => CommandEmbedDefaults;
export declare const commandEmbedChrome: (overrides?: Partial<CommandEmbedChromePolicy>) => CommandEmbedChromePolicy;
export declare class CommandEmbedPlanFactory {
    private readonly translator;
    constructor(translator: MessageTranslator);
    create(theme: EmbedTheme, input: CreateCommandEmbedPlanInput): EmbedPlan;
    info(input: CreateCommandEmbedPlanInput): EmbedPlan;
    success(input: CreateCommandEmbedPlanInput): EmbedPlan;
    warning(input: CreateCommandEmbedPlanInput): EmbedPlan;
    error(input: CreateCommandEmbedPlanInput): EmbedPlan;
}
//# sourceMappingURL=CommandEmbedPlanFactory.d.ts.map