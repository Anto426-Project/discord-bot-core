import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ChatInputCommandInteraction, Client, Events } from "discord.js";

import { DiscordCoreError } from "../src/errors.js";
import {
  NodeDiscordGatewayAdapter,
  normalizeNodeDiscordInteraction,
} from "../src/discordjs.js";
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

const createProviderChatInputInteraction = (): unknown => {
  const client = new Client({ intents: [] });
  (client as unknown as { user: unknown }).user = {
    id: BOT_USER_ID,
    username: "test-bot",
    globalName: null,
    displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png",
  };
  return Reflect.construct(ChatInputCommandInteraction, [
    client,
    {
      type: 2,
      id: INTERACTION_ID,
      token: TEST_TOKEN,
      application_id: APPLICATION_ID,
      channel: null,
      guild_id: null,
      user: {
        id: USER_ID,
        username: "student",
        global_name: null,
        discriminator: "0",
        avatar: null,
      },
      version: 1,
      app_permissions: "0",
      locale: "it",
      guild_locale: null,
      entitlements: [],
      authorizing_integration_owners: {},
      context: null,
      attachment_size_limit: 10_000_000,
      data: {
        id: "52345678901234567",
        name: "ping",
        type: 1,
        options: [],
      },
    },
  ]);
};

describe("Node Discord adapter isolation", () => {
  it("normalizes only genuine provider interaction instances", () => {
    const structuralImpostor = {
      id: INTERACTION_ID,
      isRepliable: () => true,
      isChatInputCommand: () => true,
      commandName: "unsafe",
    };
    assert.equal(normalizeNodeDiscordInteraction(structuralImpostor), null);

    const normalized = normalizeNodeDiscordInteraction(createProviderChatInputInteraction());
    assert.ok(normalized);
    assert.equal(normalized.kind, "chat_input");
    assert.equal(normalized.commandName, "ping");
    assert.equal(normalized.user.id, USER_ID);
    assert.equal(normalized.bot.id, BOT_USER_ID);
  });

  it("redacts provider failures while normalizing genuine instances", () => {
    const interaction = createProviderChatInputInteraction() as {
      isRepliable(): boolean;
    };
    const providerSecret = "PROVIDER_INTERACTION_SECRET";
    interaction.isRepliable = () => {
      throw new Error(`provider interaction failed with ${providerSecret}`);
    };

    assert.throws(
      () => normalizeNodeDiscordInteraction(interaction),
      (error: unknown) => {
        assert.ok(error instanceof DiscordCoreError);
        assert.equal(error.code, "DISCORD_NETWORK_FAILURE");
        assert.doesNotMatch(JSON.stringify(error), new RegExp(providerSecret, "u"));
        assert.equal("cause" in error, false);
        return true;
      },
    );
  });

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

  it("rebinds opaque provider extensions to each gateway client generation", async () => {
    const loginDescriptor = Object.getOwnPropertyDescriptor(Client.prototype, "login");
    const destroyDescriptor = Object.getOwnPropertyDescriptor(Client.prototype, "destroy");
    const readyDescriptor = Object.getOwnPropertyDescriptor(Client.prototype, "isReady");
    assert.ok(loginDescriptor);
    assert.ok(destroyDescriptor);
    assert.ok(readyDescriptor);

    const timeline: string[] = [];
    const clients = new Map<Client, number>();
    let loginCalls = 0;

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
        timeline.push(`destroy:${clients.get(this) ?? "unbound"}`);
        this.__testReady = false;
      },
    });

    try {
      const adapter = new NodeDiscordGatewayAdapter({
        botToken: TEST_TOKEN,
        intents: ["Guilds"],
      });
      const protocolSymbol = Symbol.for(
        "@anto-project/discord-bot-core/provider-extension/v1",
      );
      const extension = {};
      Object.defineProperty(extension, protocolSymbol, {
        enumerable: false,
        value: Object.freeze({
          key: "test.extension",
          bindProviderClient(providerClient: unknown, generation: number): void {
            assert.ok(providerClient instanceof Client);
            clients.set(providerClient, generation);
            timeline.push(`bind:${generation}`);
          },
          async releaseProviderClient(
            generation: number,
            signal: AbortSignal,
          ): Promise<void> {
            assert.equal(signal.aborted, false);
            timeline.push(`release:${generation}`);
          },
        }),
      });

      const dispose = await adapter.registerProviderExtension(extension);
      assert.deepEqual(timeline, ["bind:1"]);
      await adapter.start();
      assert.equal(loginCalls, 1);
      assert.throws(
        () => adapter.registerProviderExtension(extension),
        /before the gateway lifecycle/iu,
      );

      await adapter.stop();
      assert.deepEqual(timeline.slice(0, 3), ["bind:1", "release:1", "destroy:1"]);

      await adapter.start();
      assert.equal(loginCalls, 2);
      assert.deepEqual(timeline.slice(3), ["bind:2"]);
      assert.equal(new Set(clients.keys()).size, 2);
      await adapter.stop();
      assert.deepEqual(timeline.slice(3), ["bind:2", "release:2", "destroy:2"]);
      await dispose();
      await dispose();
    } finally {
      Object.defineProperty(Client.prototype, "login", loginDescriptor);
      Object.defineProperty(Client.prototype, "destroy", destroyDescriptor);
      Object.defineProperty(Client.prototype, "isReady", readyDescriptor);
    }
  });

  it("rejects malformed and duplicate opaque provider extensions", async () => {
    const adapter = new NodeDiscordGatewayAdapter({
      botToken: TEST_TOKEN,
      intents: ["Guilds"],
    });
    const protocolSymbol = Symbol.for(
      "@anto-project/discord-bot-core/provider-extension/v1",
    );
    assert.throws(() => adapter.registerProviderExtension({}), /protocol is missing/iu);

    const extension = {};
    Object.defineProperty(extension, protocolSymbol, {
      value: Object.freeze({
        key: "test.duplicate",
        bindProviderClient(): void {},
        async releaseProviderClient(): Promise<void> {},
      }),
    });
    const dispose = await adapter.registerProviderExtension(extension);
    assert.throws(
      () => adapter.registerProviderExtension(extension),
      /already registered/iu,
    );
    await dispose();
  });

  it("freezes provider extension registration when shutdown begins", async () => {
    const adapter = new NodeDiscordGatewayAdapter({
      botToken: TEST_TOKEN,
      intents: ["Guilds"],
    });
    const protocolSymbol = Symbol.for(
      "@anto-project/discord-bot-core/provider-extension/v1",
    );
    let release!: () => void;
    const releaseGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const extension = {};
    Object.defineProperty(extension, protocolSymbol, {
      value: Object.freeze({
        key: "test.shutdown-race",
        bindProviderClient(): void {},
        async releaseProviderClient(): Promise<void> {
          await releaseGate;
        },
      }),
    });
    await adapter.registerProviderExtension(extension);

    const stopping = adapter.stop();
    assert.throws(
      () =>
        adapter.registerProviderExtension(
          Object.defineProperty({}, protocolSymbol, {
            value: Object.freeze({
              key: "test.late-extension",
              bindProviderClient(): void {},
              async releaseProviderClient(): Promise<void> {},
            }),
          }),
        ),
      /before the gateway lifecycle/iu,
    );
    release();
    await stopping;
  });

  it("quarantines an extension until a timed-out release actually settles", async () => {
    const loginDescriptor = Object.getOwnPropertyDescriptor(Client.prototype, "login");
    const destroyDescriptor = Object.getOwnPropertyDescriptor(Client.prototype, "destroy");
    const readyDescriptor = Object.getOwnPropertyDescriptor(Client.prototype, "isReady");
    assert.ok(loginDescriptor);
    assert.ok(destroyDescriptor);
    assert.ok(readyDescriptor);

    Object.defineProperty(Client.prototype, "isReady", {
      ...readyDescriptor,
      value(this: MutableTestClient): boolean {
        return this.__testReady === true;
      },
    });
    Object.defineProperty(Client.prototype, "login", {
      ...loginDescriptor,
      async value(this: MutableTestClient): Promise<string> {
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
        this.__testReady = false;
      },
    });

    try {
      const adapter = new NodeDiscordGatewayAdapter({
        botToken: TEST_TOKEN,
        intents: ["Guilds"],
        closeTimeoutMs: 1_000,
      });
      const protocolSymbol = Symbol.for(
        "@anto-project/discord-bot-core/provider-extension/v1",
      );
      let finishRelease!: () => void;
      const releaseGate = new Promise<void>((resolve) => {
        finishRelease = resolve;
      });
      const boundGenerations: number[] = [];
      const extension = {};
      Object.defineProperty(extension, protocolSymbol, {
        value: Object.freeze({
          key: "test.release-timeout",
          bindProviderClient(_client: unknown, generation: number): void {
            boundGenerations.push(generation);
          },
          async releaseProviderClient(): Promise<void> {
            await releaseGate;
          },
        }),
      });
      await adapter.registerProviderExtension(extension);
      await adapter.start();

      await assert.rejects(adapter.stop(), (error: unknown) => {
        assert.ok(error instanceof DiscordCoreError);
        assert.equal(error.code, "DISCORD_PROVIDER_FAILURE");
        return true;
      });
      await assert.rejects(adapter.start(), (error: unknown) => {
        assert.ok(error instanceof DiscordCoreError);
        assert.equal(error.code, "DISCORD_CIRCUIT_OPEN");
        return true;
      });
      assert.deepEqual(boundGenerations, [1]);

      finishRelease();
      await nextTurn();
      await adapter.start();
      assert.deepEqual(boundGenerations, [1, 3]);
      await adapter.stop();
    } finally {
      Object.defineProperty(Client.prototype, "login", loginDescriptor);
      Object.defineProperty(Client.prototype, "destroy", destroyDescriptor);
      Object.defineProperty(Client.prototype, "isReady", readyDescriptor);
    }
  });

  it("keeps failed disposal under lifecycle ownership and permits retry", async () => {
    const adapter = new NodeDiscordGatewayAdapter({
      botToken: TEST_TOKEN,
      intents: ["Guilds"],
    });
    const protocolSymbol = Symbol.for(
      "@anto-project/discord-bot-core/provider-extension/v1",
    );
    let releaseCalls = 0;
    const extension = {};
    Object.defineProperty(extension, protocolSymbol, {
      value: Object.freeze({
        key: "test.dispose-retry",
        bindProviderClient(): void {},
        async releaseProviderClient(): Promise<void> {
          releaseCalls += 1;
          if (releaseCalls === 1) throw new Error("provider cleanup failed");
        },
      }),
    });
    const dispose = await adapter.registerProviderExtension(extension);
    await assert.rejects(dispose());
    await assert.rejects(adapter.start(), (error: unknown) => {
      assert.ok(error instanceof DiscordCoreError);
      assert.equal(error.code, "DISCORD_CIRCUIT_OPEN");
      return true;
    });
    await dispose();
    assert.equal(releaseCalls, 2);
  });

  it("rolls back a partially failed bind and classifies it as invalid configuration", async () => {
    const adapter = new NodeDiscordGatewayAdapter({
      botToken: TEST_TOKEN,
      intents: ["Guilds"],
    });
    const protocolSymbol = Symbol.for(
      "@anto-project/discord-bot-core/provider-extension/v1",
    );
    let captured = false;
    let releaseCalls = 0;
    const extension = {};
    Object.defineProperty(extension, protocolSymbol, {
      value: Object.freeze({
        key: "test.bind-rollback",
        bindProviderClient(): void {
          captured = true;
          throw new TypeError("missing provider capability");
        },
        async releaseProviderClient(): Promise<void> {
          releaseCalls += 1;
          captured = false;
        },
      }),
    });

    await assert.rejects(adapter.registerProviderExtension(extension), (error: unknown) => {
      assert.ok(error instanceof DiscordCoreError);
      assert.equal(error.code, "DISCORD_INVALID_INPUT");
      assert.equal(error.retryable, false);
      return true;
    });
    assert.equal(captured, false);
    assert.equal(releaseCalls, 1);
  });
});
