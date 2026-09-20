import { LocalizationError } from "./LocalizationError.js";
const PLACEHOLDER_PATTERN = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;
export const extractTemplateParameters = (template, path) => {
    const parameters = new Set();
    for (const match of template.matchAll(PLACEHOLDER_PATTERN)) {
        const name = match[1];
        if (name !== undefined) {
            parameters.add(name);
        }
    }
    const withoutPlaceholders = template.replace(PLACEHOLDER_PATTERN, "");
    if (withoutPlaceholders.includes("{") || withoutPlaceholders.includes("}")) {
        throw new LocalizationError("LOCALIZATION.INVALID_TEMPLATE", `The translation template at "${path}" contains malformed placeholders.`, { path });
    }
    return Object.freeze([...parameters].sort());
};
export const sameTemplateParameters = (left, right) => left.length === right.length &&
    left.every((parameter, index) => parameter === right[index]);
//# sourceMappingURL=TemplateParameters.js.map