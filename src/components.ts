import { DiscordCoreError } from "./errors.js";

export type DiscordButtonStyle = "primary" | "secondary" | "success" | "danger" | "link";
export type DiscordTextInputStyle = "short" | "paragraph";

export type DiscordButtonComponent = Readonly<{
  kind: "button";
  style: DiscordButtonStyle;
  label?: string;
  customId?: string;
  url?: string;
  emoji?: string;
  disabled: boolean;
}>;

export type DiscordSelectOption = Readonly<{
  label: string;
  value: string;
  description?: string;
  emoji?: string;
  default: boolean;
}>;

export type DiscordStringSelectComponent = Readonly<{
  kind: "string_select";
  customId: string;
  options: readonly DiscordSelectOption[];
  placeholder?: string;
  minimumValues: number;
  maximumValues: number;
  disabled: boolean;
}>;

export type DiscordUserSelectComponent = Readonly<{
  kind: "user_select";
  customId: string;
  placeholder?: string;
  minimumValues: number;
  maximumValues: number;
  disabled: boolean;
}>;

export type DiscordMessageComponent =
  | DiscordButtonComponent
  | DiscordStringSelectComponent
  | DiscordUserSelectComponent;

export type DiscordMessageActionRow = Readonly<{
  kind: "message_action_row";
  components: readonly DiscordMessageComponent[];
}>;

export type DiscordTextInputComponent = Readonly<{
  kind: "text_input";
  customId: string;
  label: string;
  style: DiscordTextInputStyle;
  required: boolean;
  minimumLength?: number;
  maximumLength?: number;
  placeholder?: string;
  value?: string;
}>;

export type DiscordModalActionRow = Readonly<{
  kind: "modal_action_row";
  component: DiscordTextInputComponent;
}>;

export type DiscordModalPlan = Readonly<{
  customId: string;
  title: string;
  rows: readonly DiscordModalActionRow[];
}>;

const invalid = (summary: string): never => {
  throw new DiscordCoreError("DISCORD_PAYLOAD_REJECTED", summary, false);
};

const boundedText = (value: string, minimum: number, maximum: number, label: string): string => {
  if (
    typeof value !== "string" ||
    value.length < minimum ||
    value.length > maximum ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    invalid(`${label} is invalid.`);
  }
  return value;
};

export const discordCustomId = (value: string): string =>
  boundedText(value, 1, 100, "Discord component custom id");

const optionalText = (
  value: string | undefined,
  maximum: number,
  label: string,
): string | undefined =>
  value === undefined ? undefined : boundedText(value, 1, maximum, label);

const boundedCount = (value: number | undefined, fallback: number, maximum: number, label: string): number => {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < 0 || resolved > maximum) {
    invalid(`${label} is invalid.`);
  }
  return resolved;
};

const boundedPlainArray = <T>(
  value: readonly T[],
  minimum: number,
  maximum: number,
  label: string,
): readonly T[] => {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    return invalid(`${label} must be a plain array.`);
  }
  const length = value.length;
  if (!Number.isSafeInteger(length) || length < minimum || length > maximum) {
    return invalid(`${label} size is invalid.`);
  }
  const copy: T[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !("value" in descriptor)) {
      return invalid(`${label} must be dense and data-only.`);
    }
    copy.push(descriptor.value as T);
  }
  return Object.freeze(copy);
};

export const discordButton = (input: {
  readonly style: DiscordButtonStyle;
  readonly label?: string;
  readonly customId?: string;
  readonly url?: string;
  readonly emoji?: string;
  readonly disabled?: boolean;
}): DiscordButtonComponent => {
  const label = optionalText(input.label, 80, "Discord button label");
  const emoji = optionalText(input.emoji, 100, "Discord button emoji");
  if (label === undefined && emoji === undefined) invalid("Discord button requires a label or emoji.");
  if (input.style === "link") {
    const url = input.url;
    if (
      input.customId !== undefined ||
      typeof url !== "string" ||
      url.length > 512
    ) {
      invalid("Discord link button requires only an HTTPS URL.");
    }
    let parsed: URL;
    try {
      parsed = new URL(url as string);
    } catch {
      return invalid("Discord link button URL is invalid.");
    }
    const normalizedUrl = parsed.toString();
    if (
      parsed.protocol !== "https:" ||
      parsed.username.length > 0 ||
      parsed.password.length > 0 ||
      normalizedUrl.length > 512
    ) {
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
    customId: discordCustomId(customId as string),
    ...(emoji === undefined ? {} : { emoji }),
    disabled: input.disabled === true,
  });
};

export const discordSelectOption = (input: {
  readonly label: string;
  readonly value: string;
  readonly description?: string;
  readonly emoji?: string;
  readonly default?: boolean;
}): DiscordSelectOption => {
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

export const discordStringSelect = (input: {
  readonly customId: string;
  readonly options: readonly DiscordSelectOption[];
  readonly placeholder?: string;
  readonly minimumValues?: number;
  readonly maximumValues?: number;
  readonly disabled?: boolean;
}): DiscordStringSelectComponent => {
  const sourceOptions = boundedPlainArray(input.options, 1, 25, "Discord string select options");
  const values = new Set<string>();
  const options = sourceOptions.map((option) => {
    const projected = discordSelectOption(option);
    if (values.has(projected.value)) invalid("Discord select option values must be unique.");
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

export const discordUserSelect = (input: {
  readonly customId: string;
  readonly placeholder?: string;
  readonly minimumValues?: number;
  readonly maximumValues?: number;
  readonly disabled?: boolean;
}): DiscordUserSelectComponent => {
  const minimumValues = boundedCount(input.minimumValues, 1, 25, "Discord user select minimum");
  const maximumValues = boundedCount(input.maximumValues, 1, 25, "Discord user select maximum");
  if (minimumValues > maximumValues) invalid("Discord user select value bounds are inconsistent.");
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

export const discordMessageActionRow = (
  components: readonly DiscordMessageComponent[],
): DiscordMessageActionRow => {
  const sourceComponents = boundedPlainArray(components, 1, 5, "Discord action row components");
  if (
    Array.prototype.some.call(
      sourceComponents,
      (component: DiscordMessageComponent) => component.kind !== "button",
    ) &&
    sourceComponents.length !== 1
  ) {
    invalid("Discord select menus must occupy their own action row.");
  }
  return Object.freeze({ kind: "message_action_row", components: sourceComponents });
};

export const discordTextInput = (input: {
  readonly customId: string;
  readonly label: string;
  readonly style: DiscordTextInputStyle;
  readonly required?: boolean;
  readonly minimumLength?: number;
  readonly maximumLength?: number;
  readonly placeholder?: string;
  readonly value?: string;
}): DiscordTextInputComponent => {
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

export const discordModal = (input: {
  readonly customId: string;
  readonly title: string;
  readonly inputs: readonly DiscordTextInputComponent[];
}): DiscordModalPlan => {
  const inputs = boundedPlainArray(input.inputs, 1, 5, "Discord modal inputs");
  const ids = new Set<string>();
  const rows = inputs.map((component): DiscordModalActionRow => {
    if (ids.has(component.customId)) invalid("Discord modal input ids must be unique.");
    ids.add(component.customId);
    return Object.freeze({ kind: "modal_action_row", component });
  });
  return Object.freeze({
    customId: discordCustomId(input.customId),
    title: boundedText(input.title, 1, 45, "Discord modal title"),
    rows: Object.freeze(rows),
  });
};
