import type { MessageTranslator as Translator } from "../localization/index.js";
export { LocalizationError } from "../localization/index.js";
export type { LocalizationLocale, LocalizedMessage } from "../localization/index.js";
export type MessageKey = "embed.theme.info" | "embed.theme.success" | "embed.theme.warning" | "embed.theme.error" | "embed.theme.neutral" | "embed.command.default_title" | "embed.command.default_description" | "embed.command.default_footer" | "embed.requester.footer";
export type MessageTranslator = Translator<MessageKey>;
//# sourceMappingURL=PresentationLocalization.d.ts.map