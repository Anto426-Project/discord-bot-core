import type {
  LocalizationLocale,
  LocalizedMessage
} from "./PresentationLocalization.js";
import type { EmbedDynamicColorProfile } from "./EmbedDynamicColor.js";

import type { EmbedPlan as EngineEmbedPlan } from "../../vendor/dynamic-embed-engine/dist/index.js";
export {
  EMBED_THEMES,
  EMBED_LIMITS as DISCORD_EMBED_LIMITS, calculateEmbedTextLength
} from "../../vendor/dynamic-embed-engine/dist/index.js";
export type { EmbedTheme, EmbedAuthor, EmbedField, EmbedFooter } from "../../vendor/dynamic-embed-engine/dist/index.js";
export type PresentationLocale = LocalizationLocale;
export type LocalizedPresentationText = LocalizedMessage;
export interface EmbedPlan extends EngineEmbedPlan { readonly locale: PresentationLocale; }

export interface RequesterPresentation {
  readonly displayName: string;
  readonly avatarUrl?: string;
  readonly profileUrl?: string;
  readonly accentColor?: number;
  readonly dynamicColor?: EmbedDynamicColorProfile;
}

export interface GuildBrandingPresentation {
  readonly displayName: string;
  readonly iconUrl?: string;
  readonly websiteUrl?: string;
  readonly accentColor?: number;
  readonly dynamicColor?: EmbedDynamicColorProfile;
  readonly footerText?: LocalizedPresentationText;
}

export interface BotBrandingPresentation {
  readonly displayName: string;
  readonly avatarUrl?: string;
  readonly websiteUrl?: string;
  readonly accentColor?: number;
  readonly dynamicColor?: EmbedDynamicColorProfile;
  readonly footerText?: LocalizedPresentationText;
}

export interface EmbedPresentationContext {
  readonly locale: PresentationLocale;
  readonly requester?: RequesterPresentation;
  readonly guild?: GuildBrandingPresentation;
  readonly bot?: BotBrandingPresentation;
}

export const localizePresentationText = (
  text: LocalizedPresentationText,
  locale: PresentationLocale
): string => text[locale];


/** Shared command chrome palette; color calculations belong to the embed engine. */
export const EMBED_THEME_COLORS = Object.freeze({ info: 0x00e5ff, success: 0x00f5a0, warning: 0xffb000, error: 0xff3860, neutral: 0x1a1b26 });
