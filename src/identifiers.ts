import { createHash } from "node:crypto";

import { DiscordCoreError } from "./errors.js";

export type DiscordSnowflake = string & { readonly __discordSnowflake: unique symbol };

const SNOWFLAKE_PATTERN = /^[0-9]{17,20}$/u;
const STABLE_KEY_PATTERN = /^[a-z0-9][a-z0-9._:/-]{0,190}$/u;

export const parseDiscordSnowflake = (
  value: string,
  label = "Discord identifier",
): DiscordSnowflake => {
  const normalized = value.trim();
  if (!SNOWFLAKE_PATTERN.test(normalized)) {
    throw new DiscordCoreError(
      "DISCORD_INVALID_INPUT",
      `${label} is not a valid Discord snowflake.`,
      false,
    );
  }
  return normalized as DiscordSnowflake;
};

export const parseStableBotKey = (value: string, label = "key"): string => {
  const normalized = value.trim();
  if (!STABLE_KEY_PATTERN.test(normalized)) {
    throw new DiscordCoreError(
      "DISCORD_INVALID_INPUT",
      `${label} must be a stable lowercase identifier.`,
      false,
    );
  }
  return normalized;
};

export const discordInteractionCorrelationId = (interactionId: string): string => {
  const normalized = parseDiscordSnowflake(interactionId, "Discord interaction id");
  const bytes = createHash("sha256")
    .update(`discord-interaction:${normalized}`, "utf8")
    .digest()
    .subarray(0, 16);
  const versionByte = bytes[6];
  const variantByte = bytes[8];
  if (versionByte === undefined || variantByte === undefined) {
    throw new Error("Discord correlation digest is unexpectedly short.");
  }
  bytes[6] = (versionByte & 0x0f) | 0x80;
  bytes[8] = (variantByte & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
};

export const deterministicDiscordNonce = (
  deliveryId: string,
  destinationId: string,
): string => {
  const normalized = parseStableBotKey(deliveryId, "deliveryId");
  const destination = parseDiscordSnowflake(destinationId, "Discord delivery destination");
  return createHash("sha256")
    .update(`discord-delivery:${destination}:${normalized}`, "utf8")
    .digest("hex")
    .slice(0, 25);
};
