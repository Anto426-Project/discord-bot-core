export interface EmbedMarkupFormatOptions {
    readonly bullet?: string;
}
/**
 * Pure formatter for the documented, provider-neutral authoring subset.
 * Unknown tags are preserved so malformed content is visible to its author.
 */
export declare const formatEmbedMarkup: (input: string, options?: EmbedMarkupFormatOptions) => string;
//# sourceMappingURL=EmbedMarkupFormatter.d.ts.map