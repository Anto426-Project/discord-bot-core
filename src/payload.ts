import type { EmbedPlan } from "@anto-project/dynamic-embed-engine";

import { DiscordCoreError } from "./errors.js";
import { deterministicDiscordNonce, parseDiscordSnowflake } from "./identifiers.js";

export interface DiscordApiEmbed {
  readonly color: number;
  readonly title?: string;
  readonly description?: string;
  readonly url?: string;
  readonly timestamp?: string;
  readonly author?: Readonly<{ name: string; url?: string; icon_url?: string }>;
  readonly footer?: Readonly<{ text: string; icon_url?: string }>;
  readonly thumbnail?: Readonly<{ url: string }>;
  readonly image?: Readonly<{ url: string }>;
  readonly fields?: readonly Readonly<{ name: string; value: string; inline: boolean }>[];
}

export interface DiscordAllowedMentionsInput {
  readonly users?: readonly string[];
  readonly roles?: readonly string[];
  readonly repliedUser?: boolean;
}

export interface SafeDiscordMessageInput {
  readonly deliveryId: string;
  readonly content?: string;
  readonly embeds?: readonly EmbedPlan[];
  readonly allowedMentions?: DiscordAllowedMentionsInput;
}

export interface SafeDiscordMessagePayload {
  readonly content?: string;
  readonly embeds?: readonly DiscordApiEmbed[];
  readonly nonce: string;
  readonly enforce_nonce: true;
  readonly allowed_mentions: Readonly<{
    parse: readonly [];
    users: readonly string[];
    roles: readonly string[];
    replied_user: boolean;
  }>;
}

const uniqueSnowflakes = (values: readonly string[] | undefined, label: string): readonly string[] => {
  if (values === undefined) return Object.freeze([]);
  if (values.length > 100) {
    throw new DiscordCoreError(
      "DISCORD_PAYLOAD_REJECTED",
      `${label} exceeds the Discord mention allowlist limit.`,
      false,
    );
  }
  return Object.freeze(
    [...new Set(values.map((value) => parseDiscordSnowflake(value, label)))],
  );
};

export const encodeDiscordApiEmbed = (plan: EmbedPlan): DiscordApiEmbed =>
  Object.freeze({
    color: plan.color,
    ...(plan.title === undefined ? {} : { title: plan.title }),
    ...(plan.description === undefined ? {} : { description: plan.description }),
    ...(plan.url === undefined ? {} : { url: plan.url }),
    ...(plan.timestamp === undefined ? {} : { timestamp: plan.timestamp }),
    ...(plan.author === undefined
      ? {}
      : {
          author: Object.freeze({
            name: plan.author.name,
            ...(plan.author.url === undefined ? {} : { url: plan.author.url }),
            ...(plan.author.iconUrl === undefined ? {} : { icon_url: plan.author.iconUrl }),
          }),
        }),
    ...(plan.footer === undefined
      ? {}
      : {
          footer: Object.freeze({
            text: plan.footer.text,
            ...(plan.footer.iconUrl === undefined ? {} : { icon_url: plan.footer.iconUrl }),
          }),
        }),
    ...(plan.thumbnailUrl === undefined
      ? {}
      : { thumbnail: Object.freeze({ url: plan.thumbnailUrl }) }),
    ...(plan.imageUrl === undefined ? {} : { image: Object.freeze({ url: plan.imageUrl }) }),
    ...(plan.fields.length === 0
      ? {}
      : {
          fields: Object.freeze(
            plan.fields.map((field) =>
              Object.freeze({ name: field.name, value: field.value, inline: field.inline }),
            ),
          ),
        }),
  });

export const createSafeDiscordMessage = (
  input: SafeDiscordMessageInput,
): SafeDiscordMessagePayload => {
  const content = input.content;
  if (content !== undefined && (content.length < 1 || content.length > 2_000)) {
    throw new DiscordCoreError(
      "DISCORD_PAYLOAD_REJECTED",
      "Discord message content must contain between 1 and 2000 characters.",
      false,
    );
  }
  const embeds = input.embeds ?? [];
  if (embeds.length > 10) {
    throw new DiscordCoreError(
      "DISCORD_PAYLOAD_REJECTED",
      "Discord message embed limit exceeded.",
      false,
    );
  }
  if (content === undefined && embeds.length === 0) {
    throw new DiscordCoreError(
      "DISCORD_PAYLOAD_REJECTED",
      "Discord message requires content or an embed.",
      false,
    );
  }

  const users = uniqueSnowflakes(input.allowedMentions?.users, "allowed mention user");
  const roles = uniqueSnowflakes(input.allowedMentions?.roles, "allowed mention role");
  return Object.freeze({
    ...(content === undefined ? {} : { content }),
    ...(embeds.length === 0
      ? {}
      : { embeds: Object.freeze(embeds.map((embed) => encodeDiscordApiEmbed(embed))) }),
    nonce: deterministicDiscordNonce(input.deliveryId),
    enforce_nonce: true,
    allowed_mentions: Object.freeze({
      parse: Object.freeze([]) as readonly [],
      users,
      roles,
      replied_user: input.allowedMentions?.repliedUser === true,
    }),
  });
};
