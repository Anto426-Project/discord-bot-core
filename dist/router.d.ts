export interface DiscordChatInputInteractionLike {
    readonly commandName: string;
}
export interface DiscordCommandBinding<TChatInput> {
    readonly commandName: string;
    handle(interaction: TChatInput, signal: AbortSignal): Promise<void>;
}
export interface DiscordInteractionBinding<TInteraction> {
    readonly id: string;
    handle(interaction: TInteraction, signal: AbortSignal): Promise<boolean>;
}
export interface DiscordIngressRouterOptions<TInteraction, TChatInput extends TInteraction & DiscordChatInputInteractionLike> {
    readonly commands: readonly DiscordCommandBinding<TChatInput>[];
    readonly interactions?: readonly DiscordInteractionBinding<TInteraction>[];
    readonly isChatInputCommand: (interaction: TInteraction) => interaction is TChatInput;
    readonly handlerTimeoutMs?: number;
}
export declare class DiscordIngressRouter<TInteraction, TChatInput extends TInteraction & DiscordChatInputInteractionLike> {
    private readonly options;
    private readonly commands;
    private readonly interactions;
    private readonly handlerTimeoutMs;
    constructor(options: DiscordIngressRouterOptions<TInteraction, TChatInput>);
    handle(interaction: TInteraction): Promise<boolean>;
}
//# sourceMappingURL=router.d.ts.map