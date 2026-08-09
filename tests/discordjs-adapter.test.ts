import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Client, Events } from "discord.js";

import { DiscordCoreError } from "../src/errors.js";
import { NodeDiscordGatewayAdapter } from "../src/discordjs.js";
import type { DiscordInteraction } from "../src/interactions.js";

const TEST_TOKEN = "provider-token-value-that-must-not-cross-the-core-boundary";
const BOT_USER_ID = "12345678901234567";
const APPLICATION_ID = "22345678901234567";
const INTERACTION_ID = "32345678901234567";
const USER_ID = "42345678901234567";

type MutableTestClient = Client & {
  __testReady?: boolean;
};

const nextTurn = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

describe("Node Discord adapter isolation", () => {
  it("shares gateway startup, isolates caller cancellation and awaits provider shutdown", async () => {
    const loginDescriptor = Object.getOwnPropertyDescriptor(Client.prototype, "login");
    const destroyDescriptor = Object.getOwnPropertyDescriptor(Client.prototype, "destroy");
    const readyDescriptor = Object.getOwnPropertyDescriptor(Client.prototype, "isReady");
    assert.ok(loginDescriptor);
    assert.ok(destroyDescriptor);
    assert.ok(readyDescriptor);

    let providerClient: MutableTestClient | null = null;
    let loginCalls = 0;
    let resolveLogin!: () => void;
    let resolveDestroy!: () => void;
    let destroyStarted = false;
    let destroyCompleted = false;

    Object.defineProperty(Client.prototype, "isReady", {
      ...readyDescriptor,
      value(this: MutableTestClient): boolean {
        return this.__testReady === true;
      },
    });
    Object.defineProperty(Client.prototype, "login", {
      ...loginDescriptor,
      async value(this: MutableTestClient): Promise<string> {
        providerClient = this;
        loginCalls += 1;
        await new Promise<void>((resolve) => {
          resolveLogin = resolve;
        });
        (this as unknown as { user: unknown }).user = {
          id: BOT_USER_ID,
          username: "test-bot",
          globalName: null,
          displayAvatarURL: () => null,
        };
        (this as unknown as { application: unknown }).application = { id: APPLICATION_ID };
        this.__testReady = true;
        this.emit(Events.ClientReady, this as never);
        return TEST_TOKEN;
      },
    });
    Object.defineProperty(Client.prototype, "destroy", {
      ...destroyDescriptor,
      async value(this: MutableTestClient): Promise<void> {
        destroyStarted = true;
        await new Promise<void>((resolve) => {
          resolveDestroy = resolve;
        });
        this.__testReady = false;
        destroyCompleted = true;
      },
    });

    try {
      const adapter = new NodeDiscordGatewayAdapter({
        botToken: TEST_TOKEN,
        intents: ["Guilds"],
      });
      let interaction: DiscordInteraction | null = null;
      adapter.subscribeInteractions((value) => {
        interaction = value;
      });

      const cancelledCaller = new AbortController();
      const cancelledStart = adapter.start(cancelledCaller.signal);
      const survivingStart = adapter.start();
      assert.equal(loginCalls, 1);

      cancelledCaller.abort();
      await assert.rejects(
        cancelledStart,
        (error: unknown) =>
          error instanceof DiscordCoreError && error.code === "DISCORD_CANCELLED",
      );
      assert.equal(destroyStarted, false);

      resolveLogin();
      assert.deepEqual(await survivingStart, {
        userId: BOT_USER_ID,
        username: "test-bot",
        applicationId: APPLICATION_ID,
      });
      assert.equal(loginCalls, 1);
      const activeClient = ((): MutableTestClient => {
        if (providerClient === null) throw new Error("provider client was not captured");
        return providerClient;
      })();

      const interactionSecret = "INTERACTION_SECRET_THAT_MUST_NEVER_ESCAPE";
      const rawInteraction = {
        id: INTERACTION_ID,
        locale: "it",
        channelId: null,
        user: {
          id: USER_ID,
          username: "student",
          globalName: null,
          displayAvatarURL: () => null,
        },
        guild: null,
        client: activeClient,
        createdAt: new Date("2026-08-09T12:00:00.000Z"),
        customId: "test.button",
        replied: false,
        deferred: false,
        isRepliable: () => true,
        isChatInputCommand: () => false,
        isButton: () => true,
        isStringSelectMenu: () => false,
        isUserSelectMenu: () => false,
        isModalSubmit: () => false,
        isMessageComponent: () => true,
        isCommand: () => false,
        reply: async () => {
          const providerError = new Error(`provider url contains ${interactionSecret}`) as Error & {
            url: string;
            requestBody: unknown;
          };
          providerError.url = `https://discord.com/api/v10/interactions/${INTERACTION_ID}/${interactionSecret}/callback`;
          providerError.requestBody = { token: interactionSecret };
          throw providerError;
        },
      };
      activeClient.emit(Events.InteractionCreate, rawInteraction as never);
      await nextTurn();
      const normalizedInteraction = ((): DiscordInteraction => {
        if (interaction === null) throw new Error("interaction was not normalized");
        return interaction;
      })();
      await assert.rejects(
        normalizedInteraction.responder.reply({ content: "safe response" }),
        (error: unknown) => {
          assert.ok(error instanceof DiscordCoreError);
          assert.equal(error.code, "DISCORD_NETWORK_FAILURE");
          assert.doesNotMatch(JSON.stringify(error), new RegExp(interactionSecret, "u"));
          assert.equal("cause" in error, false);
          return true;
        },
      );

      let stopped = false;
      const stopping = adapter.stop().then(() => {
        stopped = true;
      });
      await nextTurn();
      assert.equal(destroyStarted, true);
      assert.equal(stopped, false);
      assert.equal(destroyCompleted, false);
      resolveDestroy();
      await stopping;
      assert.equal(destroyCompleted, true);
      assert.equal(stopped, true);
    } finally {
      Object.defineProperty(Client.prototype, "login", loginDescriptor);
      Object.defineProperty(Client.prototype, "destroy", destroyDescriptor);
      Object.defineProperty(Client.prototype, "isReady", readyDescriptor);
    }
  });

  it("does not finish stop or restart until an in-flight provider login settles", async () => {
    const loginDescriptor = Object.getOwnPropertyDescriptor(Client.prototype, "login");
    const destroyDescriptor = Object.getOwnPropertyDescriptor(Client.prototype, "destroy");
    const readyDescriptor = Object.getOwnPropertyDescriptor(Client.prototype, "isReady");
    assert.ok(loginDescriptor);
    assert.ok(destroyDescriptor);
    assert.ok(readyDescriptor);

    let loginCalls = 0;
    let destroyCalls = 0;
    let resolveFirstLogin!: () => void;
    const loginClients = new Set<Client>();

    Object.defineProperty(Client.prototype, "isReady", {
      ...readyDescriptor,
      value(this: MutableTestClient): boolean {
        return this.__testReady === true;
      },
    });
    Object.defineProperty(Client.prototype, "login", {
      ...loginDescriptor,
      async value(this: MutableTestClient): Promise<string> {
        loginCalls += 1;
        loginClients.add(this);
        if (loginCalls === 1) {
          await new Promise<void>((resolve) => {
            resolveFirstLogin = resolve;
          });
        }
        (this as unknown as { user: unknown }).user = {
          id: BOT_USER_ID,
          username: "test-bot",
          globalName: null,
          displayAvatarURL: () => null,
        };
        (this as unknown as { application: unknown }).application = { id: APPLICATION_ID };
        this.__testReady = true;
        this.emit(Events.ClientReady, this as never);
        return TEST_TOKEN;
      },
    });
    Object.defineProperty(Client.prototype, "destroy", {
      ...destroyDescriptor,
      async value(this: MutableTestClient): Promise<void> {
        destroyCalls += 1;
        this.__testReady = false;
      },
    });

    try {
      const adapter = new NodeDiscordGatewayAdapter({
        botToken: TEST_TOKEN,
        intents: ["Guilds"],
      });
      let readyEvents = 0;
      adapter.subscribeLifecycle((event) => {
        if (event.type === "ready") readyEvents += 1;
      });

      const startupResult = adapter.start().catch((error: unknown) => error);
      assert.equal(loginCalls, 1);
      let stopCompleted = false;
      const stopping = adapter.stop().then(() => {
        stopCompleted = true;
      });
      const restarting = adapter.start();
      await nextTurn();

      assert.equal(destroyCalls, 1);
      assert.equal(stopCompleted, false);
      assert.equal(loginCalls, 1);

      resolveFirstLogin();
      const startupError = await startupResult;
      assert.ok(startupError instanceof DiscordCoreError);
      assert.equal(startupError.code, "DISCORD_CANCELLED");
      await stopping;
      assert.equal(stopCompleted, true);
      assert.equal(destroyCalls, 2);

      assert.deepEqual(await restarting, {
        userId: BOT_USER_ID,
        username: "test-bot",
        applicationId: APPLICATION_ID,
      });
      assert.equal(loginCalls, 2);
      assert.equal(loginClients.size, 2);
      assert.equal(readyEvents, 1);
      await adapter.stop();
      assert.equal(destroyCalls, 3);
    } finally {
      Object.defineProperty(Client.prototype, "login", loginDescriptor);
      Object.defineProperty(Client.prototype, "destroy", destroyDescriptor);
      Object.defineProperty(Client.prototype, "isReady", readyDescriptor);
    }
  });
});
