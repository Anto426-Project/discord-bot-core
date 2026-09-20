type LocaleCode = "it" | "en";
const SUPPORTED_LOCALES = ["it", "en"] as const;

import { LocalizationError } from "./LocalizationError.js";

/**
 * Localization has an explicit supported locale universe. Adding a
 * language requires an explicit source change; filesystem discovery is not
 * supported.
 */
export const LOCALIZATION_LOCALES: readonly LocaleCode[] = Object.freeze([
  ...SUPPORTED_LOCALES
]);

export type LocalizationLocale = LocaleCode;

const LOCALE_PATTERN = /^(it|en)(?:-[a-z0-9]{2,8})*$/i;

/**
 * Accepts canonical locales and their regional BCP-47-like variants, but
 * always returns one of the two application locales. Unsupported languages
 * fail closed and never fall back implicitly.
 */
export const normalizeLocalizationLocale = (
  value: unknown
): LocalizationLocale => {
  if (typeof value !== "string") {
    throw new LocalizationError(
      "LOCALIZATION.UNSUPPORTED_LOCALE",
      'The locale must resolve explicitly to "it" or "en".',
      { value }
    );
  }

  const normalized = value.trim().replaceAll("_", "-").toLowerCase();
  if (!LOCALE_PATTERN.test(normalized)) {
    throw new LocalizationError(
      "LOCALIZATION.UNSUPPORTED_LOCALE",
      `Unsupported locale "${value}". The only supported languages are "it" and "en".`,
      { value }
    );
  }

  const language = normalized.split("-", 1)[0];
  if (language !== "it" && language !== "en") {
    throw new LocalizationError(
      "LOCALIZATION.UNSUPPORTED_LOCALE",
      `Unsupported locale "${value}". The only supported languages are "it" and "en".`,
      { value }
    );
  }
  return language;
};
