import {
  type MessageKey,
  type MessageTranslator
} from "./PresentationLocalization.js";

import {
  localizePresentationText,
  type EmbedAuthor,
  type EmbedPlan,
  type EmbedPresentationContext,
  type EmbedTheme,
  type LocalizedPresentationText,
  type PresentationLocale
} from "./EmbedPlan.js";
import {
  EmbedPlanBuilder,
  type EmbedPlanTransformer,
  type EmbedUrlPolicy
} from "./EmbedPlanBuilder.js";
import {
  resolveEmbedColor,
  type EmbedColorPolicy
} from "./EmbedDynamicColor.js";
import {
  resolveCommandEmbedField,
  type CommandEmbedField
} from "./CommandEmbedFields.js";
import { formatEmbedMarkup } from "./EmbedMarkupFormatter.js";

export interface LocalizedEmbedAuthor {
  readonly name: LocalizedPresentationText;
  readonly url?: string;
  readonly iconUrl?: string;
}

export type CommandEmbedAuthorPolicy =
  | { readonly source: "guild" }
  | { readonly source: "bot" }
  | {
      readonly source: "manual";
      readonly author: LocalizedEmbedAuthor;
    }
  | { readonly source: "none" };

export type CommandEmbedThumbnailPolicy =
  | { readonly source: "guild" }
  | { readonly source: "bot" }
  | { readonly source: "requester" }
  | { readonly source: "manual"; readonly url: string }
  | { readonly source: "none" };

export interface CommandEmbedThemeDecorationPolicy {
  readonly title: boolean;
  readonly description: boolean;
  readonly footer: boolean;
}

export interface CommandEmbedChromePolicy {
  readonly author: CommandEmbedAuthorPolicy;
  readonly thumbnail: CommandEmbedThumbnailPolicy;
  readonly requesterFooter: boolean;
  readonly botFooter: boolean;
  readonly footerPrefix?: LocalizedPresentationText;
  readonly themeBadge: CommandEmbedThemeDecorationPolicy;
  /**
   * No clock is read by presentation. Omit this value to omit the timestamp.
   */
  readonly timestamp?: Date;
}

export type CommandDescriptionFormat = "plain" | "markup";

export interface CommandEmbedContent {
  readonly title?: LocalizedPresentationText;
  readonly description?: LocalizedPresentationText;
  readonly descriptionFormat?: CommandDescriptionFormat;
  readonly fields?: readonly CommandEmbedField[];
  readonly imageUrl?: string;
  readonly url?: string;
}

export interface CreateCommandEmbedPlanInput {
  readonly context: EmbedPresentationContext;
  readonly content: CommandEmbedContent;
  readonly chrome: CommandEmbedChromePolicy;
  readonly color?: EmbedColorPolicy;
  readonly urlPolicy?: EmbedUrlPolicy;
  readonly transformers?: readonly EmbedPlanTransformer[];
}

export const COMMAND_EMBED_THEME_PRESENTATION: Readonly<
  Record<
    EmbedTheme,
    {
      readonly emoji: string;
      readonly labelKey: MessageKey;
    }
  >
> = Object.freeze({
  info: Object.freeze({
    emoji: "🔵",
    labelKey: "embed.theme.info"
  }),
  success: Object.freeze({
    emoji: "🟢",
    labelKey: "embed.theme.success"
  }),
  warning: Object.freeze({
    emoji: "🟡",
    labelKey: "embed.theme.warning"
  }),
  error: Object.freeze({
    emoji: "🔴",
    labelKey: "embed.theme.error"
  }),
  neutral: Object.freeze({
    emoji: "⚪",
    labelKey: "embed.theme.neutral"
  })
});

export interface CommandEmbedDefaults {
  readonly title: string;
  readonly description: string;
  readonly footer: string;
}

export const resolveCommandEmbedDefaults = (
  translator: MessageTranslator,
  locale: PresentationLocale
): CommandEmbedDefaults =>
  Object.freeze({
    title: translator.translate(locale, "embed.command.default_title"),
    description: translator.translate(
      locale,
      "embed.command.default_description"
    ),
    footer: translator.translate(locale, "embed.command.default_footer")
  });

export const commandEmbedChrome = (
  overrides: Partial<CommandEmbedChromePolicy> = {}
): CommandEmbedChromePolicy =>
  Object.freeze({
    author: Object.freeze({ source: "guild" }),
    thumbnail: Object.freeze({ source: "none" }),
    requesterFooter: true,
    botFooter: true,
    themeBadge: Object.freeze({
      title: false,
      description: false,
      footer: false
    }),
    ...overrides
  });

const authorFromPolicy = (
  policy: CommandEmbedAuthorPolicy,
  context: EmbedPresentationContext
): EmbedAuthor | undefined => {
  switch (policy.source) {
    case "guild":
      return context.guild === undefined
        ? undefined
        : {
            name: context.guild.displayName,
            ...(context.guild.websiteUrl === undefined
              ? {}
              : { url: context.guild.websiteUrl }),
            ...(context.guild.iconUrl === undefined
              ? {}
              : { iconUrl: context.guild.iconUrl })
          };
    case "bot":
      return context.bot === undefined
        ? undefined
        : {
            name: context.bot.displayName,
            ...(context.bot.websiteUrl === undefined
              ? {}
              : { url: context.bot.websiteUrl }),
            ...(context.bot.avatarUrl === undefined
              ? {}
              : { iconUrl: context.bot.avatarUrl })
          };
    case "manual":
      return {
        name: localizePresentationText(
          policy.author.name,
          context.locale
        ),
        ...(policy.author.url === undefined
          ? {}
          : { url: policy.author.url }),
        ...(policy.author.iconUrl === undefined
          ? {}
          : { iconUrl: policy.author.iconUrl })
      };
    case "none":
      return undefined;
  }
};

const thumbnailFromPolicy = (
  policy: CommandEmbedThumbnailPolicy,
  context: EmbedPresentationContext
): string | undefined => {
  switch (policy.source) {
    case "guild":
      return context.guild?.iconUrl;
    case "bot":
      return context.bot?.avatarUrl;
    case "requester":
      return context.requester?.avatarUrl;
    case "manual":
      return policy.url;
    case "none":
      return undefined;
  }
};

const requesterText = (
  displayName: string,
  locale: PresentationLocale,
  translator: MessageTranslator
): string =>
  translator.translate(locale, "embed.requester.footer", { displayName });

const themedTitle = (
  title: string,
  theme: EmbedTheme,
  enabled: boolean
): string =>
  enabled
    ? `${COMMAND_EMBED_THEME_PRESENTATION[theme].emoji} ┃ ${title}`
    : title;

const themeBadge = (
  theme: EmbedTheme,
  locale: PresentationLocale,
  translator: MessageTranslator
): string => {
  const presentation = COMMAND_EMBED_THEME_PRESENTATION[theme];
  return `${presentation.emoji} ${translator.translate(
    locale,
    presentation.labelKey
  )}`;
};

const themedDescription = (
  description: string,
  theme: EmbedTheme,
  locale: PresentationLocale,
  enabled: boolean,
  translator: MessageTranslator
): string =>
  enabled
    ? `> **${themeBadge(theme, locale, translator)}**${
        description.length === 0 ? "" : `\n${description}`
      }`
    : description;

/**
 * Footer precedence is stable and intentional:
 * localized prefix -> theme badge -> requester -> bot branding.
 * The first available icon is requester avatar -> bot avatar -> guild icon.
 * Missing author/thumbnail sources do not silently select another source.
 */
const footerFromPolicy = (
  policy: CommandEmbedChromePolicy,
  context: EmbedPresentationContext,
  theme: EmbedTheme,
  translator: MessageTranslator
): { readonly text: string; readonly iconUrl?: string } | undefined => {
  const parts: string[] = [];
  if (policy.footerPrefix !== undefined) {
    parts.push(localizePresentationText(policy.footerPrefix, context.locale));
  }
  if (policy.themeBadge.footer) {
    parts.push(themeBadge(theme, context.locale, translator));
  }
  if (policy.requesterFooter && context.requester !== undefined) {
    parts.push(
      requesterText(
        context.requester.displayName,
        context.locale,
        translator
      )
    );
  }
  if (policy.botFooter && context.bot?.footerText !== undefined) {
    parts.push(
      localizePresentationText(context.bot.footerText, context.locale)
    );
  }

  const nonEmptyParts = parts.filter((part) => part.trim().length > 0);
  if (nonEmptyParts.length === 0) {
    return undefined;
  }

  const iconUrl =
    (policy.requesterFooter ? context.requester?.avatarUrl : undefined) ??
    (policy.botFooter ? context.bot?.avatarUrl : undefined) ??
    context.guild?.iconUrl;

  return {
    text: nonEmptyParts.join(" ┃ "),
    ...(iconUrl === undefined ? {} : { iconUrl })
  };
};

const applyCommandContent = (
  builder: EmbedPlanBuilder,
  theme: EmbedTheme,
  input: CreateCommandEmbedPlanInput,
  translator: MessageTranslator
): EmbedPlanBuilder => {
  const { locale } = input.context;
  const { content, chrome } = input;
  let next = builder;

  if (content.title !== undefined) {
    next = next.title(
      themedTitle(
        localizePresentationText(content.title, locale),
        theme,
        chrome.themeBadge.title
      )
    );
  }

  if (content.description !== undefined) {
    const localized = localizePresentationText(
      content.description,
      locale
    );
    const formatted =
      content.descriptionFormat === "markup"
        ? formatEmbedMarkup(localized)
        : localized;
    next = next.description(
      themedDescription(
        formatted,
        theme,
        locale,
        chrome.themeBadge.description,
        translator
      )
    );
  }

  for (const field of content.fields ?? []) {
    const resolved = resolveCommandEmbedField(field, locale);
    next = next.field(resolved.name, resolved.value, resolved.inline);
  }

  if (content.url !== undefined) {
    next = next.url(content.url);
  }
  if (content.imageUrl !== undefined) {
    next = next.image(content.imageUrl);
  }

  return next;
};

const createCommandEmbedPlan = (
  theme: EmbedTheme,
  input: CreateCommandEmbedPlanInput,
  translator: MessageTranslator
): EmbedPlan => {
  let builder = applyCommandContent(
    EmbedPlanBuilder.create(theme, {
      locale: input.context.locale,
      translator,
      ...(input.urlPolicy === undefined
        ? {}
        : { urlPolicy: input.urlPolicy })
    }).color(
      resolveEmbedColor(
        theme,
        input.context,
        input.color ?? { source: "theme" }
      )
    ),
    theme,
    input,
    translator
  );

  const author = authorFromPolicy(input.chrome.author, input.context);
  if (author !== undefined) {
    builder = builder.author(author);
  }

  const thumbnail = thumbnailFromPolicy(
    input.chrome.thumbnail,
    input.context
  );
  if (thumbnail !== undefined) {
    builder = builder.thumbnail(thumbnail);
  }

  const footer = footerFromPolicy(
    input.chrome,
    input.context,
    theme,
    translator
  );
  if (footer !== undefined) {
    builder = builder.footer(footer);
  }

  if (input.chrome.timestamp !== undefined) {
    builder = builder.timestamp(input.chrome.timestamp);
  }

  if (input.transformers !== undefined) {
    builder = builder.transform(...input.transformers);
  }

  return builder.buildStrict();
};

export class CommandEmbedPlanFactory {
  public constructor(private readonly translator: MessageTranslator) {}

  public create(
    theme: EmbedTheme,
    input: CreateCommandEmbedPlanInput
  ): EmbedPlan {
    return createCommandEmbedPlan(theme, input, this.translator);
  }

  public info(input: CreateCommandEmbedPlanInput): EmbedPlan {
    return this.create("info", input);
  }

  public success(input: CreateCommandEmbedPlanInput): EmbedPlan {
    return this.create("success", input);
  }

  public warning(input: CreateCommandEmbedPlanInput): EmbedPlan {
    return this.create("warning", input);
  }

  public error(input: CreateCommandEmbedPlanInput): EmbedPlan {
    return this.create("error", input);
  }
}
