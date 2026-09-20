import { type DynamicColorProfile } from "../../vendor/dynamic-embed-engine/dist/index.js";
import { type EmbedPresentationContext, type EmbedTheme } from "./EmbedPlan.js";
export { deriveDynamicColorProfile as deriveEmbedDynamicColorProfile, rgbToEmbedColor, embedColorToRgb } from "../../vendor/dynamic-embed-engine/dist/index.js";
export type { RgbColor as EmbedRgbColor, DynamicColorProfile as EmbedDynamicColorProfile, DeriveDynamicColorOptions as DeriveEmbedDynamicColorOptions } from "../../vendor/dynamic-embed-engine/dist/index.js";
type EmbedDynamicColorProfile = DynamicColorProfile;
export interface EmbedImageColorProvider {
    resolveImageColor(url: string): Promise<EmbedDynamicColorProfile | null>;
}
export interface EmbedImageColorSources {
    readonly imageUrl?: string;
    readonly thumbnailUrl?: string;
    readonly guildIconUrl?: string;
    readonly botAvatarUrl?: string;
    readonly requesterAvatarUrl?: string;
}
export type EmbedImageColorSourcePreference = "automatic" | "image" | "thumbnail" | "guild" | "bot" | "requester";
export type EmbedColorEntity = "requester" | "guild" | "bot";
export type EmbedColorPolicy = {
    readonly source: "theme";
} | {
    readonly source: "dynamic";
    readonly profile: EmbedDynamicColorProfile;
    readonly blendRatio?: number;
} | {
    readonly source: "entity";
    readonly entity: EmbedColorEntity;
    readonly blendRatio?: number;
} | {
    readonly source: "manual";
    readonly color: number;
};
/** Adapts bot entity names to the engine's generic color sources. */
export declare const resolveEmbedColor: (theme: EmbedTheme, context: EmbedPresentationContext, policy?: EmbedColorPolicy) => number;
export declare const dynamicEmbedColorPolicy: (profile: EmbedDynamicColorProfile | null, blendRatio?: number) => EmbedColorPolicy;
/**
 * Preserves the old source semantics without coupling presentation to gateway
 * entities. Automatic mode follows image -> thumbnail -> guild -> bot.
 * Requester color remains explicit, matching the legacy message flow.
 */
export declare const resolveEmbedImageColorSource: (sources: EmbedImageColorSources, preference?: EmbedImageColorSourcePreference) => string | undefined;
//# sourceMappingURL=EmbedDynamicColor.d.ts.map