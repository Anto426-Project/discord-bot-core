import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DiscordEventRouter,
  DiscordEventSubscription,
  DiscordIngressRouter,
  type DiscordEventIdempotencyPort,
} from "../src/index.js";

type TestInteraction =
  | Readonly<{ kind: "button"; id: string }>
  | Readonly<{ kind: "chat"; id: string; commandName: string }>;
type TestChatInput = Extract<TestInteraction, { kind: "chat" }>;

describe("Discord routing", () => {
  it("routes chat input separately from component fallbacks", async () => {
    const handled: string[] = [];
    const router = new DiscordIngressRouter<TestInteraction, TestChatInput>({
      commands: [
        {
          commandName: "ping",
          handle: async (interaction, signal) => {
            assert.equal(signal.aborted, false);
            handled.push(interaction.commandName);
          },
        },
      ],
      interactions: [
        {
          id: "button.help",
          handle: async (interaction) => {
            if (interaction.kind !== "button") return false;
            handled.push(interaction.id);
            return true;
          },
        },
      ],
      isChatInputCommand: (interaction): interaction is TestChatInput => interaction.kind === "chat",
    });

    assert.equal(await router.handle({ kind: "chat", id: "1", commandName: "ping" }), true);
    assert.equal(await router.handle({ kind: "button", id: "help" }), true);
    assert.deepEqual(handled, ["ping", "help"]);
  });

  it("uses one total deadline and never starts a later fallback after expiry", async () => {
    let laterStarted = false;
    const router = new DiscordIngressRouter<TestInteraction, TestChatInput>({
      commands: [],
      interactions: [
        {
          id: "slow.binding",
          handle: async (_interaction, signal) => {
            await new Promise<void>((resolve) => {
              const timer = setTimeout(resolve, 1_000);
              signal.addEventListener("abort", () => {
                clearTimeout(timer);
                resolve();
              }, { once: true });
            });
            return false;
          },
        },
        {
          id: "later.binding",
          handle: async () => {
            laterStarted = true;
            return true;
          },
        },
      ],
      isChatInputCommand: (interaction): interaction is TestChatInput => interaction.kind === "chat",
      handlerTimeoutMs: 100,
    });
    await assert.rejects(() => router.handle({ kind: "button", id: "slow" }), /deadline/iu);
    assert.equal(laterStarted, false);
  });
});

class MemoryIdempotency implements DiscordEventIdempotencyPort {
  readonly states = new Map<string, Readonly<{ token: string; status: string }>>();
  #sequence = 0;

  public async claim(key: string, _ttlMs: number, signal: AbortSignal) {
    if (signal.aborted) throw signal.reason;
    if (this.states.has(key)) return { status: "duplicate" as const };
    this.#sequence += 1;
    const token = `claim/${this.#sequence}`;
    this.states.set(key, { token, status: "claimed" });
    return { status: "claimed" as const, claimToken: token };
  }

  public async finalize(
    key: string,
    claimToken: string,
    outcome: Readonly<{ status: "completed" }> | Readonly<{ status: "uncertain"; code: string }>,
    signal: AbortSignal,
  ) {
    if (signal.aborted) throw signal.reason;
    const current = this.states.get(key);
    if (current?.token !== claimToken || current.status !== "claimed") return "already_finalized" as const;
    this.states.set(key, { token: claimToken, status: outcome.status });
    return "applied" as const;
  }
}

describe("Discord event idempotency", () => {
  it("claims before handling and leaves a durable completed tombstone", async () => {
    const store = new MemoryIdempotency();
    let handled = 0;
    const subscription = new DiscordEventSubscription({
      subscriptionId: "guild.member.added",
      eventName: "guildMemberAdd",
      decode: (arguments_) => String(arguments_[0]),
      idempotencyKey: (value) => value,
      handler: async () => {
        handled += 1;
      },
    });
    const router = new DiscordEventRouter(
      [subscription],
      store,
      { report: async () => undefined },
    );
    const first = await router.dispatch("guildMemberAdd", ["123"]);
    const second = await router.dispatch("guildMemberAdd", ["123"]);
    assert.equal(first.status, "dispatched");
    assert.equal(second.status, "dispatched");
    assert.equal(handled, 1);
    assert.equal([...store.states.values()][0]?.status, "completed");
  });

  it("terminally records uncertain side effects after a handler failure", async () => {
    const store = new MemoryIdempotency();
    const subscription = new DiscordEventSubscription({
      subscriptionId: "message.created",
      eventName: "messageCreate",
      decode: (arguments_) => String(arguments_[0]),
      idempotencyKey: (value) => value,
      handler: async () => {
        throw new Error("after side effect");
      },
    });
    const router = new DiscordEventRouter(
      [subscription],
      store,
      { report: async () => undefined },
    );
    await router.dispatch("messageCreate", ["456"]);
    assert.equal([...store.states.values()][0]?.status, "uncertain");
  });
});
