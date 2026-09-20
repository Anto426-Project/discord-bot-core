import {
  resolveDynamicColor, type DynamicColorProfile
} from "../../vendor/dynamic-embed-engine/dist/index.js";
import { EMBED_THEME_COLORS, type EmbedPresentationContext, type EmbedTheme } from "./EmbedPlan.js";
export {
  deriveDynamicColorProfile as deriveEmbedDynamicColorProfile,
  rgbToEmbedColor, embedColorToRgb
} from "../../vendor/dynamic-embed-engine/dist/index.js";
export type {
  RgbColor as EmbedRgbColor,
  DynamicColorProfile as EmbedDynamicColorProfile,
  DeriveDynamicColorOptions as DeriveEmbedDynamicColorOptions
} from "../../vendor/dynamic-embed-engine/dist/index.js";
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

export type EmbedImageColorSourcePreference =
  | "automatic"
  | "image"
  | "thumbnail"
  | "guild"
  | "bot"
  | "requester";

export type EmbedColorEntity = "requester" | "guild" | "bot";

export type EmbedColorPolicy =
  | { readonly source: "theme" }
  | {
      readonly source: "dynamic";
      readonly profile: EmbedDynamicColorProfile;
      readonly blendRatio?: number;
    }
  | {
      readonly source: "entity";
      readonly entity: EmbedColorEntity;
      readonly blendRatio?: number;
    }
  | {
      readonly source: "manual";
      readonly color: number;
    };

/** Adapts bot entity names to the engine's generic color sources. */
export const resolveEmbedColor = (
  theme: EmbedTheme, context: EmbedPresentationContext,
  policy: EmbedColorPolicy = { source: "theme" }
): number => {
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
export const dynamicEmbedColorPolicy = (
  profile: EmbedDynamicColorProfile | null, blendRatio = 0.3
): EmbedColorPolicy => profile === null ? Object.freeze({ source: "theme" }) : Object.freeze({ source: "dynamic", profile, blendRatio });

/**
 * Preserves the old source semantics without coupling presentation to gateway
 * entities. Automatic mode follows image -> thumbnail -> guild -> bot.
 * Requester color remains explicit, matching the legacy message flow.
 */
export const resolveEmbedImageColorSource = (
  sources: EmbedImageColorSources,
  preference: EmbedImageColorSourcePreference = "automatic"
): string | undefined => {
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
  return (
    preferred ??
    sources.imageUrl ??
    sources.thumbnailUrl ??
    sources.guildIconUrl ??
    sources.botAvatarUrl
  );
};
