import type { DiscordInteractionBase } from "../interactions.js";
import { escapeDiscordMarkdownLiteral as escapeUntrustedEmbedText } from "../markdown.js";
import type { EmbedPresentationContext } from "./EmbedPlan.js";
const optionalUrl = (value: string | null): string | undefined => {
  if (value === null || value.trim().length === 0) {
    return undefined;
  }
  return value;
};

export const discordPresentationContext = (
  interaction: DiscordInteractionBase,
  locale: "it" | "en"
): EmbedPresentationContext => {
  const requesterAvatarUrl = optionalUrl(interaction.user.avatarUrl);
  const guildIconUrl = optionalUrl(interaction.guild?.iconUrl ?? null);
  const botAvatarUrl = optionalUrl(interaction.bot.avatarUrl);

  return Object.freeze({
    locale,
    requester: Object.freeze({
      displayName: escapeUntrustedEmbedText(
        interaction.user.globalName ?? interaction.user.username
      ),
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
      displayName: escapeUntrustedEmbedText(
        interaction.bot.globalName ?? interaction.bot.username
      ),
      ...(botAvatarUrl === undefined ? {} : { avatarUrl: botAvatarUrl })
    })
  });
};

