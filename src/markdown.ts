import { DiscordCoreError } from "./errors.js";

const DISCORD_MARKDOWN_CONTROL_CHARACTERS = /([\\`*_{}[\]()<>#+\-.!|~>])/gu;
const DISCORD_TEXT_INPUT_LIMIT = 16_384;

/**
 * Projects untrusted text as a Discord Markdown literal. Message payloads still
 * disable mentions at the transport boundary; the zero-width separator also
 * keeps copied or independently rendered text from retaining mention syntax.
 */
export const escapeDiscordMarkdownLiteral = (value: string): string => {
  if (
    typeof value !== "string" ||
    value.length > DISCORD_TEXT_INPUT_LIMIT ||
    /[\u0000\u000b\u000c\u007f]/u.test(value)
  ) {
    throw new DiscordCoreError(
      "DISCORD_PAYLOAD_REJECTED",
      "Discord text cannot be projected safely.",
      false,
    );
  }

  return value
    .replace(DISCORD_MARKDOWN_CONTROL_CHARACTERS, "\\$1")
    .replaceAll("@", "@\u200b");
};
