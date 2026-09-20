import {
  localizePresentationText,
  type EmbedField,
  type LocalizedPresentationText,
  type PresentationLocale
} from "./EmbedPlan.js";

export type LocalizedFieldValue =
  | LocalizedPresentationText
  | readonly LocalizedPresentationText[];

export type CommandEmbedField =
  | {
      readonly kind: "block";
      readonly name: LocalizedPresentationText;
      readonly value: LocalizedFieldValue;
    }
  | {
      readonly kind: "inline";
      readonly name: LocalizedPresentationText;
      readonly value: LocalizedFieldValue;
    }
  | {
      readonly kind: "stat";
      readonly label: LocalizedPresentationText;
      readonly value: LocalizedFieldValue;
      readonly inline: boolean;
      readonly emoji?: string;
    };

const freezeLocalizedValue = (
  value: LocalizedFieldValue
): LocalizedFieldValue =>
  Array.isArray(value)
    ? Object.freeze(value.map((entry) => Object.freeze({ ...entry })))
    : Object.freeze({ ...value });

export const commandBlockField = (
  name: LocalizedPresentationText,
  value: LocalizedFieldValue
): CommandEmbedField =>
  Object.freeze({
    kind: "block",
    name: Object.freeze({ ...name }),
    value: freezeLocalizedValue(value)
  });

export const commandInlineField = (
  name: LocalizedPresentationText,
  value: LocalizedFieldValue
): CommandEmbedField =>
  Object.freeze({
    kind: "inline",
    name: Object.freeze({ ...name }),
    value: freezeLocalizedValue(value)
  });

export const commandStatField = (
  label: LocalizedPresentationText,
  value: LocalizedFieldValue,
  options: {
    readonly inline?: boolean;
    readonly emoji?: string;
  } = {}
): CommandEmbedField =>
  Object.freeze({
    kind: "stat",
    label: Object.freeze({ ...label }),
    value: freezeLocalizedValue(value),
    inline: options.inline ?? true,
    ...(options.emoji === undefined ? {} : { emoji: options.emoji })
  });

const resolveValue = (
  value: LocalizedFieldValue,
  locale: PresentationLocale
): string => {
  if (Array.isArray(value)) {
    const resolved = value
      .map((entry) => localizePresentationText(entry, locale))
      .filter((entry) => entry.length > 0);
    return resolved.length === 0 ? "—" : resolved.join("\n");
  }
  return localizePresentationText(
    value as LocalizedPresentationText,
    locale
  );
};

export const resolveCommandEmbedField = (
  field: CommandEmbedField,
  locale: PresentationLocale
): EmbedField => {
  if (field.kind === "stat") {
    const label = localizePresentationText(field.label, locale);
    return Object.freeze({
      name:
        field.emoji === undefined
          ? `▸ ${label}`
          : `${field.emoji} ┃ ${label}`,
      value: resolveValue(field.value, locale),
      inline: field.inline
    });
  }

  return Object.freeze({
    name: `▸ ${localizePresentationText(field.name, locale)}`,
    value: resolveValue(field.value, locale),
    inline: field.kind === "inline"
  });
};
