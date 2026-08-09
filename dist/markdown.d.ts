/**
 * Projects untrusted text as a Discord Markdown literal. Message payloads still
 * disable mentions at the transport boundary; the zero-width separator also
 * keeps copied or independently rendered text from retaining mention syntax.
 */
export declare const escapeDiscordMarkdownLiteral: (value: string) => string;
//# sourceMappingURL=markdown.d.ts.map