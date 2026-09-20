import { validateEmbedPlan, EmbedValidationError as EngineValidationError } from "../../vendor/dynamic-embed-engine/dist/index.js";
import { LocalizationError } from "./PresentationLocalization.js";
import { EMBED_THEME_COLORS, localizePresentationText } from "./EmbedPlan.js";
export class EmbedValidationError extends Error {
    issues;
    constructor(issues) {
        super(`The embed plan is invalid: ${issues.map((issue) => issue.path).join(", ")}.`);
        this.issues = issues;
        this.name = "EmbedValidationError";
    }
}
const DEFAULT_URL_POLICY = Object.freeze({
    allowedProtocols: Object.freeze(["https:", "attachment:"])
});
const freezeAuthor = (author) => Object.freeze({ ...author });
const freezeFooter = (footer) => Object.freeze({ ...footer });
const freezeField = (field) => Object.freeze({ ...field });
const requesterFooterText = (requester, locale, translator) => {
    if (translator === undefined) {
        throw new LocalizationError("LOCALIZATION.TRANSLATOR_REQUIRED", "A MessageTranslator must be injected before adding localized requester chrome.");
    }
    return translator.translate(locale, "embed.requester.footer", {
        displayName: requester.displayName
    });
};
const contextState = (current, context, translator) => {
    const mergedContext = {
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
    const guildFooter = mergedContext.guild?.footerText === undefined
        ? undefined
        : localizePresentationText(mergedContext.guild.footerText, mergedContext.locale);
    const requesterFooter = mergedContext.requester === undefined
        ? undefined
        : requesterFooterText(mergedContext.requester, mergedContext.locale, translator);
    const footerText = [guildFooter, requesterFooter]
        .filter((value) => value !== undefined)
        .join(" · ");
    const guildAuthor = mergedContext.guild === undefined
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
    const footer = footerText.length === 0
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
    draft;
    urlPolicy;
    translator;
    constructor(draft, urlPolicy, translator) {
        this.draft = draft;
        this.urlPolicy = urlPolicy;
        this.translator = translator;
    }
    static create(theme, options = {}) {
        return new EmbedPlanBuilder({
            theme,
            locale: options.locale ?? "it",
            color: EMBED_THEME_COLORS[theme],
            fields: Object.freeze([])
        }, options.urlPolicy ?? DEFAULT_URL_POLICY, options.translator);
    }
    static fromPlan(plan, options = {}) {
        return new EmbedPlanBuilder({
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
        }, options.urlPolicy ?? DEFAULT_URL_POLICY, options.translator);
    }
    static info(options) {
        return EmbedPlanBuilder.create("info", options);
    }
    static success(options) {
        return EmbedPlanBuilder.create("success", options);
    }
    static warning(options) {
        return EmbedPlanBuilder.create("warning", options);
    }
    static error(options) {
        return EmbedPlanBuilder.create("error", options);
    }
    static neutral(options) {
        return EmbedPlanBuilder.create("neutral", options);
    }
    next(changes) {
        return new EmbedPlanBuilder({ ...this.draft, ...changes }, this.urlPolicy, this.translator);
    }
    title(value) {
        return this.next({ title: value });
    }
    description(value) {
        return this.next({ description: value });
    }
    url(value) {
        return this.next({ url: value });
    }
    color(value) {
        return this.next({ color: value });
    }
    timestamp(value) {
        return this.next({
            timestamp: value instanceof Date
                ? Number.isFinite(value.getTime())
                    ? value.toISOString()
                    : "Invalid Date"
                : value
        });
    }
    author(value) {
        return this.next({ author: freezeAuthor(value) });
    }
    footer(value) {
        return this.next({ footer: freezeFooter(value) });
    }
    thumbnail(value) {
        return this.next({ thumbnailUrl: value });
    }
    image(value) {
        return this.next({ imageUrl: value });
    }
    field(name, value, inline = false) {
        return this.next({
            fields: Object.freeze([
                ...this.draft.fields,
                freezeField({ name, value, inline })
            ])
        });
    }
    fields(values) {
        return this.next({
            fields: Object.freeze([
                ...this.draft.fields,
                ...values.map(freezeField)
            ])
        });
    }
    requester(requester, locale = this.draft.locale) {
        return this.context({ locale, requester });
    }
    guildBranding(guild, locale = this.draft.locale) {
        return this.context({ locale, guild });
    }
    context(context) {
        return new EmbedPlanBuilder(contextState(this.draft, context, this.translator), this.urlPolicy, this.translator);
    }
    transform(...transformers) {
        let builder = this;
        for (const transformer of transformers) {
            builder = transformer(builder);
        }
        return builder;
    }
    /**
     * Strict construction never truncates text or discards fields. Callers that
     * need several messages must paginate before invoking this operation.
     */
    buildStrict() {
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
            return plan;
        }
        catch (error) {
            if (error instanceof EngineValidationError) {
                throw new EmbedValidationError(Object.freeze(error.issues.map(issue => ({
                    ...issue, code: issue.code.replace("EMBED_", "EMBED.")
                }))));
            }
            throw error;
        }
    }
    build() {
        return this.buildStrict();
    }
}
export const composeEmbedTransformers = (...transformers) => (builder) => builder.transform(...transformers);
//# sourceMappingURL=EmbedPlanBuilder.js.map