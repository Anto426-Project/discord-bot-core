import {
  LOCALIZATION_LOCALES,
  type LocalizationLocale,
} from "./LocalizationLocale.js";
import { LocalizationError } from "./LocalizationError.js";
import {
  extractTemplateParameters,
  sameTemplateParameters,
} from "./TemplateParameters.js";

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
export const localizedMessage = <Key extends string>(
  catalog: LocalizationCatalog<Key>,
  key: Key,
): LocalizedMessage =>
  Object.freeze({
    it: catalog.get("it", key),
    en: catalog.get("en", key),
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const invalidCatalog = (
  message: string,
  details?: Readonly<Record<string, unknown>>,
): never => {
  throw new LocalizationError("LOCALIZATION.INVALID_CATALOG", message, details);
};

const assertExactKeys = (
  actual: readonly string[],
  expected: readonly string[],
  path: string,
): void => {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = expected.filter((key) => !actualSet.has(key));
  const additional = actual.filter((key) => !expectedSet.has(key));

  if (missing.length > 0 || additional.length > 0) {
    invalidCatalog(`The catalog keys at "${path}" do not match.`, {
      path,
      missing,
      additional,
    });
  }
};

const validateMessages = <Key extends string>(
  value: unknown,
  locale: LocalizationLocale,
  keys: readonly Key[],
): Readonly<Record<Key, string>> => {
  if (!isRecord(value)) {
    return invalidCatalog(
      `The messages for locale "${locale}" must be an object.`,
      { locale },
    );
  }

  assertExactKeys(Object.keys(value), keys, `messages.${locale}`);

  const copy: Partial<Record<Key, string>> = {};
  for (const key of keys) {
    const message = value[key];
    if (typeof message !== "string") {
      return invalidCatalog(
        `Translation "${key}" for locale "${locale}" must be a non-empty string.`,
        { locale, key },
      );
    }
    if (message.trim().length === 0) {
      return invalidCatalog(
        `Translation "${key}" for locale "${locale}" must be a non-empty string.`,
        { locale, key },
      );
    }
    copy[key] = message;
  }
  return Object.freeze(copy) as Readonly<Record<Key, string>>;
};

const validateTemplateParity = <Key extends string>(
  messages: Readonly<Record<LocalizationLocale, Readonly<Record<Key, string>>>>,
  keys: readonly Key[],
): void => {
  for (const key of keys) {
    const italianParameters = extractTemplateParameters(
      messages.it[key],
      `messages.it.${key}`,
    );
    const englishParameters = extractTemplateParameters(
      messages.en[key],
      `messages.en.${key}`,
    );

    if (!sameTemplateParameters(italianParameters, englishParameters)) {
      invalidCatalog(
        `Translation "${key}" does not use the same placeholders in Italian and English.`,
        {
          key,
          it: italianParameters,
          en: englishParameters,
        },
      );
    }
  }
};

export const createLocalizationCatalog = <Key extends string>(
  definition: unknown,
  keys: readonly Key[],
): LocalizationCatalog<Key> => {
  if (!isRecord(definition)) {
    return invalidCatalog("The localization catalog must be an object.");
  }

  const { version, messages } = definition;
  if (
    typeof version !== "string" ||
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)
  ) {
    return invalidCatalog(
      "The localization catalog version must be an explicit semantic version.",
      { version },
    );
  }
  if (!isRecord(messages)) {
    return invalidCatalog(
      'The localization catalog must declare exactly the "it" and "en" message maps.',
    );
  }

  assertExactKeys(Object.keys(messages), LOCALIZATION_LOCALES, "messages");

  const validatedMessages = Object.freeze({
    it: validateMessages(messages["it"], "it", keys),
    en: validateMessages(messages["en"], "en", keys),
  });
  validateTemplateParity(validatedMessages, keys);

  const knownKeys = new Set<string>(keys);
  const catalog: LocalizationCatalog<Key> = {
    version,
    locales: LOCALIZATION_LOCALES,
    keys: keys,
    messages: validatedMessages,
    hasKey: (key): key is Key => knownKeys.has(key),
    get: (locale, key): string => {
      if (locale !== "it" && locale !== "en") {
        throw new LocalizationError(
          "LOCALIZATION.UNSUPPORTED_LOCALE",
          `Unsupported locale "${String(locale)}". No implicit fallback is allowed.`,
          { locale },
        );
      }
      if (!knownKeys.has(key)) {
        throw new LocalizationError(
          "LOCALIZATION.UNKNOWN_KEY",
          `Unknown translation key "${String(key)}".`,
          { key },
        );
      }
      return validatedMessages[locale][key];
    },
  };

  return Object.freeze(catalog);
};

