import { DiscordCoreError } from "./errors.js";
const invalid = (summary) => {
    throw new DiscordCoreError("DISCORD_PAYLOAD_REJECTED", summary, false);
};
const boundedText = (value, minimum, maximum, label) => {
    if (typeof value !== "string" ||
        value.length < minimum ||
        value.length > maximum ||
        /[\u0000-\u001f\u007f]/u.test(value)) {
        invalid(`${label} is invalid.`);
    }
    return value;
};
export const discordCustomId = (value) => boundedText(value, 1, 100, "Discord component custom id");
const optionalText = (value, maximum, label) => value === undefined ? undefined : boundedText(value, 1, maximum, label);
const boundedCount = (value, fallback, maximum, label) => {
    const resolved = value ?? fallback;
    if (!Number.isSafeInteger(resolved) || resolved < 0 || resolved > maximum) {
        invalid(`${label} is invalid.`);
    }
    return resolved;
};
const boundedPlainArray = (value, minimum, maximum, label) => {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
        return invalid(`${label} must be a plain array.`);
    }
    const length = value.length;
    if (!Number.isSafeInteger(length) || length < minimum || length > maximum) {
        return invalid(`${label} size is invalid.`);
    }
    const copy = [];
    for (let index = 0; index < length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor === undefined || !("value" in descriptor)) {
            return invalid(`${label} must be dense and data-only.`);
        }
        copy.push(descriptor.value);
    }
    return Object.freeze(copy);
};
export const discordButton = (input) => {
    const label = optionalText(input.label, 80, "Discord button label");
    const emoji = optionalText(input.emoji, 100, "Discord button emoji");
    if (label === undefined && emoji === undefined)
        invalid("Discord button requires a label or emoji.");
    if (input.style === "link") {
        const url = input.url;
        if (input.customId !== undefined ||
            typeof url !== "string" ||
            url.length > 512) {
            invalid("Discord link button requires only an HTTPS URL.");
        }
        let parsed;
        try {
            parsed = new URL(url);
        }
        catch {
            return invalid("Discord link button URL is invalid.");
        }
        const normalizedUrl = parsed.toString();
        if (parsed.protocol !== "https:" ||
            parsed.username.length > 0 ||
            parsed.password.length > 0 ||
            normalizedUrl.length > 512) {
            invalid("Discord link button URL is not allowed.");
        }
        return Object.freeze({
            kind: "button",
            style: input.style,
            ...(label === undefined ? {} : { label }),
            url: normalizedUrl,
            ...(emoji === undefined ? {} : { emoji }),
            disabled: input.disabled === true,
        });
    }
    const customId = input.customId;
    if (input.url !== undefined || customId === undefined) {
        invalid("Discord interactive button requires only a custom id.");
    }
    return Object.freeze({
        kind: "button",
        style: input.style,
        ...(label === undefined ? {} : { label }),
        customId: discordCustomId(customId),
        ...(emoji === undefined ? {} : { emoji }),
        disabled: input.disabled === true,
    });
};
export const discordSelectOption = (input) => {
    const description = optionalText(input.description, 100, "Discord select option description");
    const emoji = optionalText(input.emoji, 100, "Discord select option emoji");
    return Object.freeze({
        label: boundedText(input.label, 1, 100, "Discord select option label"),
        value: boundedText(input.value, 1, 100, "Discord select option value"),
        ...(description === undefined ? {} : { description }),
        ...(emoji === undefined ? {} : { emoji }),
        default: input.default === true,
    });
};
export const discordStringSelect = (input) => {
    const sourceOptions = boundedPlainArray(input.options, 1, 25, "Discord string select options");
    const values = new Set();
    const options = sourceOptions.map((option) => {
        const projected = discordSelectOption(option);
        if (values.has(projected.value))
            invalid("Discord select option values must be unique.");
        values.add(projected.value);
        return projected;
    });
    const minimumValues = boundedCount(input.minimumValues, 1, 25, "Discord select minimum");
    const maximumValues = boundedCount(input.maximumValues, 1, 25, "Discord select maximum");
    if (minimumValues > maximumValues || maximumValues > options.length) {
        invalid("Discord select value bounds are inconsistent.");
    }
    const placeholder = optionalText(input.placeholder, 150, "Discord select placeholder");
    return Object.freeze({
        kind: "string_select",
        customId: discordCustomId(input.customId),
        options: Object.freeze(options),
        ...(placeholder === undefined ? {} : { placeholder }),
        minimumValues,
        maximumValues,
        disabled: input.disabled === true,
    });
};
export const discordUserSelect = (input) => {
    const minimumValues = boundedCount(input.minimumValues, 1, 25, "Discord user select minimum");
    const maximumValues = boundedCount(input.maximumValues, 1, 25, "Discord user select maximum");
    if (minimumValues > maximumValues)
        invalid("Discord user select value bounds are inconsistent.");
    const placeholder = optionalText(input.placeholder, 150, "Discord user select placeholder");
    return Object.freeze({
        kind: "user_select",
        customId: discordCustomId(input.customId),
        ...(placeholder === undefined ? {} : { placeholder }),
        minimumValues,
        maximumValues,
        disabled: input.disabled === true,
    });
};
export const discordMessageActionRow = (components) => {
    const sourceComponents = boundedPlainArray(components, 1, 5, "Discord action row components");
    if (Array.prototype.some.call(sourceComponents, (component) => component.kind !== "button") &&
        sourceComponents.length !== 1) {
        invalid("Discord select menus must occupy their own action row.");
    }
    return Object.freeze({ kind: "message_action_row", components: sourceComponents });
};
export const discordTextInput = (input) => {
    const minimumLength = boundedCount(input.minimumLength, 0, 4_000, "Discord text input minimum");
    const maximumLength = boundedCount(input.maximumLength, 4_000, 4_000, "Discord text input maximum");
    if (minimumLength > maximumLength || maximumLength < 1) {
        invalid("Discord text input length bounds are inconsistent.");
    }
    const placeholder = optionalText(input.placeholder, 100, "Discord text input placeholder");
    const value = optionalText(input.value, 4_000, "Discord text input value");
    return Object.freeze({
        kind: "text_input",
        customId: discordCustomId(input.customId),
        label: boundedText(input.label, 1, 45, "Discord text input label"),
        style: input.style,
        required: input.required !== false,
        minimumLength,
        maximumLength,
        ...(placeholder === undefined ? {} : { placeholder }),
        ...(value === undefined ? {} : { value }),
    });
};
export const discordModal = (input) => {
    const inputs = boundedPlainArray(input.inputs, 1, 5, "Discord modal inputs");
    const ids = new Set();
    const rows = inputs.map((component) => {
        if (ids.has(component.customId))
            invalid("Discord modal input ids must be unique.");
        ids.add(component.customId);
        return Object.freeze({ kind: "modal_action_row", component });
    });
    return Object.freeze({
        customId: discordCustomId(input.customId),
        title: boundedText(input.title, 1, 45, "Discord modal title"),
        rows: Object.freeze(rows),
    });
};
//# sourceMappingURL=components.js.map