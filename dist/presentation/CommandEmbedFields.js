import { localizePresentationText } from "./EmbedPlan.js";
const freezeLocalizedValue = (value) => Array.isArray(value)
    ? Object.freeze(value.map((entry) => Object.freeze({ ...entry })))
    : Object.freeze({ ...value });
export const commandBlockField = (name, value) => Object.freeze({
    kind: "block",
    name: Object.freeze({ ...name }),
    value: freezeLocalizedValue(value)
});
export const commandInlineField = (name, value) => Object.freeze({
    kind: "inline",
    name: Object.freeze({ ...name }),
    value: freezeLocalizedValue(value)
});
export const commandStatField = (label, value, options = {}) => Object.freeze({
    kind: "stat",
    label: Object.freeze({ ...label }),
    value: freezeLocalizedValue(value),
    inline: options.inline ?? true,
    ...(options.emoji === undefined ? {} : { emoji: options.emoji })
});
const resolveValue = (value, locale) => {
    if (Array.isArray(value)) {
        const resolved = value
            .map((entry) => localizePresentationText(entry, locale))
            .filter((entry) => entry.length > 0);
        return resolved.length === 0 ? "—" : resolved.join("\n");
    }
    return localizePresentationText(value, locale);
};
export const resolveCommandEmbedField = (field, locale) => {
    if (field.kind === "stat") {
        const label = localizePresentationText(field.label, locale);
        return Object.freeze({
            name: field.emoji === undefined
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
//# sourceMappingURL=CommandEmbedFields.js.map