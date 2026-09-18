import {
  EMBED_LIMITS,
  calculateEmbedTextLength,
  validateEmbedPlan,
  type EmbedPlan,
} from "../vendor/dynamic-embed-engine/dist/index.js";

import {
  discordButton,
  discordMessageActionRow,
  discordSelectOption,
  discordStringSelect,
  discordUserSelect,
  type DiscordButtonComponent,
  type DiscordButtonStyle,
  type DiscordMessageActionRow,
  type DiscordMessageComponent,
  type DiscordSelectOption,
  type DiscordStringSelectComponent,
  type DiscordUserSelectComponent,
} from "./components.js";
import { DiscordCoreError } from "./errors.js";
import { deterministicDiscordNonce, parseDiscordSnowflake } from "./identifiers.js";

export interface DiscordApiEmbed {
  readonly color: number;
  readonly title?: string;
  readonly description?: string;
  readonly url?: string;
  readonly timestamp?: string;
  readonly author?: Readonly<{ name: string; url?: string; icon_url?: string }>;
  readonly footer?: Readonly<{ text: string; icon_url?: string }>;
  readonly thumbnail?: Readonly<{ url: string }>;
  readonly image?: Readonly<{ url: string }>;
  readonly fields?: readonly Readonly<{ name: string; value: string; inline: boolean }>[];
}

export interface DiscordAllowedMentionsInput {
  readonly users?: readonly string[];
  readonly roles?: readonly string[];
  readonly repliedUser?: boolean;
}

export type DiscordMessageFileAttachment = Readonly<{
  name: string;
  data: Uint8Array;
  contentType?: string;
  description?: string;
}>;

/** Provider-neutral message requested by a bot product. */
export interface DiscordMessagePlan {
  readonly content?: string;
  readonly embeds?: readonly EmbedPlan[];
  readonly components?: readonly DiscordMessageActionRow[];
  readonly allowedMentions?: DiscordAllowedMentionsInput;
  readonly files?: readonly DiscordMessageFileAttachment[];
}

/** Delivery-scoped message input used to derive a deterministic provider nonce. */
export interface SafeDiscordMessageInput extends DiscordMessagePlan {
  readonly deliveryId: string;
}

export type DiscordApiMessageComponent = Readonly<Record<string, unknown>>;

export type DiscordApiMessageActionRow = Readonly<{
  type: 1;
  components: readonly DiscordApiMessageComponent[];
}>;

export interface SafeDiscordMessagePayload {
  readonly content?: string;
  readonly embeds?: readonly DiscordApiEmbed[];
  readonly components?: readonly DiscordApiMessageActionRow[];
  readonly nonce: string;
  readonly enforce_nonce: true;
  readonly allowed_mentions: Readonly<{
    parse: readonly [];
    users: readonly string[];
    roles: readonly string[];
    replied_user: boolean;
  }>;
}

const rejected = (summary: string): never => {
  throw new DiscordCoreError("DISCORD_PAYLOAD_REJECTED", summary, false);
};

const boundedDataArray = <T>(
  value: readonly T[],
  minimum: number,
  maximum: number,
  label: string,
): readonly T[] => {
  if (
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    value.length < minimum ||
    value.length > maximum
  ) {
    return rejected(`${label} is invalid.`);
  }
  const result: T[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !("value" in descriptor)) {
      return rejected(`${label} must be a dense data array.`);
    }
    result.push(descriptor.value as T);
  }
  return Object.freeze(result);
};

const dataRecord = (value: unknown, label: string): Readonly<Record<string, unknown>> => {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return rejected(`${label} must be a plain data object.`);
  }
  return value as Readonly<Record<string, unknown>>;
};

const dataValue = (
  record: Readonly<Record<string, unknown>>,
  key: string,
  label: string,
  required = false,
): unknown => {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (descriptor === undefined) {
    return required ? rejected(`${label} is missing.`) : undefined;
  }
  return "value" in descriptor ? descriptor.value : rejected(`${label} must be data-only.`);
};

const requiredBoolean = (
  record: Readonly<Record<string, unknown>>,
  key: string,
  label: string,
): boolean => {
  const value = dataValue(record, key, label, true);
  return typeof value === "boolean" ? value : rejected(`${label} is invalid.`);
};

const optionalString = (
  record: Readonly<Record<string, unknown>>,
  key: string,
  label: string,
): string | undefined => {
  const value = dataValue(record, key, label);
  return value === undefined
    ? undefined
    : typeof value === "string"
      ? value
      : rejected(`${label} is invalid.`);
};

const normalizeSelectOption = (value: unknown): DiscordSelectOption => {
  const record = dataRecord(value, "Discord select option");
  const label = dataValue(record, "label", "Discord select option label", true);
  const optionValue = dataValue(record, "value", "Discord select option value", true);
  if (typeof label !== "string" || typeof optionValue !== "string") {
    return rejected("Discord select option label and value must be strings.");
  }
  const description = optionalString(record, "description", "Discord select option description");
  const emoji = optionalString(record, "emoji", "Discord select option emoji");
  return discordSelectOption({
    label,
    value: optionValue,
    ...(description === undefined ? {} : { description }),
    ...(emoji === undefined ? {} : { emoji }),
    default: requiredBoolean(record, "default", "Discord select option default"),
  });
};

const normalizeButton = (
  record: Readonly<Record<string, unknown>>,
): DiscordButtonComponent => {
  const style = dataValue(record, "style", "Discord button style", true);
  if (
    style !== "primary" &&
    style !== "secondary" &&
    style !== "success" &&
    style !== "danger" &&
    style !== "link"
  ) {
    return rejected("Discord button style is invalid.");
  }
  const label = optionalString(record, "label", "Discord button label");
  const customId = optionalString(record, "customId", "Discord button custom id");
  const url = optionalString(record, "url", "Discord button URL");
  const emoji = optionalString(record, "emoji", "Discord button emoji");
  return discordButton({
    style,
    ...(label === undefined ? {} : { label }),
    ...(customId === undefined ? {} : { customId }),
    ...(url === undefined ? {} : { url }),
    ...(emoji === undefined ? {} : { emoji }),
    disabled: requiredBoolean(record, "disabled", "Discord button disabled state"),
  });
};

const normalizeStringSelect = (
  record: Readonly<Record<string, unknown>>,
): DiscordStringSelectComponent => {
  const customId = dataValue(record, "customId", "Discord string select custom id", true);
  const options = dataValue(record, "options", "Discord string select options", true);
  if (typeof customId !== "string" || !Array.isArray(options)) {
    return rejected("Discord string select shape is invalid.");
  }
  const placeholder = optionalString(record, "placeholder", "Discord string select placeholder");
  return discordStringSelect({
    customId,
    options: boundedDataArray(options, 1, 25, "Discord string select options").map(
      normalizeSelectOption,
    ),
    ...(placeholder === undefined ? {} : { placeholder }),
    minimumValues: dataValue(
      record,
      "minimumValues",
      "Discord string select minimum",
      true,
    ) as number,
    maximumValues: dataValue(
      record,
      "maximumValues",
      "Discord string select maximum",
      true,
    ) as number,
    disabled: requiredBoolean(record, "disabled", "Discord string select disabled state"),
  });
};

const normalizeUserSelect = (
  record: Readonly<Record<string, unknown>>,
): DiscordUserSelectComponent => {
  const customId = dataValue(record, "customId", "Discord user select custom id", true);
  if (typeof customId !== "string") return rejected("Discord user select custom id is invalid.");
  const placeholder = optionalString(record, "placeholder", "Discord user select placeholder");
  return discordUserSelect({
    customId,
    ...(placeholder === undefined ? {} : { placeholder }),
    minimumValues: dataValue(
      record,
      "minimumValues",
      "Discord user select minimum",
      true,
    ) as number,
    maximumValues: dataValue(
      record,
      "maximumValues",
      "Discord user select maximum",
      true,
    ) as number,
    disabled: requiredBoolean(record, "disabled", "Discord user select disabled state"),
  });
};

const normalizeMessageComponent = (value: unknown): DiscordMessageComponent => {
  const record = dataRecord(value, "Discord message component");
  switch (dataValue(record, "kind", "Discord message component kind", true)) {
    case "button":
      return normalizeButton(record);
    case "string_select":
      return normalizeStringSelect(record);
    case "user_select":
      return normalizeUserSelect(record);
    default:
      return rejected("Discord message component kind is invalid.");
  }
};

const BUTTON_STYLES: Readonly<Record<DiscordButtonStyle, number>> = Object.freeze({
  primary: 1,
  secondary: 2,
  success: 3,
  danger: 4,
  link: 5,
});

const encodeEmoji = (emoji: string | undefined): Readonly<{ name: string }> | undefined =>
  emoji === undefined ? undefined : Object.freeze({ name: emoji });

const encodeMessageComponent = (
  component: DiscordMessageComponent,
): DiscordApiMessageComponent => {
  switch (component.kind) {
    case "button":
      return Object.freeze({
        type: 2,
        style: BUTTON_STYLES[component.style],
        ...(component.label === undefined ? {} : { label: component.label }),
        ...(component.customId === undefined ? {} : { custom_id: component.customId }),
        ...(component.url === undefined ? {} : { url: component.url }),
        ...(encodeEmoji(component.emoji) === undefined
          ? {}
          : { emoji: encodeEmoji(component.emoji) }),
        disabled: component.disabled,
      });
    case "string_select":
      return Object.freeze({
        type: 3,
        custom_id: component.customId,
        options: Object.freeze(
          component.options.map((option) =>
            Object.freeze({
              label: option.label,
              value: option.value,
              ...(option.description === undefined ? {} : { description: option.description }),
              ...(encodeEmoji(option.emoji) === undefined
                ? {}
                : { emoji: encodeEmoji(option.emoji) }),
              default: option.default,
            }),
          ),
        ),
        ...(component.placeholder === undefined ? {} : { placeholder: component.placeholder }),
        min_values: component.minimumValues,
        max_values: component.maximumValues,
        disabled: component.disabled,
      });
    case "user_select":
      return Object.freeze({
        type: 5,
        custom_id: component.customId,
        ...(component.placeholder === undefined ? {} : { placeholder: component.placeholder }),
        min_values: component.minimumValues,
        max_values: component.maximumValues,
        disabled: component.disabled,
      });
  }
};

/** Revalidates and encodes message action rows without exposing the provider SDK. */
export const encodeSafeDiscordActionRows = (
  rows: readonly DiscordMessageActionRow[] | undefined,
): readonly DiscordApiMessageActionRow[] | undefined => {
  if (rows === undefined) return undefined;
  return Object.freeze(
    boundedDataArray(rows, 0, 5, "Discord action rows").map((row) => {
      const record = dataRecord(row, "Discord action row");
      if (dataValue(record, "kind", "Discord action row kind", true) !== "message_action_row") {
        return rejected("Discord action row kind is invalid.");
      }
      const components = dataValue(record, "components", "Discord action row components", true);
      if (!Array.isArray(components)) return rejected("Discord action row components are invalid.");
      const safeRow = discordMessageActionRow(
        boundedDataArray(components, 1, 5, "Discord action row components").map(
          normalizeMessageComponent,
        ),
      );
      return Object.freeze({
        type: 1 as const,
        components: Object.freeze(safeRow.components.map(encodeMessageComponent)),
      });
    }),
  );
};

const uniqueSnowflakes = (values: readonly string[] | undefined, label: string): readonly string[] => {
  if (values === undefined) return Object.freeze([]);
  if (!Array.isArray(values) || Object.getPrototypeOf(values) !== Array.prototype || values.length > 100) {
    throw new DiscordCoreError(
      "DISCORD_PAYLOAD_REJECTED",
      `${label} exceeds the Discord mention allowlist limit.`,
      false,
    );
  }
  const normalized: string[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(values, String(index));
    if (descriptor === undefined || !("value" in descriptor) || typeof descriptor.value !== "string") {
      throw new DiscordCoreError(
        "DISCORD_PAYLOAD_REJECTED",
        `${label} must be a dense string array.`,
        false,
      );
    }
    normalized.push(parseDiscordSnowflake(descriptor.value, label));
  }
  return Object.freeze([...new Set(normalized)]);
};

export const encodeDiscordApiEmbed = (input: EmbedPlan): DiscordApiEmbed => {
  const plan = validateEmbedPlan(input);
  return Object.freeze({
    color: plan.color,
    ...(plan.title === undefined ? {} : { title: plan.title }),
    ...(plan.description === undefined ? {} : { description: plan.description }),
    ...(plan.url === undefined ? {} : { url: plan.url }),
    ...(plan.timestamp === undefined ? {} : { timestamp: plan.timestamp }),
    ...(plan.author === undefined
      ? {}
      : {
          author: Object.freeze({
            name: plan.author.name,
            ...(plan.author.url === undefined ? {} : { url: plan.author.url }),
            ...(plan.author.iconUrl === undefined ? {} : { icon_url: plan.author.iconUrl }),
          }),
        }),
    ...(plan.footer === undefined
      ? {}
      : {
          footer: Object.freeze({
            text: plan.footer.text,
            ...(plan.footer.iconUrl === undefined ? {} : { icon_url: plan.footer.iconUrl }),
          }),
        }),
    ...(plan.thumbnailUrl === undefined
      ? {}
      : { thumbnail: Object.freeze({ url: plan.thumbnailUrl }) }),
    ...(plan.imageUrl === undefined ? {} : { image: Object.freeze({ url: plan.imageUrl }) }),
    ...(plan.fields.length === 0
      ? {}
      : {
          fields: Object.freeze(
            plan.fields.map((field) =>
              Object.freeze({ name: field.name, value: field.value, inline: field.inline }),
            ),
          ),
        }),
  });
};

export const encodeSafeDiscordEmbeds = (
  requestedEmbeds: readonly EmbedPlan[] | undefined,
): readonly DiscordApiEmbed[] => {
  const source = requestedEmbeds ?? [];
  if (
    !Array.isArray(source) ||
    Object.getPrototypeOf(source) !== Array.prototype ||
    source.length > 10
  ) {
    throw new DiscordCoreError(
      "DISCORD_PAYLOAD_REJECTED",
      "Discord message embed limit exceeded.",
      false,
    );
  }
  const embeds: EmbedPlan[] = [];
  for (let index = 0; index < source.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(source, String(index));
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new DiscordCoreError(
        "DISCORD_PAYLOAD_REJECTED",
        "Discord message embeds must be a dense data array.",
        false,
      );
    }
    embeds.push(validateEmbedPlan(descriptor.value));
  }
  const aggregateEmbedText = embeds.reduce(
    (total, embed) => total + calculateEmbedTextLength(embed),
    0,
  );
  if (aggregateEmbedText > EMBED_LIMITS.totalText) {
    throw new DiscordCoreError(
      "DISCORD_PAYLOAD_REJECTED",
      "Discord message aggregate embed text limit exceeded.",
      false,
    );
  }
  return Object.freeze(embeds.map((embed) => encodeDiscordApiEmbed(embed)));
};

export const createSafeDiscordMessage = (
  input: SafeDiscordMessageInput,
  destinationId: string,
): SafeDiscordMessagePayload => {
  const content = input.content;
  if (
    content !== undefined &&
    (typeof content !== "string" || content.length < 1 || content.length > 2_000)
  ) {
    throw new DiscordCoreError(
      "DISCORD_PAYLOAD_REJECTED",
      "Discord message content must contain between 1 and 2000 characters.",
      false,
    );
  }
  const embeds = encodeSafeDiscordEmbeds(input.embeds);
  const components = encodeSafeDiscordActionRows(input.components);
  const hasFiles = Array.isArray(input.files) && input.files.length > 0;
  if (content === undefined && embeds.length === 0 && (components?.length ?? 0) === 0 && !hasFiles) {
    throw new DiscordCoreError(
      "DISCORD_PAYLOAD_REJECTED",
      "Discord message requires content, an embed, a component or an attachment.",
      false,
    );
  }

  const users = uniqueSnowflakes(input.allowedMentions?.users, "allowed mention user");
  const roles = uniqueSnowflakes(input.allowedMentions?.roles, "allowed mention role");
  return Object.freeze({
    ...(content === undefined ? {} : { content }),
    ...(embeds.length === 0
      ? {}
      : { embeds }),
    ...(components === undefined ? {} : { components }),
    nonce: deterministicDiscordNonce(input.deliveryId, destinationId),
    enforce_nonce: true,
    allowed_mentions: Object.freeze({
      parse: Object.freeze([]) as readonly [],
      users,
      roles,
      replied_user: input.allowedMentions?.repliedUser === true,
    }),
  });
};
