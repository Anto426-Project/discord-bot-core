import { type LocalizationLocale } from "./LocalizationLocale.js";
export interface LocalizationCatalog<Key extends string = string> {
    readonly version: string;
    readonly locales: readonly LocalizationLocale[];
    readonly keys: readonly Key[];
    readonly messages: Readonly<Record<LocalizationLocale, Readonly<Record<Key, string>>>>;
    hasKey(key: string): key is Key;
    get(locale: LocalizationLocale, key: Key): string;
}
export type LocalizedMessage = Readonly<{
    it: string;
    en: string;
}>;
/**
 * Pure bridge for provider catalogs (for example slash-command
 * localizations) that need both supported strings at once.
 */
export declare const localizedMessage: <Key extends string>(catalog: LocalizationCatalog<Key>, key: Key) => LocalizedMessage;
export declare const createLocalizationCatalog: <Key extends string>(definition: unknown, keys: readonly Key[]) => LocalizationCatalog<Key>;
//# sourceMappingURL=LocalizationCatalog.d.ts.map