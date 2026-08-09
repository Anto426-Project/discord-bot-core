import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DiscordCoreError,
  EmbedPlanBuilder,
  createSafeDiscordMessage,
  deterministicDiscordNonce,
  discordInteractionCorrelationId,
  parseDiscordSnowflake,
} from "../src/index.js";

const CHANNEL_A = "123456789012345678";
const CHANNEL_B = "223456789012345678";

describe("Discord identifiers and safe payloads", () => {
  it("validates snowflakes and derives stable, destination-scoped identifiers", () => {
    assert.equal(parseDiscordSnowflake(` ${CHANNEL_A} `), CHANNEL_A);
    assert.equal(discordInteractionCorrelationId(CHANNEL_A), discordInteractionCorrelationId(CHANNEL_A));
    assert.notEqual(
      deterministicDiscordNonce("delivery/one", CHANNEL_A),
      deterministicDiscordNonce("delivery/one", CHANNEL_B),
    );
    assert.throws(() => parseDiscordSnowflake("12"), DiscordCoreError);
  });

  it("closes mentions and revalidates embeds before provider encoding", () => {
    const payload = createSafeDiscordMessage(
      {
        deliveryId: "delivery/one",
        content: "hello @everyone",
        embeds: [EmbedPlanBuilder.info({ locale: "en" }).description("safe").build()],
      },
      CHANNEL_A,
    );
    assert.deepEqual(payload.allowed_mentions, {
      parse: [],
      users: [],
      roles: [],
      replied_user: false,
    });
    assert.equal(payload.enforce_nonce, true);
    assert.equal(payload.embeds?.[0]?.description, "safe");
  });

  it("rejects structural array-method and aggregate-limit bypasses", () => {
    const valid = EmbedPlanBuilder.info({ locale: "en" }).description("safe").build();
    const fields: unknown[] = [
      { name: "x".repeat(10_000), value: "hidden", inline: false },
    ];
    Object.defineProperty(fields, "map", {
      value: () => [],
    });
    const malicious = { ...valid, fields };
    assert.throws(
      () => createSafeDiscordMessage({ deliveryId: "delivery/two", embeds: [malicious] as never }, CHANNEL_A),
      /field|array|invalid/iu,
    );

    const large = EmbedPlanBuilder.info({ locale: "en" })
      .description("x".repeat(4_000))
      .field("name", "y".repeat(1_000))
      .build();
    assert.throws(
      () =>
        createSafeDiscordMessage(
          { deliveryId: "delivery/three", embeds: [large, large] },
          CHANNEL_A,
        ),
      /aggregate/iu,
    );

    assert.throws(
      () =>
        createSafeDiscordMessage(
          { deliveryId: "delivery/four", content: 42 as never },
          CHANNEL_A,
        ),
      /content/iu,
    );

    const sparseMentions = new Array(1) as unknown as readonly string[];
    assert.throws(
      () =>
        createSafeDiscordMessage(
          {
            deliveryId: "delivery/five",
            content: "safe",
            allowedMentions: { users: sparseMentions },
          },
          CHANNEL_A,
        ),
      /dense/iu,
    );
  });

  it("never serializes an attached provider cause", () => {
    const secret = "mfa.this-is-a-provider-secret-value";
    const error = new DiscordCoreError(
      "DISCORD_PROVIDER_FAILURE",
      "provider failed",
      true,
      500,
      null,
      new Error(secret),
    );
    const serialized = JSON.stringify(error);
    assert.doesNotMatch(serialized, /provider-secret/u);
    assert.equal(error.cause, undefined);
  });
});
