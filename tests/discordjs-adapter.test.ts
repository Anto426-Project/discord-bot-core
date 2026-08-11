import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ChannelType,
  ChatInputCommandInteraction,
  Client,
  Collection,
  Events,
  type User,
} from "discord.js";

import { DiscordCoreError } from "../src/errors.js";
import {
  NodeDiscordGatewayAdapter,
  createNodeDiscordProviderExtension,
  createNodeDiscordRuntime,
  normalizeNodeDiscordInteraction,
} from "../src/discordjs.js";
import type { DiscordInteraction } from "../src/interactions.js";

const TEST_TOKEN = "provider-token-value-that-must-not-cross-the-core-boundary";
const BOT_USER_ID = "12345678901234567";
const APPLICATION_ID = "22345678901234567";
const INTERACTION_ID = "32345678901234567";
const USER_ID = "42345678901234567";
const DEFAULT_AVATAR_USER_ID = "102341234567890123";

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
      const extension = createNodeDiscordProviderExtension({
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

  it("shares restart generation replacement and lets stop cancel that transition", async () => {
    const loginDescriptor = Object.getOwnPropertyDescriptor(Client.prototype, "login");
    const destroyDescriptor = Object.getOwnPropertyDescriptor(Client.prototype, "destroy");
    const readyDescriptor = Object.getOwnPropertyDescriptor(Client.prototype, "isReady");
    assert.ok(loginDescriptor);
    assert.ok(destroyDescriptor);
    assert.ok(readyDescriptor);

    let loginCalls = 0;
    let destroyCalls = 0;
    const timeline: string[] = [];
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
      await adapter.registerProviderExtension(
        createNodeDiscordProviderExtension({
          key: "test.concurrent-restart",
          bindProviderClient(_providerClient: unknown, generation: number): void {
            timeline.push(`bind:${generation}`);
          },
          async releaseProviderClient(generation: number): Promise<void> {
            timeline.push(`release:${generation}`);
          },
        }),
      );

      await adapter.start();
      await adapter.stop();
      const [first, second] = await Promise.all([adapter.start(), adapter.start()]);
      assert.deepEqual(first, second);
      assert.equal(loginCalls, 2);
      assert.deepEqual(timeline, ["bind:1", "release:1", "bind:2"]);

      await adapter.stop();
      const restarting = adapter.start();
      const stopping = adapter.stop();
      await assert.rejects(
        restarting,
        (error: unknown) =>
          error instanceof DiscordCoreError && error.code === "DISCORD_CANCELLED",
      );
      await stopping;
      assert.deepEqual(timeline, [
        "bind:1",
        "release:1",
        "bind:2",
        "release:2",
        "bind:3",
        "release:3",
      ]);

      await adapter.start();
      assert.equal(loginCalls, 3);
      assert.deepEqual(timeline.at(-1), "bind:4");
      await adapter.stop();
      assert.equal(destroyCalls, 4);
      assert.deepEqual(timeline.at(-1), "release:4");
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
    assert.throws(() => adapter.registerProviderExtension({}), /protocol is missing/iu);

    const extension = createNodeDiscordProviderExtension({
      key: "test.duplicate",
      bindProviderClient(): void {},
      async releaseProviderClient(): Promise<void> {},
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
    let release!: () => void;
    const releaseGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const extension = createNodeDiscordProviderExtension({
      key: "test.shutdown-race",
      bindProviderClient(): void {},
      async releaseProviderClient(): Promise<void> {
        await releaseGate;
      },
    });
    await adapter.registerProviderExtension(extension);

    const stopping = adapter.stop();
    assert.throws(
      () =>
        adapter.registerProviderExtension(
          createNodeDiscordProviderExtension({
            key: "test.late-extension",
            bindProviderClient(): void {},
            async releaseProviderClient(): Promise<void> {},
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
      let finishRelease!: () => void;
      const releaseGate = new Promise<void>((resolve) => {
        finishRelease = resolve;
      });
      const boundGenerations: number[] = [];
      const extension = createNodeDiscordProviderExtension({
        key: "test.release-timeout",
        bindProviderClient(_client: unknown, generation: number): void {
          boundGenerations.push(generation);
        },
        async releaseProviderClient(): Promise<void> {
          await releaseGate;
        },
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
    let releaseCalls = 0;
    const extension = createNodeDiscordProviderExtension({
      key: "test.dispose-retry",
      bindProviderClient(): void {},
      async releaseProviderClient(): Promise<void> {
        releaseCalls += 1;
        if (releaseCalls === 1) throw new Error("provider cleanup failed");
      },
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
    let captured = false;
    let releaseCalls = 0;
    const extension = createNodeDiscordProviderExtension({
      key: "test.bind-rollback",
      bindProviderClient(): void {
        captured = true;
        throw new TypeError("missing provider capability");
      },
      async releaseProviderClient(): Promise<void> {
        releaseCalls += 1;
        captured = false;
      },
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

  it("rejects asynchronous provider bind callbacks and observes their rejection", async () => {
    const adapter = new NodeDiscordGatewayAdapter({
      botToken: TEST_TOKEN,
      intents: ["Guilds"],
    });
    let releaseCalls = 0;
    const extension = createNodeDiscordProviderExtension({
      key: "test.async-bind",
      bindProviderClient: (() =>
        Promise.reject(new Error("late provider bind failure"))) as unknown as (
        providerClient: unknown,
        generation: number,
      ) => void,
      async releaseProviderClient(): Promise<void> {
        releaseCalls += 1;
      },
    });

    await assert.rejects(adapter.registerProviderExtension(extension), (error: unknown) => {
      assert.ok(error instanceof DiscordCoreError);
      assert.equal(error.code, "DISCORD_INVALID_INPUT");
      assert.match(error.safeSummary, /synchronously/iu);
      return true;
    });
    await nextTurn();
    assert.equal(releaseCalls, 1);
    await adapter.stop();
  });

  it("creates opaque provider extensions from callback-only configuration", async () => {
    let getterCalled = false;
    const malicious = Object.defineProperty({}, "key", {
      get(): string {
        getterCalled = true;
        return "test.getter";
      },
    });
    assert.throws(
      () => createNodeDiscordProviderExtension(malicious as never),
      /callbacks are invalid/iu,
    );
    assert.equal(getterCalled, false);

    const adapter = new NodeDiscordGatewayAdapter({
      botToken: TEST_TOKEN,
      intents: ["Guilds"],
    });
    const timeline: string[] = [];
    const extension = createNodeDiscordProviderExtension({
      key: "test.factory",
      bindProviderClient(providerClient: unknown, generation: number): void {
        assert.ok(providerClient instanceof Client);
        timeline.push(`bind:${generation}`);
      },
      async releaseProviderClient(generation: number, signal: AbortSignal): Promise<void> {
        assert.equal(signal.aborted, false);
        timeline.push(`release:${generation}`);
      },
    });
    assert.deepEqual(JSON.parse(JSON.stringify(extension)), {});
    const dispose = await adapter.registerProviderExtension(extension);
    assert.deepEqual(timeline, ["bind:1"]);
    await dispose();
    assert.deepEqual(timeline, ["bind:1", "release:1"]);
    await adapter.stop();
  });

  it("exposes immutable inspection, guild, profile and presence services", async () => {
    const loginDescriptor = Object.getOwnPropertyDescriptor(Client.prototype, "login");
    const destroyDescriptor = Object.getOwnPropertyDescriptor(Client.prototype, "destroy");
    const readyDescriptor = Object.getOwnPropertyDescriptor(Client.prototype, "isReady");
    assert.ok(loginDescriptor);
    assert.ok(destroyDescriptor);
    assert.ok(readyDescriptor);

    let providerClient: MutableTestClient | null = null;
    const presencePlans: unknown[] = [];
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
        (this as unknown as { user: unknown }).user = {
          id: BOT_USER_ID,
          username: "test-bot",
          setPresence: (plan: unknown) => presencePlans.push(plan),
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
      const runtime = createNodeDiscordRuntime({
        botToken: TEST_TOKEN,
        gateway: {
          intents: ["Guilds", "GuildMembers", "GuildPresences"],
          acknowledgedPrivilegedIntents: ["GuildMembers", "GuildPresences"],
        },
      });
      await runtime.gateway.start();
      const client = ((): MutableTestClient => {
        if (providerClient === null) throw new Error("provider client was not captured");
        return providerClient;
      })();
      const guildId = "62345678901234567";
      const roleId = "72345678901234567";
      const textChannelId = "82345678901234567";
      const voiceChannelId = "92345678901234567";
      const createdAt = new Date("2020-01-02T03:04:05.000Z");
      const joinedAt = new Date("2024-05-06T07:08:09.000Z");
      const guild: Record<string, unknown> = {};
      const everyoneRole = {
        id: guildId,
        guild,
        name: "@everyone",
        color: 0,
        position: 0,
        managed: false,
        editable: false,
        permissions: { has: () => false },
      };
      const role = {
        id: roleId,
        guild,
        name: "Students",
        color: 0x12_34_56,
        position: 1,
        managed: false,
        editable: true,
        permissions: { has: () => false },
      };
      const roles = new Collection<string, never>();
      roles.set(guildId, everyoneRole as never);
      roles.set(roleId, role as never);
      const profileUser = {
        id: USER_ID,
        username: "student",
        displayName: "Student",
        tag: "student",
        bot: false,
        avatar: "avatar-hash",
        createdAt,
        displayAvatarURL: (options: Readonly<{ extension: string; size: number }>) =>
          `https://cdn.discordapp.com/avatars/${USER_ID}/avatar-hash.${options.extension}?size=${options.size}`,
      };
      const member = {
        id: USER_ID,
        guild,
        user: profileUser,
        displayName: "Student Member",
        nickname: "Student",
        joinedAt,
        roles: { cache: roles },
      };
      const members = new Collection<string, never>();
      members.set(USER_ID, member as never);
      const channels = new Collection<string, never>();
      channels.set(textChannelId, { type: ChannelType.GuildText } as never);
      channels.set(voiceChannelId, { type: ChannelType.GuildVoice } as never);
      Object.assign(guild, {
        id: guildId,
        name: "Test Guild",
        description: "A bounded guild profile",
        ownerId: USER_ID,
        shardId: 0,
        memberCount: 1,
        premiumTier: 1,
        premiumSubscriptionCount: 2,
        createdAt,
        channels: { cache: channels },
        roles: {
          cache: roles,
          fetch: async () => roles,
        },
        members: {
          cache: members,
          list: async () => members,
          fetch: async () => member,
        },
        iconURL: (options: Readonly<{ extension: string; size: number }>) =>
          `https://cdn.discordapp.com/icons/${guildId}/icon.${options.extension}?size=${options.size}`,
        bannerURL: () => null,
        splashURL: (options: Readonly<{ extension: string; size: number }>) =>
          `https://cdn.discordapp.com/splashes/${guildId}/splash.${options.extension}?size=${options.size}`,
      });
      client.guilds.cache.set(guildId, guild as never);
      client.users.cache.set(USER_ID, profileUser as never);
      const defaultAvatarUser = (
        client.users as unknown as {
          _add(data: Readonly<Record<string, unknown>>): User;
        }
      )._add({
        id: DEFAULT_AVATAR_USER_ID,
        username: "default-avatar-user",
        discriminator: "0",
        global_name: null,
        avatar: null,
        bot: false,
      });

      const inspection = runtime.inspection.capture();
      assert.equal(inspection.connected, true);
      assert.equal(inspection.communityCount, 1);
      assert.equal(inspection.userCount, 1);
      assert.equal(inspection.channelCount, 2);
      assert.equal(inspection.textChannelCount, 1);
      assert.equal(inspection.voiceChannelCount, 1);
      assert.deepEqual(inspection.guilds, [
        { id: guildId, name: "Test Guild", shardId: 0, memberCount: 1 },
      ]);
      assert.ok(Object.isFrozen(inspection));
      assert.ok(Object.isFrozen(inspection.guilds));

      const listedRoles = await runtime.guilds.listRoles({ guildId });
      assert.deepEqual(listedRoles.map((entry) => entry.id), [guildId, roleId]);
      assert.equal(listedRoles[1]?.editable, true);
      const mismatchedRoleKey = "73345678901234567";
      roles.delete(roleId);
      roles.set(mismatchedRoleKey, role as never);
      await assert.rejects(
        runtime.guilds.listRoles({ guildId }),
        (error: unknown) =>
          error instanceof DiscordCoreError && error.code === "DISCORD_RESPONSE_INVALID",
      );
      await assert.rejects(
        runtime.profiles.readMember({ guildId, userId: USER_ID, mode: "cache" }),
        (error: unknown) =>
          error instanceof DiscordCoreError && error.code === "DISCORD_RESPONSE_INVALID",
      );
      roles.delete(mismatchedRoleKey);
      roles.set(roleId, role as never);
      const page = await runtime.guilds.listMembers({ guildId, limit: 1 });
      assert.equal(page.members[0]?.userId, USER_ID);
      assert.deepEqual(page.members[0]?.roleIds, [guildId, roleId]);
      assert.equal(page.nextAfter, USER_ID);
      const mismatchedMemberKey = "43345678901234567";
      members.delete(USER_ID);
      members.set(mismatchedMemberKey, member as never);
      await assert.rejects(
        runtime.guilds.listMembers({ guildId, limit: 1 }),
        (error: unknown) =>
          error instanceof DiscordCoreError && error.code === "DISCORD_RESPONSE_INVALID",
      );
      members.delete(mismatchedMemberKey);
      members.set(USER_ID, member as never);
      await assert.rejects(
        runtime.guilds.listMembers({ guildId, limit: 1_001 }),
        (error: unknown) =>
          error instanceof DiscordCoreError && error.code === "DISCORD_INVALID_INPUT",
      );

      const user = await runtime.profiles.readUser({ userId: USER_ID, mode: "cache" });
      assert.equal(user?.createdAt, createdAt.toISOString());
      assert.equal(
        user?.avatar.urls.webp?.[4_096],
        `https://cdn.discordapp.com/avatars/${USER_ID}/avatar-hash.webp?size=4096`,
      );
      assert.ok(Object.isFrozen(user?.avatar.urls.webp));
      const defaultAvatarProfile = await runtime.profiles.readUser({
        userId: defaultAvatarUser.id,
        mode: "cache",
      });
      const expectedDefaultAvatar = new URL(defaultAvatarUser.defaultAvatarURL);
      expectedDefaultAvatar.searchParams.set("size", "512");
      assert.equal(
        defaultAvatarProfile?.avatar.urls.png?.[512],
        expectedDefaultAvatar.toString(),
      );
      assert.deepEqual(Object.keys(defaultAvatarProfile?.avatar.urls ?? {}), ["png"]);
      assert.equal(defaultAvatarProfile?.avatar.urls.webp, undefined);
      assert.ok(Object.isFrozen(defaultAvatarProfile?.avatar.urls.png));
      const safeAvatarUrl = profileUser.displayAvatarURL;
      profileUser.displayAvatarURL = () =>
        `https://example.invalid/avatars/${USER_ID}/avatar-hash.png?size=512`;
      await assert.rejects(
        runtime.profiles.readUser({ userId: USER_ID, mode: "cache" }),
        (error: unknown) =>
          error instanceof DiscordCoreError && error.code === "DISCORD_RESPONSE_INVALID",
      );
      profileUser.displayAvatarURL = safeAvatarUrl;
      const safeCreatedAt = profileUser.createdAt;
      profileUser.createdAt = new Date(Number.NaN);
      await assert.rejects(
        runtime.profiles.readUser({ userId: USER_ID, mode: "cache" }),
        (error: unknown) =>
          error instanceof DiscordCoreError && error.code === "DISCORD_RESPONSE_INVALID",
      );
      profileUser.createdAt = safeCreatedAt;
      const memberProfile = await runtime.profiles.readMember({
        guildId,
        userId: USER_ID,
        mode: "cache",
      });
      assert.equal(memberProfile?.joinedAt, joinedAt.toISOString());
      assert.deepEqual(memberProfile?.roles.map((entry) => entry.id), [guildId, roleId]);
      const guildProfile = await runtime.profiles.readGuild({ guildId, mode: "cache" });
      assert.equal(guildProfile?.ownerId, USER_ID);
      assert.equal(guildProfile?.banner, null);
      assert.equal(
        guildProfile?.icon?.urls.png?.[1_024],
        `https://cdn.discordapp.com/icons/${guildId}/icon.png?size=1024`,
      );

      await runtime.presence.apply({
        text: "  Ready  ",
        activityType: "playing",
        status: "online",
      });
      await runtime.presence.clear();
      assert.deepEqual(presencePlans, [
        { status: "online", activities: [{ name: "Ready", type: 0 }] },
        { activities: [] },
      ]);
      await assert.rejects(
        runtime.presence.apply({
          text: "\u0000unsafe",
          activityType: "playing",
          status: "online",
        }),
        (error: unknown) =>
          error instanceof DiscordCoreError && error.code === "DISCORD_INVALID_INPUT",
      );

      await runtime.gateway.stop();
      assert.deepEqual(runtime.inspection.capture(), {
        connected: false,
        applicationId: null,
        agentUserId: null,
        communityCount: 0,
        userCount: 0,
        partitionCount: 0,
        transportLatencyMilliseconds: null,
        gatewayLibraryVersion: inspection.gatewayLibraryVersion,
        channelCount: 0,
        textChannelCount: 0,
        voiceChannelCount: 0,
        guilds: [],
      });
      await assert.rejects(
        runtime.profiles.readUser({ userId: USER_ID, mode: "cache" }),
        (error: unknown) =>
          error instanceof DiscordCoreError && error.code === "DISCORD_CIRCUIT_OPEN",
      );
    } finally {
      Object.defineProperty(Client.prototype, "login", loginDescriptor);
      Object.defineProperty(Client.prototype, "destroy", destroyDescriptor);
      Object.defineProperty(Client.prototype, "isReady", readyDescriptor);
    }
  });

  it("bounds queries and rejects results from a stopped gateway generation", async () => {
    const loginDescriptor = Object.getOwnPropertyDescriptor(Client.prototype, "login");
    const destroyDescriptor = Object.getOwnPropertyDescriptor(Client.prototype, "destroy");
    const readyDescriptor = Object.getOwnPropertyDescriptor(Client.prototype, "isReady");
    assert.ok(loginDescriptor);
    assert.ok(destroyDescriptor);
    assert.ok(readyDescriptor);

    const guildId = "62345678901234567";
    const roleId = "72345678901234567";
    let loginCount = 0;
    let resolveFirstRoles!: () => void;
    let resolveTimedOutRoles!: () => void;
    let resolveStaleRoles!: () => void;
    let fetchCount = 0;
    Object.defineProperty(Client.prototype, "isReady", {
      ...readyDescriptor,
      value(this: MutableTestClient): boolean {
        return this.__testReady === true;
      },
    });
    Object.defineProperty(Client.prototype, "login", {
      ...loginDescriptor,
      async value(this: MutableTestClient): Promise<string> {
        loginCount += 1;
        (this as unknown as { user: unknown }).user = {
          id: BOT_USER_ID,
          username: "test-bot",
        };
        (this as unknown as { application: unknown }).application = { id: APPLICATION_ID };
        const guild: Record<string, unknown> = {};
        const role = {
          id: roleId,
          guild,
          name: "Role",
          color: 0,
          position: 1,
          managed: false,
          editable: true,
          permissions: { has: () => false },
        };
        const roles = new Collection<string, never>();
        roles.set(roleId, role as never);
        Object.assign(guild, {
          id: guildId,
          name: `Guild ${loginCount}`,
          shardId: 0,
          memberCount: 0,
          channels: { cache: new Collection() },
          roles: {
            fetch: async () => {
              fetchCount += 1;
              if (fetchCount === 1) {
                await new Promise<void>((resolve) => {
                  resolveFirstRoles = resolve;
                });
              } else if (fetchCount === 3) {
                await new Promise<void>((resolve) => {
                  resolveTimedOutRoles = resolve;
                });
              } else if (fetchCount === 4) {
                await new Promise<void>((resolve) => {
                  resolveStaleRoles = resolve;
                });
              }
              return roles;
            },
          },
        });
        this.guilds.cache.set(guildId, guild as never);
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
        queryTimeoutMs: 100,
        maximumConcurrentQueries: 1,
      });
      await adapter.start();

      const caller = new AbortController();
      const first = adapter.listRoles({ guildId, signal: caller.signal });
      await nextTurn();
      await assert.rejects(
        adapter.listRoles({ guildId }),
        (error: unknown) =>
          error instanceof DiscordCoreError && error.code === "DISCORD_CIRCUIT_OPEN",
      );
      caller.abort();
      await assert.rejects(
        first,
        (error: unknown) =>
          error instanceof DiscordCoreError && error.code === "DISCORD_CANCELLED",
      );
      await assert.rejects(
        adapter.listRoles({ guildId }),
        (error: unknown) =>
          error instanceof DiscordCoreError && error.code === "DISCORD_CIRCUIT_OPEN",
      );
      resolveFirstRoles();
      await nextTurn();
      assert.equal((await adapter.listRoles({ guildId }))[0]?.id, roleId);

      await assert.rejects(
        adapter.listRoles({ guildId }),
        (error: unknown) =>
          error instanceof DiscordCoreError && error.code === "DISCORD_TIMEOUT",
      );
      await assert.rejects(
        adapter.listRoles({ guildId }),
        (error: unknown) =>
          error instanceof DiscordCoreError && error.code === "DISCORD_CIRCUIT_OPEN",
      );
      resolveTimedOutRoles();
      await nextTurn();

      const stale = adapter.listRoles({ guildId });
      await nextTurn();
      const stopping = adapter.stop();
      await assert.rejects(
        stale,
        (error: unknown) =>
          error instanceof DiscordCoreError && error.code === "DISCORD_CANCELLED",
      );
      await stopping;
      await adapter.start();
      assert.equal((await adapter.listRoles({ guildId }))[0]?.id, roleId);
      resolveStaleRoles();
      await nextTurn();
      assert.equal(loginCount, 2);
      await adapter.stop();
    } finally {
      Object.defineProperty(Client.prototype, "login", loginDescriptor);
      Object.defineProperty(Client.prototype, "destroy", destroyDescriptor);
      Object.defineProperty(Client.prototype, "isReady", readyDescriptor);
    }
  });
});
