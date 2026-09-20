import { validateEmbedPlan, EmbedValidationError as EngineValidationError } from "../../vendor/dynamic-embed-engine/dist/index.js";
import {
  LocalizationError,
  type MessageTranslator
} from "./PresentationLocalization.js";

import {
  EMBED_THEME_COLORS,
  localizePresentationText,
  type EmbedAuthor,
  type EmbedField,
  type EmbedFooter,
  type EmbedPlan,
  type EmbedPresentationContext,
  type EmbedTheme,
  type GuildBrandingPresentation,
  type PresentationLocale,
  type RequesterPresentation
} from "./EmbedPlan.js";

export type EmbedValidationCode =
  | "EMBED.EMPTY_TEXT"
  | "EMBED.TEXT_LIMIT_EXCEEDED"
  | "EMBED.FIELD_LIMIT_EXCEEDED"
  | "EMBED.TOTAL_TEXT_LIMIT_EXCEEDED"
  | "EMBED.INVALID_FIELD"
  | "EMBED.INVALID_LOCALE"
  | "EMBED.INVALID_COLOR"
  | "EMBED.INVALID_TIMESTAMP"
  | "EMBED.INVALID_URL"
  | "EMBED.URL_NOT_ALLOWED";

export interface EmbedValidationIssue {
  readonly code: EmbedValidationCode;
  readonly path: string;
  readonly message: string;
  readonly actual?: number | string;
  readonly limit?: number;
}

export class EmbedValidationError extends Error {
  public constructor(public readonly issues: readonly EmbedValidationIssue[]) {
    super(
      `The embed plan is invalid: ${issues.map((issue) => issue.path).join(", ")}.`
    );
    this.name = "EmbedValidationError";
  }
}

export interface EmbedUrlPolicy {
  readonly allowedProtocols: readonly string[];
  readonly allowedHosts?: readonly string[];
}

export interface CreateEmbedPlanOptions {
  readonly locale?: PresentationLocale;
  readonly urlPolicy?: EmbedUrlPolicy;
  readonly translator?: MessageTranslator;
}

export type EmbedPlanTransformer = (
  builder: EmbedPlanBuilder
) => EmbedPlanBuilder;

interface EmbedDraft {
  readonly theme: EmbedTheme;
  readonly locale: PresentationLocale;
  readonly color: number;
  readonly presentationContext?: EmbedPresentationContext;
  readonly title?: string;
  readonly description?: string;
  readonly url?: string;
  readonly timestamp?: string;
  readonly author?: EmbedAuthor;
  readonly footer?: EmbedFooter;
  readonly thumbnailUrl?: string;
  readonly imageUrl?: string;
  readonly fields: readonly EmbedField[];
}

const DEFAULT_URL_POLICY: EmbedUrlPolicy = Object.freeze({
  allowedProtocols: Object.freeze(["https:", "attachment:"])
});

const freezeAuthor = (author: EmbedAuthor): EmbedAuthor =>
  Object.freeze({ ...author });

const freezeFooter = (footer: EmbedFooter): EmbedFooter =>
  Object.freeze({ ...footer });

const freezeField = (field: EmbedField): EmbedField =>
  Object.freeze({ ...field });

const requesterFooterText = (
  requester: RequesterPresentation,
  locale: PresentationLocale,
  translator: MessageTranslator | undefined
): string => {
  if (translator === undefined) {
    throw new LocalizationError(
      "LOCALIZATION.TRANSLATOR_REQUIRED",
      "A MessageTranslator must be injected before adding localized requester chrome."
    );
  }
  return translator.translate(locale, "embed.requester.footer", {
    displayName: requester.displayName
  });
};

const contextState = (
  current: EmbedDraft,
  context: EmbedPresentationContext,
  translator: MessageTranslator | undefined
): EmbedDraft => {
  const mergedContext: EmbedPresentationContext = {
    locale: context.locale,
    ...(context.requester === undefined
      ? current.presentationContext?.requester === undefined
        ? {}
        : { requester: current.presentationContext.requester }
      : { requester: context.requester }),
    ...(context.guild === undefined
      ? current.presentationContext?.guild === undefined
        ? {}
        : { guild: current.presentationContext.guild }
      : { guild: context.guild }),
    ...(context.bot === undefined
      ? current.presentationContext?.bot === undefined
        ? {}
        : { bot: current.presentationContext.bot }
      : { bot: context.bot })
  };
  const guildFooter =
    mergedContext.guild?.footerText === undefined
      ? undefined
      : localizePresentationText(
          mergedContext.guild.footerText,
          mergedContext.locale
        );
  const requesterFooter =
    mergedContext.requester === undefined
      ? undefined
      : requesterFooterText(
          mergedContext.requester,
          mergedContext.locale,
          translator
        );
  const footerText = [guildFooter, requesterFooter]
    .filter((value): value is string => value !== undefined)
    .join(" · ");

  const guildAuthor =
    mergedContext.guild === undefined
      ? undefined
      : {
          name: mergedContext.guild.displayName,
          ...(mergedContext.guild.websiteUrl === undefined
            ? {}
            : { url: mergedContext.guild.websiteUrl }),
          ...(mergedContext.guild.iconUrl === undefined
            ? {}
            : { iconUrl: mergedContext.guild.iconUrl })
        };

  const footer =
    footerText.length === 0
      ? undefined
      : {
          text: footerText,
          ...(mergedContext.requester?.avatarUrl !== undefined
            ? { iconUrl: mergedContext.requester.avatarUrl }
            : mergedContext.guild?.iconUrl !== undefined
              ? { iconUrl: mergedContext.guild.iconUrl }
              : {})
        };

  return {
    ...current,
    locale: mergedContext.locale,
    presentationContext: Object.freeze(mergedContext),
    ...(mergedContext.guild?.accentColor === undefined
      ? {}
      : { color: mergedContext.guild.accentColor }),
    ...(guildAuthor === undefined ? {} : { author: guildAuthor }),
    ...(footer === undefined ? {} : { footer })
  };
};

export class EmbedPlanBuilder {
  private constructor(
    private readonly draft: EmbedDraft,
    private readonly urlPolicy: EmbedUrlPolicy,
    private readonly translator: MessageTranslator | undefined
  ) {}

  public static create(
    theme: EmbedTheme,
    options: CreateEmbedPlanOptions = {}
  ): EmbedPlanBuilder {
    return new EmbedPlanBuilder(
      {
        theme,
        locale: options.locale ?? "it",
        color: EMBED_THEME_COLORS[theme],
        fields: Object.freeze([])
      },
      options.urlPolicy ?? DEFAULT_URL_POLICY,
      options.translator
    );
  }

  public static fromPlan(
    plan: EmbedPlan,
    options: Pick<
      CreateEmbedPlanOptions,
      "urlPolicy" | "translator"
    > = {}
  ): EmbedPlanBuilder {
    return new EmbedPlanBuilder(
      {
        theme: plan.theme,
        locale: plan.locale,
        color: plan.color,
        fields: Object.freeze(plan.fields.map(freezeField)),
        ...(plan.title === undefined ? {} : { title: plan.title }),
        ...(plan.description === undefined
          ? {}
          : { description: plan.description }),
        ...(plan.url === undefined ? {} : { url: plan.url }),
        ...(plan.timestamp === undefined
          ? {}
          : { timestamp: plan.timestamp }),
        ...(plan.author === undefined
          ? {}
          : { author: freezeAuthor(plan.author) }),
        ...(plan.footer === undefined
          ? {}
          : { footer: freezeFooter(plan.footer) }),
        ...(plan.thumbnailUrl === undefined
          ? {}
          : { thumbnailUrl: plan.thumbnailUrl }),
        ...(plan.imageUrl === undefined ? {} : { imageUrl: plan.imageUrl })
      },
      options.urlPolicy ?? DEFAULT_URL_POLICY,
      options.translator
    );
  }

  public static info(options?: CreateEmbedPlanOptions): EmbedPlanBuilder {
    return EmbedPlanBuilder.create("info", options);
  }

  public static success(options?: CreateEmbedPlanOptions): EmbedPlanBuilder {
    return EmbedPlanBuilder.create("success", options);
  }

  public static warning(options?: CreateEmbedPlanOptions): EmbedPlanBuilder {
    return EmbedPlanBuilder.create("warning", options);
  }

  public static error(options?: CreateEmbedPlanOptions): EmbedPlanBuilder {
    return EmbedPlanBuilder.create("error", options);
  }

  public static neutral(options?: CreateEmbedPlanOptions): EmbedPlanBuilder {
    return EmbedPlanBuilder.create("neutral", options);
  }

  private next(changes: Partial<EmbedDraft>): EmbedPlanBuilder {
    return new EmbedPlanBuilder(
      { ...this.draft, ...changes },
      this.urlPolicy,
      this.translator
    );
  }

  public title(value: string): EmbedPlanBuilder {
    return this.next({ title: value });
  }

  public description(value: string): EmbedPlanBuilder {
    return this.next({ description: value });
  }

  public url(value: string): EmbedPlanBuilder {
    return this.next({ url: value });
  }

  public color(value: number): EmbedPlanBuilder {
    return this.next({ color: value });
  }

  public timestamp(value: Date | string): EmbedPlanBuilder {
    return this.next({
      timestamp:
        value instanceof Date
          ? Number.isFinite(value.getTime())
            ? value.toISOString()
            : "Invalid Date"
          : value
    });
  }

  public author(value: EmbedAuthor): EmbedPlanBuilder {
    return this.next({ author: freezeAuthor(value) });
  }

  public footer(value: EmbedFooter): EmbedPlanBuilder {
    return this.next({ footer: freezeFooter(value) });
  }

  public thumbnail(value: string): EmbedPlanBuilder {
    return this.next({ thumbnailUrl: value });
  }

  public image(value: string): EmbedPlanBuilder {
    return this.next({ imageUrl: value });
  }

  public field(
    name: string,
    value: string,
    inline = false
  ): EmbedPlanBuilder {
    return this.next({
      fields: Object.freeze([
        ...this.draft.fields,
        freezeField({ name, value, inline })
      ])
    });
  }

  public fields(values: readonly EmbedField[]): EmbedPlanBuilder {
    return this.next({
      fields: Object.freeze([
        ...this.draft.fields,
        ...values.map(freezeField)
      ])
    });
  }

  public requester(
    requester: RequesterPresentation,
    locale: PresentationLocale = this.draft.locale
  ): EmbedPlanBuilder {
    return this.context({ locale, requester });
  }

  public guildBranding(
    guild: GuildBrandingPresentation,
    locale: PresentationLocale = this.draft.locale
  ): EmbedPlanBuilder {
    return this.context({ locale, guild });
  }

  public context(context: EmbedPresentationContext): EmbedPlanBuilder {
    return new EmbedPlanBuilder(
      contextState(this.draft, context, this.translator),
      this.urlPolicy,
      this.translator
    );
  }

  public transform(
    ...transformers: readonly EmbedPlanTransformer[]
  ): EmbedPlanBuilder {
    let builder: EmbedPlanBuilder = this;
    for (const transformer of transformers) {
      builder = transformer(builder);
    }
    return builder;
  }

  /**
   * Strict construction never truncates text or discards fields. Callers that
   * need several messages must paginate before invoking this operation.
   */
  public buildStrict(): EmbedPlan {
    try {
      const { presentationContext: _context, ...draft } = this.draft;
      const plan = validateEmbedPlan(draft, {
        urlPolicy: this.urlPolicy.allowedHosts === undefined ? {} : { allowedHosts: this.urlPolicy.allowedHosts }
      });
      // Consumers may restrict the engine's safe protocols further.
      for (const [path, value] of Object.entries({ url: plan.url, "author.url": plan.author?.url,
        "author.iconUrl": plan.author?.iconUrl, "footer.iconUrl": plan.footer?.iconUrl,
        thumbnailUrl: plan.thumbnailUrl, imageUrl: plan.imageUrl })) {
        if (value !== undefined && !this.urlPolicy.allowedProtocols.includes(new URL(value).protocol)) {
          throw new EmbedValidationError([{ code: "EMBED.URL_NOT_ALLOWED", path, message: "The URL protocol is not allowed by policy." }]);
        }
      }
      return plan as EmbedPlan;
    } catch (error) {
      if (error instanceof EngineValidationError) {
        throw new EmbedValidationError(Object.freeze(error.issues.map(issue => ({
          ...issue, code: issue.code.replace("EMBED_", "EMBED.") as EmbedValidationCode
        }))));
      }
      throw error;
    }
  }

  public build(): EmbedPlan {
    return this.buildStrict();
  }
}

export const composeEmbedTransformers = (
  ...transformers: readonly EmbedPlanTransformer[]
): EmbedPlanTransformer =>
  (builder) => builder.transform(...transformers);
