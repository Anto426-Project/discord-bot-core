import { type LocalizationCatalog } from "./LocalizationCatalog.js";
import { type LocalizationLocale } from "./LocalizationLocale.js";
export type TranslationPrimitive = string | number | boolean | bigint;
export type TranslationParameters = Readonly<Record<string, TranslationPrimitive>>;
export interface MessageTranslator<Key extends string = string> {
    translate(locale: LocalizationLocale, key: Key, parameters?: TranslationParameters): string;
}
export declare class Translator<Key extends string = string> implements MessageTranslator<Key> {
    readonly catalog: LocalizationCatalog<Key>;
    constructor(catalog: LocalizationCatalog<Key>);
    translate(locale: LocalizationLocale, key: Key, parameters?: TranslationParameters): string;
    translateFrom(locale: unknown, key: Key, parameters?: TranslationParameters): string;
}
//# sourceMappingURL=Translator.d.ts.map