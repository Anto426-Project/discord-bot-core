import { type EmbedField, type LocalizedPresentationText, type PresentationLocale } from "./EmbedPlan.js";
export type LocalizedFieldValue = LocalizedPresentationText | readonly LocalizedPresentationText[];
export type CommandEmbedField = {
    readonly kind: "block";
    readonly name: LocalizedPresentationText;
    readonly value: LocalizedFieldValue;
} | {
    readonly kind: "inline";
    readonly name: LocalizedPresentationText;
    readonly value: LocalizedFieldValue;
} | {
    readonly kind: "stat";
    readonly label: LocalizedPresentationText;
    readonly value: LocalizedFieldValue;
    readonly inline: boolean;
    readonly emoji?: string;
};
export declare const commandBlockField: (name: LocalizedPresentationText, value: LocalizedFieldValue) => CommandEmbedField;
export declare const commandInlineField: (name: LocalizedPresentationText, value: LocalizedFieldValue) => CommandEmbedField;
export declare const commandStatField: (label: LocalizedPresentationText, value: LocalizedFieldValue, options?: {
    readonly inline?: boolean;
    readonly emoji?: string;
}) => CommandEmbedField;
export declare const resolveCommandEmbedField: (field: CommandEmbedField, locale: PresentationLocale) => EmbedField;
//# sourceMappingURL=CommandEmbedFields.d.ts.map