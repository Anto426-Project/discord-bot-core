import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DiscordAPIError, REST, Routes } from "discord.js";

import {
  DiscordCoreError,
  discordButton,
  discordMessageActionRow,
  type DiscordMessagePlan,
} from "../src/index.js";
import { NodeDiscordRestAdapter } from "../src/discordjs.js";

const TEST_TOKEN = "provider-token-value-that-must-not-cross-the-core-boundary";
const CHANNEL_ID = "123456789012345678";
const RECIPIENT_ID = "223456789012345678";
const MESSAGE_ID = "323456789012345678";

describe("Node Discord message delivery", () => {
  it("encodes a provider-neutral message plan at the REST boundary", async () => {
    const postDescriptor = Object.getOwnPropertyDescriptor(REST.prototype, "post");
    assert.ok(postDescriptor);
    const calls: Array<{ route: string; body: unknown }> = [];
    Object.defineProperty(REST.prototype, "post", {
      ...postDescriptor,
      async value(route: string, options: { body?: unknown }): Promise<unknown> {
        calls.push({ route, body: options.body });
        return { id: MESSAGE_ID, channel_id: CHANNEL_ID };
      },
    });

    try {
      const plan: DiscordMessagePlan = Object.freeze({
        content: "Choose",
        components: Object.freeze([
          discordMessageActionRow([
            discordButton({ style: "success", label: "Confirm", customId: "choice:confirm" }),
          ]),
        ]),
      });
      const receipt = await new NodeDiscordRestAdapter({ botToken: TEST_TOKEN }).sendChannelMessage({
        channelId: CHANNEL_ID,
        message: { deliveryId: "delivery/rest", ...plan },
      });

      assert.deepEqual(receipt, { messageId: MESSAGE_ID, channelId: CHANNEL_ID });
      assert.equal(calls[0]?.route, Routes.channelMessages(CHANNEL_ID));
      assert.deepEqual(calls[0]?.body, {
        content: "Choose",
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 3,
                label: "Confirm",
                custom_id: "choice:confirm",
                disabled: false,
              },
            ],
          },
        ],
        nonce: (calls[0]?.body as { nonce: string }).nonce,
        enforce_nonce: true,
        allowed_mentions: { parse: [], users: [], roles: [], replied_user: false },
      });
    } finally {
      Object.defineProperty(REST.prototype, "post", postDescriptor);
    }
  });

  it("passes file attachments to REST post", async () => {
    const postDescriptor = Object.getOwnPropertyDescriptor(REST.prototype, "post");
    assert.ok(postDescriptor);
    let capturedFiles: unknown = undefined;
    Object.defineProperty(REST.prototype, "post", {
      ...postDescriptor,
      async value(_route: string, options: { files?: unknown }): Promise<unknown> {
        capturedFiles = options.files;
        return { id: MESSAGE_ID, channel_id: CHANNEL_ID };
      },
    });

    try {
      const fileData = new Uint8Array([1, 2, 3, 4]);
      await new NodeDiscordRestAdapter({ botToken: TEST_TOKEN }).sendChannelMessage({
        channelId: CHANNEL_ID,
        message: {
          deliveryId: "delivery/file",
          files: [{ name: "test.png", data: fileData, contentType: "image/png" }],
        },
      });

      assert.ok(Array.isArray(capturedFiles));
      assert.equal((capturedFiles as Array<{ name: string }>)[0]?.name, "test.png");
    } finally {
      Object.defineProperty(REST.prototype, "post", postDescriptor);
    }
  });

  it("classifies only Discord's explicit cannot-DM code as recipient unreachable", async () => {
    const postDescriptor = Object.getOwnPropertyDescriptor(REST.prototype, "post");
    assert.ok(postDescriptor);

    const providerError = (code: number): DiscordAPIError =>
      new DiscordAPIError(
        { code, message: "provider body must remain private" },
        code,
        403,
        "POST",
        "https://discord.com/api/v10/users/@me/channels",
        { body: undefined, files: undefined },
      );

    try {
      for (const [providerCode, expectedCode] of [
        [50_007, "DISCORD_RECIPIENT_UNREACHABLE"],
        [50_013, "DISCORD_PROVIDER_FAILURE"],
      ] as const) {
        Object.defineProperty(REST.prototype, "post", {
          ...postDescriptor,
          async value(): Promise<never> {
            throw providerError(providerCode);
          },
        });
        await assert.rejects(
          new NodeDiscordRestAdapter({ botToken: TEST_TOKEN }).sendDirectMessage({
            recipientId: RECIPIENT_ID,
            message: { deliveryId: `delivery/dm/${providerCode}`, content: "hello" },
          }),
          (error: unknown) => {
            assert.ok(error instanceof DiscordCoreError);
            assert.equal(error.code, expectedCode);
            assert.equal(error.retryable, false);
            assert.doesNotMatch(JSON.stringify(error), /provider body/iu);
            return true;
          },
        );
      }

      Object.defineProperty(REST.prototype, "post", {
        ...postDescriptor,
        async value(): Promise<never> {
          throw providerError(50_007);
        },
      });
      await assert.rejects(
        new NodeDiscordRestAdapter({ botToken: TEST_TOKEN }).sendChannelMessage({
          channelId: CHANNEL_ID,
          message: { deliveryId: "delivery/channel/50007", content: "hello" },
        }),
        (error: unknown) =>
          error instanceof DiscordCoreError && error.code === "DISCORD_PROVIDER_FAILURE",
      );

      let directMessageCalls = 0;
      Object.defineProperty(REST.prototype, "post", {
        ...postDescriptor,
        async value(): Promise<unknown> {
          directMessageCalls += 1;
          if (directMessageCalls === 1) return { id: CHANNEL_ID };
          throw providerError(50_007);
        },
      });
      await assert.rejects(
        new NodeDiscordRestAdapter({ botToken: TEST_TOKEN }).sendDirectMessage({
          recipientId: RECIPIENT_ID,
          message: { deliveryId: "delivery/dm/post/50007", content: "hello" },
        }),
        (error: unknown) =>
          error instanceof DiscordCoreError && error.code === "DISCORD_RECIPIENT_UNREACHABLE",
      );
      assert.equal(directMessageCalls, 2);
    } finally {
      Object.defineProperty(REST.prototype, "post", postDescriptor);
    }
  });
});
