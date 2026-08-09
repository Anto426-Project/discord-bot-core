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
export type DiscordMessageComponent = DiscordButtonComponent | DiscordStringSelectComponent | DiscordUserSelectComponent;
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
export declare const discordCustomId: (value: string) => string;
export declare const discordButton: (input: {
    readonly style: DiscordButtonStyle;
    readonly label?: string;
    readonly customId?: string;
    readonly url?: string;
    readonly emoji?: string;
    readonly disabled?: boolean;
}) => DiscordButtonComponent;
export declare const discordSelectOption: (input: {
    readonly label: string;
    readonly value: string;
    readonly description?: string;
    readonly emoji?: string;
    readonly default?: boolean;
}) => DiscordSelectOption;
export declare const discordStringSelect: (input: {
    readonly customId: string;
    readonly options: readonly DiscordSelectOption[];
    readonly placeholder?: string;
    readonly minimumValues?: number;
    readonly maximumValues?: number;
    readonly disabled?: boolean;
}) => DiscordStringSelectComponent;
export declare const discordUserSelect: (input: {
    readonly customId: string;
    readonly placeholder?: string;
    readonly minimumValues?: number;
    readonly maximumValues?: number;
    readonly disabled?: boolean;
}) => DiscordUserSelectComponent;
export declare const discordMessageActionRow: (components: readonly DiscordMessageComponent[]) => DiscordMessageActionRow;
export declare const discordTextInput: (input: {
    readonly customId: string;
    readonly label: string;
    readonly style: DiscordTextInputStyle;
    readonly required?: boolean;
    readonly minimumLength?: number;
    readonly maximumLength?: number;
    readonly placeholder?: string;
    readonly value?: string;
}) => DiscordTextInputComponent;
export declare const discordModal: (input: {
    readonly customId: string;
    readonly title: string;
    readonly inputs: readonly DiscordTextInputComponent[];
}) => DiscordModalPlan;
//# sourceMappingURL=components.d.ts.map