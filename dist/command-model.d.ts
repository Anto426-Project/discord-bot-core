export type SupportedCommandLocale = "it" | "en";
export type LocalizedCommandText = Readonly<Record<SupportedCommandLocale, string>>;
export type CommandPermission = "administrator" | "ban_members" | "kick_members" | "manage_channels" | "manage_guild" | "manage_messages" | "manage_roles" | "moderate_members" | "view_audit_log";
export type CommandChannelKind = "announcement" | "category" | "forum" | "media" | "stage" | "text" | "thread" | "voice";
export type LocalizedCommandChoice<TValue extends string | number> = Readonly<{
    name: LocalizedCommandText;
    value: TValue;
}>;
export type CommandCompletion<TValue extends string | number> = Readonly<{
    kind: "autocomplete";
}> | Readonly<{
    kind: "choices";
    values: readonly LocalizedCommandChoice<TValue>[];
}>;
type CommandOptionBase = Readonly<{
    name: LocalizedCommandText;
    description: LocalizedCommandText;
    required: boolean;
}>;
export type StringCommandOption = CommandOptionBase & Readonly<{
    kind: "string";
    completion?: CommandCompletion<string>;
    minLength?: number;
    maxLength?: number;
}>;
export type IntegerCommandOption = CommandOptionBase & Readonly<{
    kind: "integer";
    completion?: CommandCompletion<number>;
    minValue?: number;
    maxValue?: number;
}>;
export type NumberCommandOption = CommandOptionBase & Readonly<{
    kind: "number";
    completion?: CommandCompletion<number>;
    minValue?: number;
    maxValue?: number;
}>;
export type ChannelCommandOption = CommandOptionBase & Readonly<{
    kind: "channel";
    allowedChannelKinds: readonly CommandChannelKind[];
}>;
export type SimpleCommandOption = CommandOptionBase & Readonly<{
    kind: "attachment" | "boolean" | "mentionable" | "role" | "user";
}>;
export type BasicCommandOption = ChannelCommandOption | IntegerCommandOption | NumberCommandOption | SimpleCommandOption | StringCommandOption;
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
export declare const assertDiscordApplicationCommandName: (value: string, label?: string) => string;
export declare const toDiscordApplicationCommand: (command: ChatInputCommandPlan, placement: DiscordApplicationCommandPlacement) => DiscordApplicationCommandBody;
export {};
//# sourceMappingURL=command-model.d.ts.map