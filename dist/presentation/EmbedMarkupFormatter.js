const protectCodeBlocks = (input) => {
    const blocks = [];
    const text = input.replace(/\[code(?::([\w.+-]+))?\]([\s\S]*?)\[\/code\]/gi, (_match, language, body) => {
        const index = blocks.length;
        blocks.push(`\`\`\`${language ?? ""}\n${body.replace(/^\n|\n$/g, "")}\n\`\`\``);
        return `\u0000EMBED_CODE_${index}\u0000`;
    });
    return { text, blocks: Object.freeze(blocks) };
};
const restoreCodeBlocks = (input, blocks) => input.replace(/\u0000EMBED_CODE_(\d+)\u0000/g, (_match, rawIndex) => blocks[Number(rawIndex)] ?? "");
const formatQuoteBlocks = (input) => input.replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, (_match, body) => body
    .trim()
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n"));
/**
 * Pure formatter for the documented, provider-neutral authoring subset.
 * Unknown tags are preserved so malformed content is visible to its author.
 */
export const formatEmbedMarkup = (input, options = {}) => {
    const bullet = options.bullet?.trim() || "•";
    const normalized = input
        .replace(/\r\n?/g, "\n")
        .replaceAll("\\n", "\n")
        .replaceAll("\\t", "\t");
    const protectedCode = protectCodeBlocks(normalized);
    let formatted = formatQuoteBlocks(protectedCode.text)
        .replace(/\[b\]([\s\S]*?)\[\/b\]/gi, "**$1**")
        .replace(/\[i\]([\s\S]*?)\[\/i\]/gi, "*$1*")
        .replace(/\[u\]([\s\S]*?)\[\/u\]/gi, "__$1__")
        .replace(/\[s\]([\s\S]*?)\[\/s\]/gi, "~~$1~~")
        .replace(/\[hr\]/gi, "──────────");
    formatted = formatted
        .split("\n")
        .map((line) => {
        const heading = line.match(/^\s*#{1,3}\s+(.+?)\s*$/);
        if (heading?.[1] !== undefined) {
            return `**${heading[1]}**`;
        }
        if (/^\s*[-*+]\s+/.test(line)) {
            return line.replace(/^\s*[-*+]\s+/, `${bullet} `);
        }
        if (/^\s*\d+[.)]\s+/.test(line)) {
            return line.replace(/^\s*(\d+)[.)]\s+/, "$1) ");
        }
        return line.replace(/[ \t]+$/g, "");
    })
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    return restoreCodeBlocks(formatted, protectedCode.blocks);
};
//# sourceMappingURL=EmbedMarkupFormatter.js.map