import {} from "./LocalizationCatalog.js";
import { normalizeLocalizationLocale } from "./LocalizationLocale.js";
import { LocalizationError } from "./LocalizationError.js";
import { extractTemplateParameters } from "./TemplateParameters.js";
const isParameterRecord = (value) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
};
const isTranslationPrimitive = (value) => typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "bigint" ||
    (typeof value === "number" && Number.isFinite(value));
const serializePrimitive = (value) => typeof value === "bigint" ? value.toString(10) : String(value);
export class Translator {
    catalog;
    constructor(catalog) {
        this.catalog = catalog;
    }
    translate(locale, key, parameters = {}) {
        if (!isParameterRecord(parameters)) {
            throw new LocalizationError("LOCALIZATION.INVALID_PARAMETER", "Translation parameters must be a plain key/value object.", { key });
        }
        const template = this.catalog.get(locale, key);
        const required = extractTemplateParameters(template, `${locale}.${String(key)}`);
        const provided = Object.keys(parameters).sort();
        const missing = required.filter((parameter) => !Object.prototype.hasOwnProperty.call(parameters, parameter));
        if (missing.length > 0) {
            throw new LocalizationError("LOCALIZATION.MISSING_PARAMETER", `Translation "${String(key)}" is missing interpolation parameters.`, { key, missing });
        }
        const requiredSet = new Set(required);
        const unused = provided.filter((parameter) => !requiredSet.has(parameter));
        if (unused.length > 0) {
            throw new LocalizationError("LOCALIZATION.UNUSED_PARAMETER", `Translation "${String(key)}" received unused interpolation parameters.`, { key, unused });
        }
        for (const parameter of provided) {
            const value = parameters[parameter];
            if (!isTranslationPrimitive(value)) {
                throw new LocalizationError("LOCALIZATION.INVALID_PARAMETER", `Interpolation parameter "${parameter}" must be a finite primitive value.`, { key, parameter });
            }
        }
        return template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (_placeholder, parameter) => serializePrimitive(parameters[parameter]));
    }
    translateFrom(locale, key, parameters) {
        return this.translate(normalizeLocalizationLocale(locale), key, parameters);
    }
}
//# sourceMappingURL=Translator.js.map