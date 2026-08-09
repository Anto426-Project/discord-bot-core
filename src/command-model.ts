import { DiscordCoreError } from "./errors.js";
import { parseStableBotKey } from "./identifiers.js";

export type SupportedCommandLocale = "it" | "en";
export type LocalizedCommandText = Readonly<Record<SupportedCommandLocale, string>>;

export type CommandPermission =
  | "administrator"
  | "ban_members"
  | "kick_members"
  | "manage_channels"
  | "manage_guild"
  | "manage_messages"
  | "manage_roles"
  | "moderate_members"
  | "view_audit_log";

export type CommandChannelKind =
  | "announcement"
  | "category"
  | "forum"
  | "media"
  | "stage"
  | "text"
  | "thread"
  | "voice";

export type LocalizedCommandChoice<TValue extends string | number> = Readonly<{
  name: LocalizedCommandText;
  value: TValue;
}>;

export type CommandCompletion<TValue extends string | number> =
  | Readonly<{ kind: "autocomplete" }>
  | Readonly<{ kind: "choices"; values: readonly LocalizedCommandChoice<TValue>[] }>;

type CommandOptionBase = Readonly<{
  name: LocalizedCommandText;
  description: LocalizedCommandText;
  required: boolean;
}>;

export type StringCommandOption = CommandOptionBase &
  Readonly<{
    kind: "string";
    completion?: CommandCompletion<string>;
    minLength?: number;
    maxLength?: number;
  }>;

export type IntegerCommandOption = CommandOptionBase &
  Readonly<{
    kind: "integer";
    completion?: CommandCompletion<number>;
    minValue?: number;
    maxValue?: number;
  }>;

export type NumberCommandOption = CommandOptionBase &
  Readonly<{
    kind: "number";
    completion?: CommandCompletion<number>;
    minValue?: number;
    maxValue?: number;
  }>;

export type ChannelCommandOption = CommandOptionBase &
  Readonly<{ kind: "channel"; allowedChannelKinds: readonly CommandChannelKind[] }>;

export type SimpleCommandOption = CommandOptionBase &
  Readonly<{ kind: "attachment" | "boolean" | "mentionable" | "role" | "user" }>;

export type BasicCommandOption =
  | ChannelCommandOption
  | IntegerCommandOption
  | NumberCommandOption
  | SimpleCommandOption
  | StringCommandOption;

export type SubcommandOption = Readonly<{
  kind: "subcommand";
  name: LocalizedCommandText;
  description: LocalizedCommandText;
  options: readonly BasicCommandOption[];
}>;

export type SubcommandGroupOption = Readonly<{
  kind: "subcommand_group";
  name: LocalizedCommandText;
  description: LocalizedCommandText;
  options: readonly SubcommandOption[];
}>;

export type CommandOption = BasicCommandOption | SubcommandGroupOption | SubcommandOption;

export type ChatInputCommandPlan = Readonly<{
  key: string;
  name: LocalizedCommandText;
  description: LocalizedCommandText;
  options: readonly CommandOption[];
  allowInDirectMessages: boolean;
  defaultMemberPermissions: readonly CommandPermission[] | null;
}>;

export type DiscordApplicationCommandPlacement = "global" | "guild";

export type DiscordApplicationCommandBody = Readonly<{
  name: string;
  name_localizations: Readonly<Record<string, string>>;
  description: string;
  description_localizations: Readonly<Record<string, string>>;
  type: 1;
  options: readonly Readonly<Record<string, unknown>>[];
  dm_permission?: boolean;
  contexts?: readonly number[];
  integration_types?: readonly number[];
  default_member_permissions: string | null;
}>;

const OPTION_TYPES = Object.freeze({
  subcommand: 1,
  subcommand_group: 2,
  string: 3,
  integer: 4,
  boolean: 5,
  user: 6,
  channel: 7,
  role: 8,
  mentionable: 9,
  number: 10,
  attachment: 11,
} as const);

const CHANNEL_TYPES: Readonly<Record<CommandChannelKind, readonly number[]>> = Object.freeze({
  announcement: Object.freeze([5]),
  category: Object.freeze([4]),
  forum: Object.freeze([15]),
  media: Object.freeze([16]),
  stage: Object.freeze([13]),
  text: Object.freeze([0]),
  thread: Object.freeze([10, 11, 12]),
  voice: Object.freeze([2]),
});

const PERMISSION_BITS: Readonly<Record<CommandPermission, bigint>> = Object.freeze({
  administrator: 1n << 3n,
  ban_members: 1n << 2n,
  kick_members: 1n << 1n,
  manage_channels: 1n << 4n,
  manage_guild: 1n << 5n,
  manage_messages: 1n << 13n,
  manage_roles: 1n << 28n,
  moderate_members: 1n << 40n,
  view_audit_log: 1n << 7n,
});

const COMMAND_NAME_PATTERN = /^[-_'\p{L}\p{N}\p{sc=Devanagari}\p{sc=Thai}]{1,32}$/u;

const invalid = (summary: string): never => {
  throw new DiscordCoreError("DISCORD_INVALID_INPUT", summary, false);
};

export const assertDiscordApplicationCommandName = (
  value: string,
  label = "Discord command name",
): string => {
  if (!COMMAND_NAME_PATTERN.test(value) || value !== value.toLocaleLowerCase()) {
    invalid(`${label} is invalid.`);
  }
  return value;
};

const localizedBase = (
  name: LocalizedCommandText,
  description: LocalizedCommandText,
  label: string,
): Readonly<Record<string, unknown>> => {
  for (const [locale, text] of Object.entries(name)) {
    assertDiscordApplicationCommandName(text, `${label} ${locale} name`);
  }
  for (const [locale, text] of Object.entries(description)) {
    if (text.length < 1 || text.length > 100) {
      invalid(`${label} has an invalid ${locale} description.`);
    }
  }
  return Object.freeze({
    name: name.en,
    name_localizations: Object.freeze({ it: name.it, "en-US": name.en }),
    description: description.en,
    description_localizations: Object.freeze({ it: description.it, "en-US": description.en }),
  });
};

const mapCompletion = <TValue extends string | number>(
  completion: CommandCompletion<TValue> | undefined,
  valueKind: "string" | "integer" | "number",
): Readonly<Record<string, unknown>> => {
  if (completion === undefined) return Object.freeze({});
  if (completion.kind === "autocomplete") return Object.freeze({ autocomplete: true });
  if (completion.values.length < 1 || completion.values.length > 25) {
    invalid("Discord command choices must contain between 1 and 25 entries.");
  }
  const seenNames = new Set<string>();
  const seenValues = new Set<string>();
  return Object.freeze({
    autocomplete: false,
    choices: Object.freeze(
      completion.values.map((choice) => {
        for (const value of new Set(Object.values(choice.name))) {
          if (value.length < 1 || value.length > 100) invalid("Discord choice name is invalid.");
          if (seenNames.has(value)) invalid("Discord choice names must be unique across localizations.");
          seenNames.add(value);
        }
        if (
          (valueKind === "string" && typeof choice.value !== "string") ||
          (valueKind !== "string" && typeof choice.value !== "number")
        ) {
          invalid("Discord choice value type does not match its option.");
        }
        if (typeof choice.value === "string" && (choice.value.length < 1 || choice.value.length > 100)) {
          invalid("Discord string choice value is invalid.");
        }
        if (
          typeof choice.value === "number" &&
          (!Number.isFinite(choice.value) || Math.abs(choice.value) > Number.MAX_SAFE_INTEGER)
        ) {
          invalid("Discord numeric choice value is outside the supported range.");
        }
        if (valueKind === "integer" && !Number.isSafeInteger(choice.value)) {
          invalid("Discord integer choice value must be a safe integer.");
        }
        const valueKey = `${typeof choice.value}:${String(choice.value)}`;
        if (seenValues.has(valueKey)) invalid("Discord choice values must be unique.");
        seenValues.add(valueKey);
        return Object.freeze({
          name: choice.name.en,
          name_localizations: Object.freeze({ it: choice.name.it, "en-US": choice.name.en }),
          value: choice.value,
        });
      }),
    ),
  });
};

const localizedLength = (value: LocalizedCommandText): number =>
  Math.max(value.it.length, value.en.length);

const completionTextLength = (
  completion: CommandCompletion<string | number> | undefined,
): number =>
  completion?.kind === "choices"
    ? completion.values.reduce(
        (total, choice) =>
          total +
          localizedLength(choice.name) +
          (typeof choice.value === "string" ? choice.value.length : 0),
        0,
      )
    : 0;

const optionTextLength = (option: CommandOption): number => {
  const own = localizedLength(option.name) + localizedLength(option.description);
  switch (option.kind) {
    case "subcommand_group":
      return own + option.options.reduce((total, child) => total + optionTextLength(child), 0);
    case "subcommand":
      return own + option.options.reduce((total, child) => total + optionTextLength(child), 0);
    case "string":
    case "integer":
    case "number":
      return own + completionTextLength(option.completion as CommandCompletion<string | number> | undefined);
    default:
      return own;
  }
};

const assertRange = (
  minimum: number | undefined,
  maximum: number | undefined,
  label: string,
  integer: boolean,
): void => {
  if (
    minimum !== undefined &&
    (!Number.isFinite(minimum) ||
      Math.abs(minimum) > Number.MAX_SAFE_INTEGER ||
      (integer && !Number.isSafeInteger(minimum)))
  ) {
    invalid(`${label} minimum is invalid.`);
  }
  if (
    maximum !== undefined &&
    (!Number.isFinite(maximum) ||
      Math.abs(maximum) > Number.MAX_SAFE_INTEGER ||
      (integer && !Number.isSafeInteger(maximum)))
  ) {
    invalid(`${label} maximum is invalid.`);
  }
  if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
    invalid(`${label} minimum cannot exceed maximum.`);
  }
};

const mapBasicOption = (option: BasicCommandOption): Readonly<Record<string, unknown>> => {
  const base = { ...localizedBase(option.name, option.description, "Command option"), required: option.required };
  switch (option.kind) {
    case "attachment":
    case "boolean":
    case "mentionable":
    case "role":
    case "user":
      return Object.freeze({ ...base, type: OPTION_TYPES[option.kind] });
    case "channel": {
      if (option.allowedChannelKinds.length < 1) invalid("Channel option requires an allowed kind.");
      const channelTypes = new Set<number>();
      for (const kind of option.allowedChannelKinds) {
        for (const type of CHANNEL_TYPES[kind]) channelTypes.add(type);
      }
      return Object.freeze({ ...base, type: OPTION_TYPES.channel, channel_types: Object.freeze([...channelTypes]) });
    }
    case "integer":
    case "number": {
      assertRange(option.minValue, option.maxValue, option.kind, option.kind === "integer");
      return Object.freeze({
        ...base,
        type: OPTION_TYPES[option.kind],
        ...mapCompletion(option.completion, option.kind),
        ...(option.minValue === undefined ? {} : { min_value: option.minValue }),
        ...(option.maxValue === undefined ? {} : { max_value: option.maxValue }),
      });
    }
    case "string": {
      assertRange(option.minLength, option.maxLength, "string length", true);
      if (
        (option.minLength !== undefined && (option.minLength < 0 || option.minLength > 6_000)) ||
        (option.maxLength !== undefined && (option.maxLength < 1 || option.maxLength > 6_000))
      ) {
        invalid("Discord string length constraint is invalid.");
      }
      return Object.freeze({
        ...base,
        type: OPTION_TYPES.string,
        ...mapCompletion(option.completion, "string"),
        ...(option.minLength === undefined ? {} : { min_length: option.minLength }),
        ...(option.maxLength === undefined ? {} : { max_length: option.maxLength }),
      });
    }
  }
};

const assertUniqueSiblingOptions = (
  options: readonly CommandOption[] | readonly BasicCommandOption[] | readonly SubcommandOption[],
  label: string,
): void => {
  const names = new Set<string>();
  let optionalSeen = false;
  for (const option of options) {
    const ownNames = new Set(Object.values(option.name));
    for (const name of ownNames) {
      if (names.has(name)) invalid(`${label} contains duplicate option names across localizations.`);
    }
    for (const name of ownNames) {
      names.add(name);
    }
    if ("required" in option) {
      if (!option.required) optionalSeen = true;
      if (option.required && optionalSeen) {
        invalid(`${label} must place required options before optional options.`);
      }
    }
  }
};

const mapSubcommand = (option: SubcommandOption): Readonly<Record<string, unknown>> => {
  if (option.options.length > 25) invalid("Discord subcommand option limit exceeded.");
  assertUniqueSiblingOptions(option.options, "Subcommand");
  return Object.freeze({
    ...localizedBase(option.name, option.description, "Subcommand"),
    type: OPTION_TYPES.subcommand,
    options: Object.freeze(option.options.map(mapBasicOption)),
  });
};

const mapOption = (option: CommandOption): Readonly<Record<string, unknown>> => {
  if (option.kind === "subcommand") return mapSubcommand(option);
  if (option.kind === "subcommand_group") {
    if (option.options.length < 1 || option.options.length > 25) {
      invalid("Discord subcommand group size is invalid.");
    }
    assertUniqueSiblingOptions(option.options, "Subcommand group");
    return Object.freeze({
      ...localizedBase(option.name, option.description, "Subcommand group"),
      type: OPTION_TYPES.subcommand_group,
      options: Object.freeze(option.options.map(mapSubcommand)),
    });
  }
  return mapBasicOption(option);
};

const mapPermissions = (permissions: readonly CommandPermission[] | null): string | null => {
  if (permissions === null) return null;
  let result = 0n;
  for (const permission of new Set(permissions)) result |= PERMISSION_BITS[permission];
  return result.toString();
};

export const toDiscordApplicationCommand = (
  command: ChatInputCommandPlan,
  placement: DiscordApplicationCommandPlacement,
): DiscordApplicationCommandBody => {
  parseStableBotKey(command.key, "command key");
  if (command.options.length > 25) invalid("Discord command option limit exceeded.");
  assertUniqueSiblingOptions(command.options, "Command");
  const textBudget =
    localizedLength(command.name) +
    localizedLength(command.description) +
    command.options.reduce((total, option) => total + optionTextLength(option), 0);
  if (textBudget > 8_000) {
    invalid("Discord command text exceeds the aggregate 8000 character limit.");
  }
  const hasSubcommands = command.options.some(
    (option) => option.kind === "subcommand" || option.kind === "subcommand_group",
  );
  if (
    hasSubcommands &&
    command.options.some(
      (option) => option.kind !== "subcommand" && option.kind !== "subcommand_group",
    )
  ) {
    invalid("Discord basic options cannot be mixed with subcommands.");
  }
  return Object.freeze({
    ...localizedBase(command.name, command.description, "Command"),
    type: 1,
    options: Object.freeze(command.options.map(mapOption)),
    ...(placement === "global"
      ? {
          dm_permission: command.allowInDirectMessages,
          contexts: Object.freeze(command.allowInDirectMessages ? [0, 1] : [0]),
          integration_types: Object.freeze([0]),
        }
      : {}),
    default_member_permissions: mapPermissions(command.defaultMemberPermissions),
  }) as DiscordApplicationCommandBody;
};
