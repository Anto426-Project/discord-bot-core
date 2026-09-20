import { type MessageTranslator } from "./PresentationLocalization.js";
import { type EmbedAuthor, type EmbedField, type EmbedFooter, type EmbedPlan, type EmbedPresentationContext, type EmbedTheme, type GuildBrandingPresentation, type PresentationLocale, type RequesterPresentation } from "./EmbedPlan.js";
export type EmbedValidationCode = "EMBED.EMPTY_TEXT" | "EMBED.TEXT_LIMIT_EXCEEDED" | "EMBED.FIELD_LIMIT_EXCEEDED" | "EMBED.TOTAL_TEXT_LIMIT_EXCEEDED" | "EMBED.INVALID_FIELD" | "EMBED.INVALID_LOCALE" | "EMBED.INVALID_COLOR" | "EMBED.INVALID_TIMESTAMP" | "EMBED.INVALID_URL" | "EMBED.URL_NOT_ALLOWED";
export interface EmbedValidationIssue {
    readonly code: EmbedValidationCode;
    readonly path: string;
    readonly message: string;
    readonly actual?: number | string;
    readonly limit?: number;
}
export declare class EmbedValidationError extends Error {
    readonly issues: readonly EmbedValidationIssue[];
    constructor(issues: readonly EmbedValidationIssue[]);
}
export interface EmbedUrlPolicy {
    readonly allowedProtocols: readonly string[];
    readonly allowedHosts?: readonly string[];
}
export interface CreateEmbedPlanOptions {
    readonly locale?: PresentationLocale;
    readonly urlPolicy?: EmbedUrlPolicy;
    readonly translator?: MessageTranslator;
}
export type EmbedPlanTransformer = (builder: EmbedPlanBuilder) => EmbedPlanBuilder;
export declare class EmbedPlanBuilder {
    private readonly draft;
    private readonly urlPolicy;
    private readonly translator;
    private constructor();
    static create(theme: EmbedTheme, options?: CreateEmbedPlanOptions): EmbedPlanBuilder;
    static fromPlan(plan: EmbedPlan, options?: Pick<CreateEmbedPlanOptions, "urlPolicy" | "translator">): EmbedPlanBuilder;
    static info(options?: CreateEmbedPlanOptions): EmbedPlanBuilder;
    static success(options?: CreateEmbedPlanOptions): EmbedPlanBuilder;
    static warning(options?: CreateEmbedPlanOptions): EmbedPlanBuilder;
    static error(options?: CreateEmbedPlanOptions): EmbedPlanBuilder;
    static neutral(options?: CreateEmbedPlanOptions): EmbedPlanBuilder;
    private next;
    title(value: string): EmbedPlanBuilder;
    description(value: string): EmbedPlanBuilder;
    url(value: string): EmbedPlanBuilder;
    color(value: number): EmbedPlanBuilder;
    timestamp(value: Date | string): EmbedPlanBuilder;
    author(value: EmbedAuthor): EmbedPlanBuilder;
    footer(value: EmbedFooter): EmbedPlanBuilder;
    thumbnail(value: string): EmbedPlanBuilder;
    image(value: string): EmbedPlanBuilder;
    field(name: string, value: string, inline?: boolean): EmbedPlanBuilder;
    fields(values: readonly EmbedField[]): EmbedPlanBuilder;
    requester(requester: RequesterPresentation, locale?: PresentationLocale): EmbedPlanBuilder;
    guildBranding(guild: GuildBrandingPresentation, locale?: PresentationLocale): EmbedPlanBuilder;
    context(context: EmbedPresentationContext): EmbedPlanBuilder;
    transform(...transformers: readonly EmbedPlanTransformer[]): EmbedPlanBuilder;
    /**
     * Strict construction never truncates text or discards fields. Callers that
     * need several messages must paginate before invoking this operation.
     */
    buildStrict(): EmbedPlan;
    build(): EmbedPlan;
}
export declare const composeEmbedTransformers: (...transformers: readonly EmbedPlanTransformer[]) => EmbedPlanTransformer;
//# sourceMappingURL=EmbedPlanBuilder.d.ts.map