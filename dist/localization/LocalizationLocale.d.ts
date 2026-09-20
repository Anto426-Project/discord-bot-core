type LocaleCode = "it" | "en";
/**
 * Localization has an explicit supported locale universe. Adding a
 * language requires an explicit source change; filesystem discovery is not
 * supported.
 */
export declare const LOCALIZATION_LOCALES: readonly LocaleCode[];
export type LocalizationLocale = LocaleCode;
/**
 * Accepts canonical locales and their regional BCP-47-like variants, but
 * always returns one of the two application locales. Unsupported languages
 * fail closed and never fall back implicitly.
 */
export declare const normalizeLocalizationLocale: (value: unknown) => LocalizationLocale;
export {};
//# sourceMappingURL=LocalizationLocale.d.ts.map