import { EMBED_LIMITS, calculateEmbedTextLength, validateEmbedPlan, } from "../vendor/dynamic-embed-engine/dist/index.js";
import { DiscordCoreError } from "./errors.js";
import { deterministicDiscordNonce, parseDiscordSnowflake } from "./identifiers.js";
const uniqueSnowflakes = (values, label) => {
    if (values === undefined)
        return Object.freeze([]);
    if (!Array.isArray(values) || Object.getPrototypeOf(values) !== Array.prototype || values.length > 100) {
        throw new DiscordCoreError("DISCORD_PAYLOAD_REJECTED", `${label} exceeds the Discord mention allowlist limit.`, false);
    }
    const normalized = [];
    for (let index = 0; index < values.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(values, String(index));
        if (descriptor === undefined || !("value" in descriptor) || typeof descriptor.value !== "string") {
            throw new DiscordCoreError("DISCORD_PAYLOAD_REJECTED", `${label} must be a dense string array.`, false);
        }
        normalized.push(parseDiscordSnowflake(descriptor.value, label));
    }
    return Object.freeze([...new Set(normalized)]);
};
export const encodeDiscordApiEmbed = (input) => {
    const plan = validateEmbedPlan(input);
    return Object.freeze({
        color: plan.color,
        ...(plan.title === undefined ? {} : { title: plan.title }),
        ...(plan.description === undefined ? {} : { description: plan.description }),
        ...(plan.url === undefined ? {} : { url: plan.url }),
        ...(plan.timestamp === undefined ? {} : { timestamp: plan.timestamp }),
        ...(plan.author === undefined
            ? {}
            : {
                author: Object.freeze({
                    name: plan.author.name,
                    ...(plan.author.url === undefined ? {} : { url: plan.author.url }),
                    ...(plan.author.iconUrl === undefined ? {} : { icon_url: plan.author.iconUrl }),
                }),
            }),
        ...(plan.footer === undefined
            ? {}
            : {
                footer: Object.freeze({
                    text: plan.footer.text,
                    ...(plan.footer.iconUrl === undefined ? {} : { icon_url: plan.footer.iconUrl }),
                }),
            }),
        ...(plan.thumbnailUrl === undefined
            ? {}
            : { thumbnail: Object.freeze({ url: plan.thumbnailUrl }) }),
        ...(plan.imageUrl === undefined ? {} : { image: Object.freeze({ url: plan.imageUrl }) }),
        ...(plan.fields.length === 0
            ? {}
            : {
                fields: Object.freeze(plan.fields.map((field) => Object.freeze({ name: field.name, value: field.value, inline: field.inline }))),
            }),
    });
};
export const encodeSafeDiscordEmbeds = (requestedEmbeds) => {
    const source = requestedEmbeds ?? [];
    if (!Array.isArray(source) ||
        Object.getPrototypeOf(source) !== Array.prototype ||
        source.length > 10) {
        throw new DiscordCoreError("DISCORD_PAYLOAD_REJECTED", "Discord message embed limit exceeded.", false);
    }
    const embeds = [];
    for (let index = 0; index < source.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(source, String(index));
        if (descriptor === undefined || !("value" in descriptor)) {
            throw new DiscordCoreError("DISCORD_PAYLOAD_REJECTED", "Discord message embeds must be a dense data array.", false);
        }
        embeds.push(validateEmbedPlan(descriptor.value));
    }
    const aggregateEmbedText = embeds.reduce((total, embed) => total + calculateEmbedTextLength(embed), 0);
    if (aggregateEmbedText > EMBED_LIMITS.totalText) {
        throw new DiscordCoreError("DISCORD_PAYLOAD_REJECTED", "Discord message aggregate embed text limit exceeded.", false);
    }
    return Object.freeze(embeds.map((embed) => encodeDiscordApiEmbed(embed)));
};
export const createSafeDiscordMessage = (input, destinationId) => {
    const content = input.content;
    if (content !== undefined &&
        (typeof content !== "string" || content.length < 1 || content.length > 2_000)) {
        throw new DiscordCoreError("DISCORD_PAYLOAD_REJECTED", "Discord message content must contain between 1 and 2000 characters.", false);
    }
    const embeds = encodeSafeDiscordEmbeds(input.embeds);
    if (content === undefined && embeds.length === 0) {
        throw new DiscordCoreError("DISCORD_PAYLOAD_REJECTED", "Discord message requires content or an embed.", false);
    }
    const users = uniqueSnowflakes(input.allowedMentions?.users, "allowed mention user");
    const roles = uniqueSnowflakes(input.allowedMentions?.roles, "allowed mention role");
    return Object.freeze({
        ...(content === undefined ? {} : { content }),
        ...(embeds.length === 0
            ? {}
            : { embeds }),
        nonce: deterministicDiscordNonce(input.deliveryId, destinationId),
        enforce_nonce: true,
        allowed_mentions: Object.freeze({
            parse: Object.freeze([]),
            users,
            roles,
            replied_user: input.allowedMentions?.repliedUser === true,
        }),
    });
};
//# sourceMappingURL=payload.js.map