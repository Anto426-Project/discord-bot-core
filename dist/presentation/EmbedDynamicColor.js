import { resolveDynamicColor } from "../../vendor/dynamic-embed-engine/dist/index.js";
import { EMBED_THEME_COLORS } from "./EmbedPlan.js";
export { deriveDynamicColorProfile as deriveEmbedDynamicColorProfile, rgbToEmbedColor, embedColorToRgb } from "../../vendor/dynamic-embed-engine/dist/index.js";
/** Adapts bot entity names to the engine's generic color sources. */
export const resolveEmbedColor = (theme, context, policy = { source: "theme" }) => {
    const themeColor = EMBED_THEME_COLORS[theme];
    if (policy.source === "dynamic") {
        return resolveDynamicColor(themeColor, {}, { ...policy, source: "profile" });
    }
    if (policy.source === "entity") {
        const entity = context[policy.entity];
        const source = {
            ...(entity?.dynamicColor === undefined ? {} : { profile: entity.dynamicColor }),
            ...(entity?.accentColor === undefined ? {} : { accentColor: entity.accentColor })
        };
        return resolveDynamicColor(themeColor, { entity: source }, { ...policy, source: "context", key: "entity" });
    }
    return resolveDynamicColor(themeColor, {}, policy);
};
export const dynamicEmbedColorPolicy = (profile, blendRatio = 0.3) => profile === null ? Object.freeze({ source: "theme" }) : Object.freeze({ source: "dynamic", profile, blendRatio });
/**
 * Preserves the old source semantics without coupling presentation to gateway
 * entities. Automatic mode follows image -> thumbnail -> guild -> bot.
 * Requester color remains explicit, matching the legacy message flow.
 */
export const resolveEmbedImageColorSource = (sources, preference = "automatic") => {
    const preferred = (() => {
        switch (preference) {
            case "automatic":
                return undefined;
            case "image":
                return sources.imageUrl;
            case "thumbnail":
                return sources.thumbnailUrl;
            case "guild":
                return sources.guildIconUrl;
            case "bot":
                return sources.botAvatarUrl;
            case "requester":
                return sources.requesterAvatarUrl;
        }
    })();
    return (preferred ??
        sources.imageUrl ??
        sources.thumbnailUrl ??
        sources.guildIconUrl ??
        sources.botAvatarUrl);
};
//# sourceMappingURL=EmbedDynamicColor.js.map