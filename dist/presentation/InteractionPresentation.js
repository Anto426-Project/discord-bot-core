import { escapeDiscordMarkdownLiteral as escapeUntrustedEmbedText } from "../markdown.js";
const optionalUrl = (value) => {
    if (value === null || value.trim().length === 0) {
        return undefined;
    }
    return value;
};
export const discordPresentationContext = (interaction, locale) => {
    const requesterAvatarUrl = optionalUrl(interaction.user.avatarUrl);
    const guildIconUrl = optionalUrl(interaction.guild?.iconUrl ?? null);
    const botAvatarUrl = optionalUrl(interaction.bot.avatarUrl);
    return Object.freeze({
        locale,
        requester: Object.freeze({
            displayName: escapeUntrustedEmbedText(interaction.user.globalName ?? interaction.user.username),
            ...(requesterAvatarUrl === undefined
                ? {}
                : { avatarUrl: requesterAvatarUrl })
        }),
        ...(interaction.guild === null
            ? {}
            : {
                guild: Object.freeze({
                    displayName: escapeUntrustedEmbedText(interaction.guild.name),
                    ...(guildIconUrl === undefined ? {} : { iconUrl: guildIconUrl })
                })
            }),
        bot: Object.freeze({
            displayName: escapeUntrustedEmbedText(interaction.bot.globalName ?? interaction.bot.username),
            ...(botAvatarUrl === undefined ? {} : { avatarUrl: botAvatarUrl })
        })
    });
};
//# sourceMappingURL=InteractionPresentation.js.map